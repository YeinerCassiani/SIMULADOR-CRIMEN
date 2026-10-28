// Gate del pipeline de assets: el manifest generado por scripts/fetch-assets.mjs
// debe corresponder 1:1 con lo que hay en public/, ser CC0 con fuente y caber en
// presupuesto. Solo stat + cabecera JSON de cada .glb (rápido, determinista).
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_BUDGET, HDRIS, MODELS, TEXTURES, TOTAL_BYTES } from '../assets/manifest';

const PUBLIC = resolve(__dirname, '../../public');
const SOURCE_RE = /^https:\/\/polyhaven\.com\/a\/[A-Za-z0-9_]+$/;

const models = Object.values(MODELS);
const textures = Object.values(TEXTURES);
const hdris = Object.values(HDRIS);
const textureMaps = textures.flatMap((t) => Object.entries(t.maps).map(([name, m]) => ({ id: t.id, name, ...m })));
const files = [
  ...models.map((m) => ({ id: m.id, url: m.url, bytes: m.bytes })),
  ...textureMaps.map((m) => ({ id: `${m.id}:${m.name}`, url: m.url, bytes: m.bytes })),
  ...hdris.map((h) => ({ id: h.id, url: h.url, bytes: h.bytes })),
];
const diskPath = (url: string) => join(PUBLIC, url.replace(/^\//, ''));

/** JSON chunk de un .glb (cabecera 12 B + chunk header 8 B). */
function glbJson(path: string): { extensionsUsed?: string[]; extensionsRequired?: string[] } {
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(20);
    readSync(fd, head, 0, 20, 0);
    expect(head.toString('ascii', 0, 4)).toBe('glTF');
    const len = head.readUInt32LE(12);
    const json = Buffer.alloc(len);
    readSync(fd, json, 0, len, 20);
    return JSON.parse(json.toString('utf8'));
  } finally {
    closeSync(fd);
  }
}

describe('manifest de assets', () => {
  it('tiene modelos, texturas y al menos dos HDRI', () => {
    expect(models.length).toBeGreaterThanOrEqual(10);
    expect(textures.length).toBeGreaterThanOrEqual(6);
    expect(hdris.length).toBeGreaterThanOrEqual(2);
  });

  it('ids únicos entre las tres tablas y clave = id', () => {
    const ids = [...models, ...textures, ...hdris].map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [k, v] of Object.entries({ ...MODELS, ...TEXTURES, ...HDRIS })) expect(v.id).toBe(k);
  });

  it.each([...models, ...textures, ...hdris].map((a) => [a.id, a] as const))(
    '%s: licencia CC0, fuente polyhaven y autor',
    (id, a) => {
      expect(a.license).toBe('CC0');
      expect(a.source).toMatch(SOURCE_RE);
      expect(a.source.endsWith(`/${id}`)).toBe(true);
      expect(a.authors.length).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(0);
    },
  );

  it.each(files.map((f) => [f.id, f] as const))('%s: existe en public/ con los bytes del manifest', (_id, f) => {
    expect(f.url).toMatch(/^\/assets\//);
    const p = diskPath(f.url);
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).size).toBe(f.bytes);
  });

  it('modelos dentro de presupuesto, en .glb, sin draco ni meshopt', () => {
    for (const m of models) {
      expect(m.url.endsWith('.glb')).toBe(true);
      expect(m.bytes, m.id).toBeLessThanOrEqual(ASSET_BUDGET.modelBytes);
      const json = glbJson(diskPath(m.url));
      const used = [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])];
      expect(used.filter((e) => /draco|meshopt/i.test(e)), m.id).toEqual([]);
    }
  });

  it('modelos con bounding box plausible en metros', () => {
    for (const m of models) {
      expect(m.bbox.size).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(m.bbox.size[i], m.id).toBeCloseTo(m.bbox.max[i] - m.bbox.min[i], 2);
      }
      const longest = Math.max(...m.bbox.size);
      // Del paquete de cigarrillos (~0.1 m) a la persiana o el auto (~4.4 m).
      expect(longest, m.id).toBeGreaterThan(0.05);
      expect(longest, m.id).toBeLessThan(6);
      expect(m.scale).toBeGreaterThan(0);
    }
  });

  it('texturas: albedo sRGB, normal y arm lineales, en webp', () => {
    for (const t of textures) {
      expect(t.maps.diff.colorSpace).toBe('srgb');
      expect(t.maps.nor_gl.colorSpace).toBe('linear');
      expect(t.maps.arm.colorSpace).toBe('linear');
    }
    for (const m of textureMaps) expect(m.url.endsWith('.webp')).toBe(true);
  });

  it('HDRI .hdr dentro de presupuesto', () => {
    for (const h of hdris) {
      expect(h.url.endsWith('.hdr')).toBe(true);
      expect(h.bytes, h.id).toBeLessThanOrEqual(ASSET_BUDGET.hdriBytes);
    }
  });

  it('total coincide con la suma y cabe en 45 MB', () => {
    const sum = files.reduce((s, f) => s + f.bytes, 0);
    expect(TOTAL_BYTES).toBe(sum);
    expect(sum).toBeLessThanOrEqual(ASSET_BUDGET.totalBytes);
    expect(ASSET_BUDGET.totalBytes).toBe(45 * 1024 * 1024);
  });

  it('ninguna URL apunta fuera del sitio (todo offline)', () => {
    for (const f of files) expect(f.url).not.toMatch(/^https?:/);
  });
});
