#!/usr/bin/env node
// Pipeline de assets CC0 de Poly Haven: descarga, convierte y genera el manifest.
//
// Uso: node scripts/fetch-assets.mjs [--force] [--only=<id>,<id>]
//
// - Determinista e idempotente: la lista de assets vive en este archivo; cada salida
//   se omite si existe y el registro `public/assets/assets.lock.json` tiene el mismo
//   md5 de origen (la API da md5 por archivo). El manifest no lleva fecha.
// - Modelos: gltf 1k + include → carpeta temporal → `gltf-transform webp` → .glb
//   (sin draco ni meshopt). Si pasa de 2.5 MB, se repite con `resize 512` antes de webp;
//   si aún pasa, se descarta y queda en DISCARDED.
// - Texturas: Diffuse (sRGB), nor_gl y arm (lineales) 1k jpg → webp con sharp.
//   arm: R = oclusión, G = rugosidad, B = metalicidad (igual que aoMap/roughnessMap/
//   metalnessMap de three.js).
// - HDRI: .hdr 1k tal cual (≤ 2 MB).
// - La API responde 403 sin User-Agent: toda petición lleva UA.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const UA = 'simulador-crimen-assets/1.0';
const API = 'https://api.polyhaven.com';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'assets');
const LOCK = join(OUT, 'assets.lock.json');
const MANIFEST = join(ROOT, 'src', 'assets', 'manifest.ts');
const CREDITS = join(ROOT, '..', 'ASSET_CREDITS.md');
const CLI = join(ROOT, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const TMP = join(tmpdir(), 'simulador-crimen-assets');

export const MODEL_BUDGET = 2.5 * 1024 * 1024;
export const HDRI_BUDGET = 2 * 1024 * 1024;
export const TOTAL_BUDGET = 45 * 1024 * 1024;
const WEBP_QUALITY = 80;

// ── Catálogo ──────────────────────────────────────────────────────────────
// group: uso previsto en la escena. resize: forzar texturas a 512 (props pequeños,
// 1k sobre un objeto de 6 cm es desperdicio).
const MODELS = [
  // Interior: sala, comedor, dormitorio, cocina
  { id: 'Sofa_01', group: 'interior' },
  { id: 'sofa_02', group: 'interior' },
  { id: 'ArmChair_01', group: 'interior' },
  { id: 'modern_coffee_table_01', group: 'interior' },
  { id: 'side_table_01', group: 'interior' },
  { id: 'dining_table', group: 'interior' },
  { id: 'dining_chair_02', group: 'interior' },
  { id: 'ClassicNightstand_01', group: 'interior' },
  { id: 'drawer_cabinet', group: 'interior' },
  { id: 'modern_wooden_cabinet', group: 'interior' },
  { id: 'modern_ceiling_lamp_01', group: 'interior' },
  { id: 'Television_01', group: 'interior' },
  { id: 'hanging_picture_frame_01', group: 'interior' },
  { id: 'potted_plant_02', group: 'interior' },
  { id: 'electric_stove', group: 'interior' },
  { id: 'GothicBed_01', group: 'interior' },
  { id: 'throw_pillows_01', group: 'interior' },
  // Exterior: vía pública, parque
  { id: 'street_lamp_01', group: 'exterior' },
  { id: 'concrete_road_barrier', group: 'exterior' },
  { id: 'covered_car', group: 'exterior' },
  { id: 'metal_trash_can', group: 'exterior' },
  { id: 'fire_hydrant', group: 'exterior' },
  { id: 'painted_wooden_bench', group: 'exterior' },
  { id: 'trashbag', group: 'exterior' },
  { id: 'utility_box_02', group: 'exterior' },
  { id: 'rollershutter_door', group: 'exterior' },
  // Props forenses / indicios
  { id: 'clipboard', group: 'forensic', resize: true },
  { id: 'cardboard_box_01', group: 'forensic' },
  { id: 'cigarette_pack', group: 'forensic', resize: true },
  { id: 'fish_knife', group: 'forensic', resize: true },
  { id: 'service_pistol', group: 'forensic', resize: true },
  { id: 'baseball_bat', group: 'forensic', resize: true },
  { id: 'magnifying_glass_01', group: 'forensic', resize: true },
];

// role: uso previsto. repeatM: metros que cubre una repetición (Poly Haven ~ 1-2 m).
const TEXTURES = [
  { id: 'wood_floor', role: 'piso-madera-interior' },
  { id: 'terracotta_floor_tiles', role: 'piso-baldosa-vivienda' },
  { id: 'white_plaster_02', role: 'muro-yeso' },
  { id: 'dark_wood', role: 'zocalo-madera' },
  { id: 'asphalt_02', role: 'asfalto' },
  { id: 'pavement_02', role: 'acera-concreto' },
  { id: 'sparse_grass', role: 'pasto' },
  { id: 'forest_ground_05', role: 'tierra' },
  { id: 'red_brick', role: 'ladrillo-exterior' },
];
const TEXTURE_MAPS = [
  { key: 'Diffuse', name: 'diff', colorSpace: 'srgb' },
  { key: 'nor_gl', name: 'nor_gl', colorSpace: 'linear' },
  { key: 'arm', name: 'arm', colorSpace: 'linear' },
];

const HDRIS = [
  { id: 'street_lamp', role: 'exterior-noche' },
  { id: 'small_empty_room_2', role: 'interior-tenue' },
];

// ── Utilidades ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null;
const sel = (id) => !ONLY || ONLY.includes(id);

const log = (...m) => console.log('[fetch-assets]', ...m);
const md5 = (buf) => createHash('md5').update(buf).digest('hex');
const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
const round = (n) => Math.round(n * 1000) / 1000;

async function http(url, { json = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return json ? res.json() : Buffer.from(await res.arrayBuffer());
    if (res.status >= 500 && attempt < 2) continue;
    throw new Error(`HTTP ${res.status} ${url}`);
  }
}

/** Descarga y verifica el md5 que publica la API. */
async function download(entry) {
  const buf = await http(entry.url);
  if (entry.md5 && md5(buf) !== entry.md5) throw new Error(`md5 no coincide: ${entry.url}`);
  return buf;
}

const readLock = () => (existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {});
const fresh = (lock, key, sig, files) =>
  !FORCE && lock[key]?.sig === sig && files.every((f) => existsSync(f));

function gltfTransform(...cliArgs) {
  execFileSync(process.execPath, [CLI, ...cliArgs], { stdio: 'pipe' });
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Bounding box en metros (Y arriba) del .glb ya convertido. */
async function bboxOf(glbPath) {
  const doc = await io.read(glbPath);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const { min, max } = getBounds(scene);
  return { min: min.map(round), max: max.map(round), size: max.map((v, i) => round(v - min[i])) };
}

// ── Pasos ─────────────────────────────────────────────────────────────────
async function fetchModel(spec, lock, discarded) {
  const { id } = spec;
  const files = await http(`${API}/files/${id}`, { json: true });
  const g = files.gltf?.['1k']?.gltf;
  if (!g) throw new Error(`${id}: sin gltf 1k`);
  const sig = md5(
    JSON.stringify([g.md5, ...Object.entries(g.include ?? {}).map(([k, v]) => [k, v.md5]).sort(), !!spec.resize]),
  );
  const out = join(OUT, 'models', `${id}.glb`);
  if (fresh(lock, `model:${id}`, sig, [out])) return { out, resized: lock[`model:${id}`].resized };

  const dir = join(TMP, 'models', id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const src = join(dir, `${id}.gltf`);
  writeFileSync(src, await download(g));
  for (const [rel, entry] of Object.entries(g.include ?? {})) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, await download(entry));
  }
  mkdirSync(dirname(out), { recursive: true });

  let resized = !!spec.resize;
  const convert = (withResize) => {
    if (withResize) {
      const small = join(dir, `${id}_512.glb`);
      gltfTransform('resize', src, small, '--width', '512', '--height', '512');
      gltfTransform('webp', small, out);
    } else {
      gltfTransform('webp', src, out);
    }
  };
  convert(resized);
  if (statSync(out).size > MODEL_BUDGET && !resized) {
    log(`${id}: ${mb(statSync(out).size)} > presupuesto, reintento con resize 512`);
    resized = true;
    convert(true);
  }
  rmSync(dir, { recursive: true, force: true });
  if (statSync(out).size > MODEL_BUDGET) {
    discarded.push({ id, reason: `excede ${mb(MODEL_BUDGET)} tras resize 512 (${mb(statSync(out).size)})` });
    rmSync(out, { force: true });
    delete lock[`model:${id}`];
    return null;
  }
  lock[`model:${id}`] = { sig, resized };
  return { out, resized };
}

async function fetchTexture(spec, lock) {
  const { id } = spec;
  const files = await http(`${API}/files/${id}`, { json: true });
  const maps = {};
  for (const m of TEXTURE_MAPS) {
    const entry = files[m.key]?.['1k']?.jpg;
    if (!entry) throw new Error(`${id}: falta mapa ${m.key} 1k jpg`);
    const out = join(OUT, 'textures', id, `${id}_${m.name}_1k.webp`);
    const sig = md5(JSON.stringify([entry.md5, WEBP_QUALITY]));
    const key = `texture:${id}:${m.name}`;
    if (!fresh(lock, key, sig, [out])) {
      const jpg = await download(entry);
      mkdirSync(dirname(out), { recursive: true });
      // Sin conversión de perfil: los valores de píxel pasan tal cual (normal/arm lineales).
      await sharp(jpg).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(out);
      lock[key] = { sig };
    }
    maps[m.name] = { out, colorSpace: m.colorSpace };
  }
  return maps;
}

async function fetchHdri(spec, lock) {
  const { id } = spec;
  const files = await http(`${API}/files/${id}`, { json: true });
  const entry = files.hdri?.['1k']?.hdr;
  if (!entry) throw new Error(`${id}: sin hdr 1k`);
  if (entry.size > HDRI_BUDGET) throw new Error(`${id}: hdr 1k ${mb(entry.size)} > ${mb(HDRI_BUDGET)}`);
  const out = join(OUT, 'hdri', `${id}_1k.hdr`);
  const key = `hdri:${id}`;
  if (!fresh(lock, key, entry.md5, [out])) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await download(entry));
    lock[key] = { sig: entry.md5 };
  }
  return out;
}

