// Distribución de los ambientes (spec §4.1). Módulo PURO: sin three ni React,
// para que vitest valide el layout (colisiones con EMP/EF, ruta, presupuesto)
// sin GPU. Los componentes de env/ solo dibujan lo que este módulo decide.
//
// Convenciones: metros, Y arriba; la escena ocupa x∈[-w/2, w/2], z∈[-d/2, d/2].
// La cámara inicial está en (+x, +z): los muros -x y -z son completos y los
// muros +x y +z quedan bajos para no tapar la vista. Los modelos de Poly Haven
// miran hacia +Z: rotY = π/2 los hace mirar a +X, π a -Z, -π/2 a -X.
import { MODELS, TEXTURES, type ModelId, type TextureId } from '../../assets/manifest';
import type { EnvironmentType, EvidenceItem, Scenario } from '../../types';

export type XZ = [number, number];

// ---------------------------------------------------------------------------
// Arquitectura interior
// ---------------------------------------------------------------------------

/** Altura de muro (sin techo: la cámara es orbital). */
export const WALL_HEIGHT = 2.6;
/** Grosor de muro. */
export const WALL_T = 0.15;
/** Altura de los muros cercanos a la cámara (+x, +z), recortados para no tapar. */
export const KNEE_HEIGHT = 0.4;
/** Zócalo de madera. */
export const BASEBOARD_H = 0.1;

/** Vano en un muro, en coordenada local u (a lo largo del muro, centro 0). */
export interface Opening {
  kind: 'door' | 'window';
  /** Centro del vano sobre el muro (m, desde el centro del muro). */
  center: number;
  width: number;
  /** Altura inferior (0 en puertas, alféizar en ventanas). */
  bottom: number;
  top: number;
}

/** Trozo rectangular de muro en coordenadas locales (u a lo largo, y vertical). */
export interface WallPiece { u0: number; u1: number; y0: number; y1: number }

/**
 * Parte un muro de largo `length` y alto `height` en piezas que rodean los vanos.
 * Columnas completas entre vanos, y sobre/bajo cada vano un dintel/antepecho.
 * Los vanos se recortan al muro; los solapados se procesan en orden de u.
 */
export function wallPieces(length: number, height: number, openings: readonly Opening[] = []): WallPiece[] {
  const half = length / 2;
  const ops = openings
    .map((o) => ({ ...o, a: Math.max(-half, o.center - o.width / 2), b: Math.min(half, o.center + o.width / 2) }))
    .filter((o) => o.b > o.a)
    .sort((p, q) => p.a - q.a);
  const out: WallPiece[] = [];
  let cursor = -half;
  for (const o of ops) {
    if (o.a > cursor) out.push({ u0: cursor, u1: o.a, y0: 0, y1: height });
    const u0 = Math.max(cursor, o.a);
    if (o.b > u0) {
      if (o.bottom > 0) out.push({ u0, u1: o.b, y0: 0, y1: Math.min(o.bottom, height) });
      if (o.top < height) out.push({ u0, u1: o.b, y0: Math.max(o.top, 0), y1: height });
    }
    cursor = Math.max(cursor, o.b);
  }
  if (cursor < half) out.push({ u0: cursor, u1: half, y0: 0, y1: height });
  return out.filter((p) => p.u1 - p.u0 > 1e-6 && p.y1 - p.y0 > 1e-6);
}

export interface InteriorShell {
  /** Muro -z (fondo, completo). */
  back: Opening[];
  /** Muro -x (izquierdo, completo). */
  left: Opening[];
}

/**
 * Vanos por decoración. La puerta va en el muro -x a la altura del inicio de la
 * ruta de ingreso de 'cerrado' (−6, −4): la ruta empieza visiblemente en la puerta.
 * En el muro -x, u crece hacia +z.
 */
export function interiorShell(decor: string | undefined): InteriorShell {
  const door: Opening = { kind: 'door', center: -4.2, width: 0.95, bottom: 0, top: 2.1 };
  if (decor === 'vivienda') {
    return {
      back: [{ kind: 'window', center: -3.6, width: 1.5, bottom: 0.95, top: 2.15 }],
      left: [door, { kind: 'window', center: 3.4, width: 1.2, bottom: 1.0, top: 2.1 }],
    };
  }
  return {
    back: [{ kind: 'window', center: 0.9, width: 1.9, bottom: 0.95, top: 2.15 }, { kind: 'window', center: 5.6, width: 1.3, bottom: 1.15, top: 2.15 }],
    left: [door],
  };
}

// ---------------------------------------------------------------------------
// Texturas: repeat según metros reales
// ---------------------------------------------------------------------------

/** Lado real (m) que cubre una repetición de cada textura 1k de Poly Haven. */
export const TEXTURE_TILE_M: Record<TextureId, number> = {
  wood_floor: 2.0,
  terracotta_floor_tiles: 1.6,
  white_plaster_02: 2.5,
  dark_wood: 1.0,
  asphalt_02: 4.0,
  pavement_02: 2.0,
  sparse_grass: 2.5,
  forest_ground_05: 3.0,
  red_brick: 1.6,
};

/** Repeticiones para cubrir `meters` con baldosas de `tile` m (mín. 0.01, 3 decimales). */
export function repeatFor(meters: number, tile: number): number {
  if (!(tile > 0) || !(meters > 0)) return 1;
  return Math.max(0.01, Math.round((meters / tile) * 1000) / 1000);
}

/** Repeat [u, v] de una superficie de `w`×`h` m con la textura `tex`. */
export function surfaceRepeat(tex: TextureId, w: number, h: number): [number, number] {
  const t = TEXTURE_TILE_M[tex];
  return [repeatFor(w, t), repeatFor(h, t)];
}

/** Anisotropía por nivel de calidad (8 solo en alta). */
export function anisotropyFor(tier: 'alta' | 'media' | 'baja'): number {
  return tier === 'alta' ? 8 : tier === 'media' ? 4 : 1;
}

// ---------------------------------------------------------------------------
// Mobiliario y props
// ---------------------------------------------------------------------------

/** Procedurales (sin GLB): los dibuja env/props.tsx. */
export type ProcKind = 'counter' | 'carCrash' | 'cone' | 'bedsideLamp' | 'plant' | 'jersey';

/** Cómo se apoya un modelo respecto a (x, y, z). */
export type Anchor = 'floor' | 'ceiling' | 'wall';

export interface Placement {
  key: string;
  model?: ModelId;
  proc?: ProcKind;
  x: number;
  z: number;
  rotY: number;
  /** Altura de apoyo: piso (0), sobre otro mueble, techo (para 'ceiling'), centro (para 'wall'). */
  y?: number;
  anchor?: Anchor;
  /** Tamaño local antes de rotar [ancho X, alto Y, fondo Z] (m). */
  size: [number, number, number];
  /** Ocupa piso: cuenta para colisiones con EMP/EF, ruta y otros muebles. */
  solid: boolean;
  /** Decorado fuera del área de la escena (detrás del cordón): no se valida contra límites. */
  outside?: boolean;
}

const SIZE_PROC: Record<ProcKind, [number, number, number]> = {
  counter: [1.6, 0.92, 0.62],
  carCrash: [3.9, 1.45, 1.75],
  cone: [0.42, 0.6, 0.42],
  bedsideLamp: [0.22, 0.45, 0.22],
  plant: [0.62, 1.2, 0.62],
  jersey: [1.6, 0.82, 0.6],
};

function m(key: string, model: ModelId, x: number, z: number, rotY = 0, opts: Partial<Placement> = {}): Placement {
  const s = MODELS[model].bbox.size;
  return { key, model, x, z, rotY, size: [s[0], s[1], s[2]], solid: true, ...opts };
}

function p(key: string, proc: ProcKind, x: number, z: number, rotY = 0, opts: Partial<Placement> = {}): Placement {
  return { key, proc, x, z, rotY, size: SIZE_PROC[proc], solid: true, ...opts };
}

/** Desplazamiento local que lleva el bbox del modelo al punto de apoyo (centrado en X/Z). */
export function anchorOffset(bbox: { min: readonly number[]; max: readonly number[] }, anchor: Anchor = 'floor'): [number, number, number] {
  const cx = (bbox.min[0] + bbox.max[0]) / 2;
  const cz = (bbox.min[2] + bbox.max[2]) / 2;
  if (anchor === 'ceiling') return [-cx, -bbox.max[1], -cz];
  if (anchor === 'wall') return [-cx, -(bbox.min[1] + bbox.max[1]) / 2, -bbox.min[2]];
  return [-cx, -bbox.min[1], -cz];
}