async function infoOf(id) {
  const info = await http(`${API}/info/${id}`, { json: true });
  return { title: info.name, authors: Object.keys(info.authors ?? {}).sort() };
}

const publicUrl = (abs) => '/' + abs.slice(PUBLIC.length + 1).split('\\').join('/');
const pageUrl = (id) => `https://polyhaven.com/a/${id}`;

// ── Generación de manifest y créditos ─────────────────────────────────────
function renderManifest({ models, textures, hdris, discarded }) {
  const j = (v) => JSON.stringify(v, null, 2);
  const total =
    models.reduce((s, m) => s + m.bytes, 0) +
    textures.reduce((s, t) => s + Object.values(t.maps).reduce((a, m) => a + m.bytes, 0), 0) +
    hdris.reduce((s, h) => s + h.bytes, 0);
  return `// generado por fetch-assets.mjs — no editar a mano.
// Regenerar: node scripts/fetch-assets.mjs (idempotente; --force rehace todo).
// Fuente: Poly Haven (https://polyhaven.com), licencia CC0. Créditos en ASSET_CREDITS.md.

export type AssetLicense = 'CC0';

interface AssetBase {
  id: string;
  title: string;
  license: AssetLicense;
  /** Página del asset en polyhaven.com. */
  source: string;
  authors: readonly string[];
}

export interface ModelAsset extends AssetBase {
  /** Ruta pública servida por Vite (public/). */
  url: string;
  bytes: number;
  group: 'interior' | 'exterior' | 'forensic';
  /** Bounding box del .glb en metros, Y arriba (unidades reales de Poly Haven). */
  bbox: { min: readonly number[]; max: readonly number[]; size: readonly number[] };
  /** Escala sugerida para llevarlo a metros de la escena (Poly Haven ya exporta en metros). */
  scale: number;
  /** true si las texturas se redujeron a 512 px. */
  resized: boolean;
}

export interface TextureMap {
  url: string;
  bytes: number;
  /** srgb solo para albedo; normal y arm son datos lineales. */
  colorSpace: 'srgb' | 'linear';
}

export interface TextureAsset extends AssetBase {
  role: string;
  /** diff: albedo. nor_gl: normal OpenGL (Y+). arm: R oclusión, G rugosidad, B metalicidad. */
  maps: { diff: TextureMap; nor_gl: TextureMap; arm: TextureMap };
}

export interface HdriAsset extends AssetBase {
  role: string;
  url: string;
  bytes: number;
}

export const MODELS = ${j(Object.fromEntries(models.map((m) => [m.id, m])))} as const satisfies Record<string, ModelAsset>;

export const TEXTURES = ${j(Object.fromEntries(textures.map((t) => [t.id, t])))} as const satisfies Record<string, TextureAsset>;

export const HDRIS = ${j(Object.fromEntries(hdris.map((h) => [h.id, h])))} as const satisfies Record<string, HdriAsset>;

/** Candidatos descartados por presupuesto (no están en disco). */
export const DISCARDED: readonly { id: string; reason: string }[] = ${j(discarded)};

export const ASSET_BUDGET = { modelBytes: ${MODEL_BUDGET}, hdriBytes: ${HDRI_BUDGET}, totalBytes: ${TOTAL_BUDGET} } as const;

/** Suma de bytes de todo lo listado arriba. */
export const TOTAL_BYTES = ${total};

export type ModelId = keyof typeof MODELS;
export type TextureId = keyof typeof TEXTURES;
export type HdriId = keyof typeof HDRIS;
`;
}