/** Medio ancho/fondo (x, z) del rectángulo del mueble una vez rotado (AABB conservador). */
export function footprintHalf(pl: Pick<Placement, 'size' | 'rotY'>): XZ {
  const [w, , d] = pl.size;
  const c = Math.abs(Math.cos(pl.rotY)), s = Math.abs(Math.sin(pl.rotY));
  return [(w * c + d * s) / 2, (w * s + d * c) / 2];
}

/** Distancia entre dos rectángulos alineados (0 si se tocan o se solapan). */
export function rectGap(a: { x: number; z: number; hx: number; hz: number }, b: { x: number; z: number; hx: number; hz: number }): number {
  const dx = Math.max(Math.abs(a.x - b.x) - a.hx - b.hx, 0);
  const dz = Math.max(Math.abs(a.z - b.z) - a.hz - b.hz, 0);
  return Math.hypot(dx, dz);
}

export function placementRect(pl: Placement) {
  const [hx, hz] = footprintHalf(pl);
  return { x: pl.x, z: pl.z, hx, hz };
}

export function evidenceRect(it: Pick<EvidenceItem, 'x' | 'z' | 'w' | 'd'>) {
  return { x: it.x, z: it.z, hx: it.w / 2, hz: it.d / 2 };
}

/** Distancia de un punto a un segmento. */
export function pointSegmentDistance(px: number, pz: number, a: XZ, b: XZ): number {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / len2));
  return Math.hypot(px - (a[0] + vx * t), pz - (a[1] + vz * t));
}

/** Distancia de una polilínea al rectángulo (muestreo cada 5 cm: suficiente para holguras de decímetros). */
export function polylineRectGap(path: readonly XZ[], r: { x: number; z: number; hx: number; hz: number }): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      best = Math.min(best, rectGap({ x, z, hx: 0, hz: 0 }, r));
    }
  }
  return best;
}

/** Holgura mínima mueble ↔ EMP/EF: ningún indicio queda dentro ni pegado a un mueble. */
export const EVIDENCE_CLEARANCE = 0.3;

// Presupuesto de triángulos: potted_plant_02 (70k), concrete_road_barrier (61k) y
// fire_hydrant (86k) duplicaban la geometría del ambiente para piezas secundarias;
// se usan procedurales (planta, barrera tipo New Jersey) y el hidrante se omite.

// --- Apartamento (sala-comedor): puerta en -x (z≈-4.2), ventanas al fondo ---
export function apartmentLayout(): Placement[] {
  const H = WALL_HEIGHT;
  return [
    // Sala: TV contra el muro -x, sofá enfrentado, mesa de centro entre ambos.
    m('tv-cabinet', 'modern_wooden_cabinet', -7.72, 0.9, Math.PI / 2),
    m('tv', 'Television_01', -7.7, 0.9, Math.PI / 2, { y: 0.68, solid: false }),
    m('sofa', 'sofa_02', -5.0, 0.9, -Math.PI / 2),
    m('pillows', 'throw_pillows_01', -5.05, 0.9, -Math.PI / 2, { y: 0.41, solid: false }),
    m('coffee-table', 'modern_coffee_table_01', -6.3, 0.9, 0),
    m('armchair', 'ArmChair_01', -6.3, -1.35, 0.55),
    m('side-table', 'side_table_01', -5.0, 2.3, 0),
    m('frame-tv', 'hanging_picture_frame_01', -8 + 0.005, 0.9, Math.PI / 2, { y: 1.65, anchor: 'wall', solid: false }),
    m('pendant-living', 'modern_ceiling_lamp_01', -6.2, 0.9, 0, { y: H, anchor: 'ceiling', solid: false }),
    // Comedor contra el muro del fondo.
    m('dining-table', 'dining_table', 2.6, -4.2, 0),
    m('chair-n1', 'dining_chair_02', 2.0, -5.32, 0),
    m('chair-n2', 'dining_chair_02', 3.2, -5.32, 0),
    m('chair-s1', 'dining_chair_02', 2.0, -3.08, Math.PI),
    m('chair-s2', 'dining_chair_02', 3.2, -3.08, Math.PI),
    m('pendant-dining', 'modern_ceiling_lamp_01', 2.6, -4.2, 0, { y: H, anchor: 'ceiling', solid: false }),
    // Cocina en línea al fondo derecho.
    m('pantry', 'drawer_cabinet', 4.95, -5.73, 0),
    p('counter', 'counter', 6.42, -5.67, 0),
    m('stove', 'electric_stove', 7.6, -5.66, 0),
    // Plantas en esquinas libres.
    p('plant-back', 'plant', -7.4, -5.4, 0.4),
    p('plant-front', 'plant', 7.3, 5.25, 2.1),
    m('frame-back', 'hanging_picture_frame_01', -2.6, -6 + 0.005, 0, { y: 1.55, anchor: 'wall', solid: false }),
  ];
}

// --- Vivienda (dormitorio): cama al fondo, armario en -x, cómoda al fondo derecho ---
export function viviendaLayout(): Placement[] {
  const H = WALL_HEIGHT;
  return [
    m('bed', 'GothicBed_01', 0.6, -4.93, 0),
    m('nightstand-l', 'ClassicNightstand_01', -0.6, -5.72, 0),
    m('nightstand-r', 'ClassicNightstand_01', 1.8, -5.72, 0),
    p('bedside-lamp', 'bedsideLamp', 1.8, -5.72, 0, { y: 0.7, solid: false }),
    m('frame-bed', 'hanging_picture_frame_01', 0.6, -6 + 0.005, 0, { y: 2.02, anchor: 'wall', solid: false }),
    m('pendant', 'modern_ceiling_lamp_01', 0.4, -1.6, 0, { y: H, anchor: 'ceiling', solid: false }),
    m('wardrobe', 'drawer_cabinet', -7.73, 0.6, Math.PI / 2),
    m('dresser', 'modern_wooden_cabinet', 5.2, -5.72, 0),
    m('tv', 'Television_01', 5.2, -5.74, 0, { y: 0.68, solid: false }),
    m('armchair', 'ArmChair_01', 6.9, -3.3, -2.2),
    m('desk', 'side_table_01', -7.45, 3.2, 0),
    m('desk-chair', 'dining_chair_02', -6.75, 3.2, -Math.PI / 2),
    m('box-1', 'cardboard_box_01', -7.5, -1.0, 0.2),
    m('box-2', 'cardboard_box_01', -7.45, -1.7, -0.15),
    p('plant', 'plant', 7.3, 5.2, 1.3),
  ];
}

// --- Parque: sendero curvo, faroles sodio, bancas ---
/** Eje del sendero del parque (pasa por EMP-A02 "sobre sendero"). */
export const PARK_PATH: readonly XZ[] = [[-15, -4.4], [-6, -3.9], [0, -3.5], [15, -0.8]];
export const PARK_PATH_WIDTH = 2.4;

export function parkLayout(): Placement[] {
  return [
    m('lamp-1', 'street_lamp_01', -5.8, -5.25, 0),
    m('lamp-2', 'street_lamp_01', 7.4, 0.35, Math.PI),
    m('lamp-3', 'street_lamp_01', -3.2, 4.3, 0),
    m('bench-1', 'painted_wooden_bench', -2.5, -5.6, 0.04),
    m('bench-2', 'painted_wooden_bench', 4.6, 0.75, Math.PI + 0.18),
    m('trashbag', 'trashbag', -1.35, -5.75, 0.6),
  ];
}

// --- Vía: calzada en X, bordillo, aceras, fachada al fondo ---
/** Medio ancho de la calzada (asfalto). */
export const ROAD_HALF = 4.0;
export const CURB_W = 0.18;
export const CURB_H = 0.15;
/** Borde exterior de la acera del lado -z (pie de la fachada). */
export const FACADE_Z = -10.4;
/** Acera del lado +z hasta aquí; después, berma de pasto. */
export const SIDEWALK_PLUS_Z = 7.2;