function renderCredits({ models, textures, hdris }) {
  const row = (a, kind) => `| ${a.title} | \`${a.id}\` | ${kind} | ${a.authors.join(', ')} | CC0 | ${a.source} |`;
  return `# Créditos de assets

Todos los assets externos provienen de [Poly Haven](https://polyhaven.com) bajo licencia
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (dominio público, sin atribución
obligatoria). Los listamos igual por cortesía hacia sus autores.

Archivo generado por \`simulador-r3f/scripts/fetch-assets.mjs\`; no editar a mano.

| Título | Id | Tipo | Autor(es) | Licencia | Fuente |
|---|---|---|---|---|---|
${[...models.map((m) => row(m, 'modelo')), ...textures.map((t) => row(t, 'textura')), ...hdris.map((h) => row(h, 'HDRI'))].join('\n')}
`;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT, { recursive: true });
  const lock = readLock();
  const discarded = [];
  const models = [];
  for (const spec of MODELS.filter((m) => sel(m.id))) {
    log(`modelo ${spec.id}`);
    const r = await fetchModel(spec, lock, discarded);
    if (!r) continue;
    const bytes = statSync(r.out).size;
    models.push({
      id: spec.id,
      ...(await infoOf(spec.id)),
      license: 'CC0',
      source: pageUrl(spec.id),
      url: publicUrl(r.out),
      bytes,
      group: spec.group,
      bbox: await bboxOf(r.out),
      scale: 1,
      resized: r.resized,
    });
  }
  const textures = [];
  for (const spec of TEXTURES.filter((t) => sel(t.id))) {
    log(`textura ${spec.id}`);
    const maps = await fetchTexture(spec, lock);
    textures.push({
      id: spec.id,
      ...(await infoOf(spec.id)),
      license: 'CC0',
      source: pageUrl(spec.id),
      role: spec.role,
      maps: Object.fromEntries(
        Object.entries(maps).map(([k, m]) => [k, { url: publicUrl(m.out), bytes: statSync(m.out).size, colorSpace: m.colorSpace }]),
      ),
    });
  }
  const hdris = [];
  for (const spec of HDRIS.filter((h) => sel(h.id))) {
    log(`hdri ${spec.id}`);
    const out = await fetchHdri(spec, lock);
    hdris.push({
      id: spec.id,
      ...(await infoOf(spec.id)),
      license: 'CC0',
      source: pageUrl(spec.id),
      role: spec.role,
      url: publicUrl(out),
      bytes: statSync(out).size,
    });
  }
  // Lock ordenado para diffs estables.
  writeFileSync(LOCK, JSON.stringify(Object.fromEntries(Object.entries(lock).sort()), null, 2) + '\n');
  if (ONLY) {
    log('--only: no se reescriben manifest ni créditos');
    return;
  }
  const data = { models, textures, hdris, discarded };
  writeFileSync(MANIFEST, renderManifest(data));
  writeFileSync(CREDITS, renderCredits(data));

  const total =
    models.reduce((s, m) => s + m.bytes, 0) +
    textures.reduce((s, t) => s + Object.values(t.maps).reduce((a, m) => a + m.bytes, 0), 0) +
    hdris.reduce((s, h) => s + h.bytes, 0);
  for (const m of models) log(`  ${m.id.padEnd(26)} ${mb(m.bytes).padStart(9)}  ${m.bbox.size.join(' x ')} m${m.resized ? '  (512)' : ''}`);
  for (const d of discarded) log(`  DESCARTADO ${d.id}: ${d.reason}`);
  log(`total ${mb(total)} (presupuesto ${mb(TOTAL_BUDGET)})`);
  if (total > TOTAL_BUDGET) {
    process.exitCode = 1;
    log('ERROR: total excede el presupuesto');
  }
}

main().catch((err) => {
  console.error('[fetch-assets] ERROR', err);
  process.exit(1);
});