export function roadLayout(): Placement[] {
  return [
    p('crash-car', 'carCrash', 0.55, -3.12, 0),
    m('parked-car', 'covered_car', -4.0, 2.95, Math.PI / 2),
    p('cone-1', 'cone', -2.6, -3.55),
    p('cone-2', 'cone', 3.1, -1.25),
    p('cone-3', 'cone', -3.1, 0.35),
    p('cone-4', 'cone', 7.0, 1.2),
    p('cone-5', 'cone', 8.3, 0.0),
    p('barrier-1', 'jersey', 9.3, -2.0, Math.PI / 2),
    p('barrier-2', 'jersey', 9.3, 2.1, Math.PI / 2),
    m('lamp-1', 'street_lamp_01', -2.5, -5.3, 0),
    m('lamp-2', 'street_lamp_01', 6.0, 5.4, Math.PI),
    m('lamp-3', 'street_lamp_01', -5.6, 5.4, Math.PI),
    m('utility', 'utility_box_02', 3.4, -6.55, 0),
    m('dumpster', 'metal_trash_can', -3.6, -9.85, 0, { outside: true }),
    m('shutter', 'rollershutter_door', 5.0, FACADE_Z + 0.16, 0, { outside: true, solid: false }),
  ];
}

/** Tramos de bordillo en X, dejando rampas donde la ruta de ingreso cruza el borde. */
export function curbSpans(len: number, gaps: readonly [number, number][]): [number, number][] {
  const half = len / 2;
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cursor = -half;
  for (const [a, b] of sorted) {
    if (a > cursor) out.push([cursor, Math.min(a, half)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < half) out.push([cursor, half]);
  return out.filter(([a, b]) => b - a > 1e-6);
}

/** X donde una polilínea cruza la línea z = zLine (para abrir rampas en el bordillo). */
export function crossingsAtZ(path: readonly XZ[], zLine: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    if ((az - zLine) * (bz - zLine) > 0 || az === bz) continue;
    const t = (zLine - az) / (bz - az);
    const x = ax + (bx - ax) * t;
    if (!xs.some((v) => Math.abs(v - x) < 1e-6)) xs.push(x);
  }
  return xs;
}

// ---------------------------------------------------------------------------
// Árboles y arbustos procedurales (instanciados)
// ---------------------------------------------------------------------------

export interface TreeSpot { x: number; z: number; s: number }

/** Árboles dentro (lejos de EMP/EF y ruta) y fuera del área; sobre todo al fondo (-x, -z). */
export function treeSpots(env: EnvironmentType): TreeSpot[] {
  if (env === 'abierto') {
    return [
      // Dentro del área solo al fondo y a los lados: los del frente tapaban la vista inicial.
      { x: -8.6, z: 0.6, s: 1.0 }, { x: -2.2, z: 6.3, s: 0.75 },
      { x: 8.6, z: -4.3, s: 0.95 }, { x: -1.2, z: -6.9, s: 1.1 },
      { x: -13, z: -10, s: 1.3 }, { x: -6, z: -11.5, s: 1.2 }, { x: 3.5, z: -12, s: 1.35 },
      { x: 12.5, z: -9.5, s: 1.15 }, { x: -14, z: -3, s: 1.25 }, { x: -13.5, z: 6, s: 1.1 },
      { x: 14.5, z: -3.5, s: 1.0 },
    ];
  }
  if (env === 'vial') {
    return [
      // Lejos de la cámara (+z) para no tapar testigos ni calzada.
      { x: -17, z: 12, s: 1.2 }, { x: -10, z: 15, s: 1.1 }, { x: -2, z: 16.5, s: 1.2 },
      { x: 8, z: 16, s: 1.0 }, { x: 18, z: 12, s: 1.1 },
    ];
  }
  return [];
}

/** Arbustos bajos: masas de copa a ras de piso. */
export function bushSpots(env: EnvironmentType): TreeSpot[] {
  if (env === 'abierto') {
    return [
      { x: -9.0, z: 6.6, s: 0.6 }, { x: 0.8, z: 7.0, s: 0.5 }, { x: 9.2, z: -1.6, s: 0.55 },
      { x: -9.3, z: -2.6, s: 0.5 }, { x: 5.6, z: -6.8, s: 0.55 }, { x: -4.4, z: -7.4, s: 0.5 },
    ];
  }
  if (env === 'vial') return [{ x: -10, z: 9.4, s: 0.6 }, { x: 4.5, z: 9.6, s: 0.55 }, { x: 12, z: 9.2, s: 0.6 }];
  return [];
}

/** Generador determinista (mulberry32): mismo árbol en cada montaje. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Blob { x: number; y: number; z: number; r: number; color: string }
export interface Trunk { x: number; z: number; h: number; r: number }

const CANOPY = ['#1f4a2c', '#2a5a32', '#24502e', '#30603a', '#1b4229', '#3a6a3c'];

/**
 * Copas de 3-5 masas por árbol, con variación de tamaño y verde. Determinista por semilla.
 * Arbustos: 2-3 masas a ras de piso.
 */
export function treeGeometry(trees: readonly TreeSpot[], bushes: readonly TreeSpot[], seed = 7): { trunks: Trunk[]; blobs: Blob[] } {
  const rnd = seeded(seed);
  const trunks: Trunk[] = [];
  const blobs: Blob[] = [];
  for (const t of trees) {
    const h = 2.1 * t.s;
    trunks.push({ x: t.x, z: t.z, h, r: 0.17 * t.s });
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.8;
      const rad = i === 0 ? 0 : (0.55 + rnd() * 0.35) * t.s;
      blobs.push({
        x: t.x + Math.cos(a) * rad,
        y: h + (i === 0 ? 0.9 : 0.35 + rnd() * 0.7) * t.s,
        z: t.z + Math.sin(a) * rad,
        r: (i === 0 ? 1.15 : 0.7 + rnd() * 0.35) * t.s,
        color: CANOPY[Math.floor(rnd() * CANOPY.length)],
      });
    }
  }
  for (const b of bushes) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      blobs.push({
        x: b.x + (rnd() - 0.5) * 0.9 * b.s * 2,
        y: 0.35 * b.s,
        z: b.z + (rnd() - 0.5) * 0.7 * b.s * 2,
        r: (0.55 + rnd() * 0.25) * b.s * 1.4,
        color: CANOPY[Math.floor(rnd() * CANOPY.length)],
      });
    }
  }
  return { trunks, blobs };
}

// ---------------------------------------------------------------------------
// Selección por escenario
// ---------------------------------------------------------------------------

export type EnvKind = 'apartamento' | 'vivienda' | 'abierto' | 'vial';

export function envKind(sc: Pick<Scenario, 'environmentType' | 'decor'>): EnvKind {
  if (sc.environmentType === 'vial') return 'vial';
  if (sc.environmentType === 'abierto') return 'abierto';
  return sc.decor === 'vivienda' ? 'vivienda' : 'apartamento';
}

export function baseLayout(kind: EnvKind): Placement[] {
  switch (kind) {
    case 'vivienda': return viviendaLayout();
    case 'abierto': return parkLayout();
    case 'vial': return roadLayout();
    default: return apartmentLayout();
  }
}

/**
 * Layout final del escenario: el base del ambiente menos lo que choque con un
 * EMP/EF o se salga del área. Así un escenario del docente con indicios en
 * otras coordenadas nunca queda con un indicio dentro de un mueble: el mueble
 * se omite. Los colgados y los apoyados sobre otro mueble caen con su soporte.
 */
export function layoutFor(sc: Pick<Scenario, 'environmentType' | 'decor' | 'dimensions' | 'evidenceItems'>, clearance = EVIDENCE_CLEARANCE): Placement[] {
  const base = baseLayout(envKind(sc));
  const { w, d } = sc.dimensions;
  const dropped = new Set<string>();
  for (const pl of base) {
    if (!pl.solid) continue;
    const r = placementRect(pl);
    const inside = pl.outside || (Math.abs(pl.x) + r.hx <= w / 2 + 1e-6 && Math.abs(pl.z) + r.hz <= d / 2 + 1e-6);
    const hits = sc.evidenceItems.some((it) => rectGap(r, evidenceRect(it)) < clearance);
    if (!inside || hits) dropped.add(pl.key);
  }
  return base.filter((pl) => {
    if (dropped.has(pl.key)) return false;
    if (pl.solid) return true;
    // Un no-sólido apoyado (y > 0, ancla piso) sobre un mueble eliminado también cae.
    if ((pl.anchor ?? 'floor') === 'floor' && (pl.y ?? 0) > 0) {
      const support = base.find((q) => q.solid && rectGap(placementRect(q), { x: pl.x, z: pl.z, hx: 0, hz: 0 }) === 0);
      if (support && dropped.has(support.key)) return false;
    }
    return true;
  });
}

/** Modelos distintos del layout (un modelo repetido se descarga una vez). */
export function layoutModels(pls: readonly Placement[]): ModelId[] {
  return [...new Set(pls.flatMap((pl) => (pl.model ? [pl.model] : [])))];
}

/** Texturas que usa cada ambiente (para presupuesto y precarga). */
export function envTextures(kind: EnvKind): TextureId[] {
  switch (kind) {
    case 'apartamento': return ['wood_floor', 'white_plaster_02', 'dark_wood', 'pavement_02'];
    case 'vivienda': return ['terracotta_floor_tiles', 'white_plaster_02', 'dark_wood', 'pavement_02'];
    case 'abierto': return ['sparse_grass', 'pavement_02', 'forest_ground_05'];
    case 'vial': return ['asphalt_02', 'pavement_02', 'red_brick', 'sparse_grass'];
  }
}

/** Bytes que descarga un escenario (modelos únicos + texturas). Presupuesto del spec: ≤ 20 MB. */
export function scenarioBytes(sc: Pick<Scenario, 'environmentType' | 'decor' | 'dimensions' | 'evidenceItems'>): number {
  const models = layoutModels(layoutFor(sc)).reduce((a, id) => a + MODELS[id].bytes, 0);
  const tex = envTextures(envKind(sc)).reduce((a, id) => {
    const mp = TEXTURES[id].maps;
    return a + mp.diff.bytes + mp.nor_gl.bytes + mp.arm.bytes;
  }, 0);
  return models + tex;
}

export const SCENARIO_BUDGET_BYTES = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Luces locales (prácticas)
// ---------------------------------------------------------------------------

/** Factor de intensidad de las luces locales en modo luz forense (la penumbra la lleva render). */
export const FORENSIC_DIM = 0.15;

/**
 * Intensidad (cd) de las luces prácticas. Calibrada en la integración contra la
 * eval visual: a 3.9 m, 48 cd daban ~3 lux en el piso y el farol no dejaba
 * charco; el contraste de noche sale de charcos de luz sobre un relleno bajo.
 */
export const STREET_LAMP_CD = 240;
export const PENDANT_CD = { apartamento: 34, vivienda: 140 } as const;

export function practicalIntensity(base: number, forensicLight: boolean): number {
  return forensicLight ? base * FORENSIC_DIM : base;
}

/** Solo la primera luz local proyecta sombra, y solo en calidad alta (una pasada de spot). */
export function practicalShadow(index: number, tier: 'alta' | 'media' | 'baja'): boolean {
  return tier === 'alta' && index === 0;
}

// ---------------------------------------------------------------------------
// Cinta de sendero (geometría pura: posiciones XZ + UV en metros)
// ---------------------------------------------------------------------------

export interface Ribbon { positions: number[]; uvs: number[]; indices: number[] }

/**
 * Malla plana a lo largo de una polilínea, de ancho `width`, a la altura `y`.
 * UV en metros (u a lo largo, v a lo ancho): el material usa repeat = 1/lado.
 * En las esquinas usa la normal promediada (sin huecos entre tramos).
 */
export function ribbon(path: readonly XZ[], width: number, y = 0): Ribbon {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const h = width / 2;
  let along = 0;
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
    let tx = next[0] - prev[0], tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx; // normal a la izquierda
    if (i > 0) along += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    const [x, z] = path[i];
    positions.push(x + nx * h, y, z + nz * h, x - nx * h, y, z - nz * h);
    uvs.push(along, 0, along, width);
    if (i > 0) {
      const a = (i - 1) * 2, b = a + 1, c = a + 2, d = a + 3;
      // Cara hacia +Y (orden antihorario visto desde arriba).
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, uvs, indices };
}
