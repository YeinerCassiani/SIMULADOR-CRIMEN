// Datos y geometría puros del render (spec §4.1 "noche de procesamiento"):
// preajustes de luz/atmósfera por ambiente, poses de cámara y desplazamiento óptico por los paneles de la UI.
// Sin three ni React: todo se prueba en quality.test.ts.
import type { EnvironmentType, EvidenceItem } from '../../types';

export type Vec3 = [number, number, number];

export interface NightPreset {
  /** Fondo y niebla (mismo color: el horizonte se funde con el cielo). */
  background: string;
  fogNear: number;
  fogFar: number;
  /** Exposición base del ToneMapping (gl.toneMappingExposure). */
  exposure: number;
  /** Intensidad del IBL (scene.environmentIntensity). Bajo: es de noche. */
  envIntensity: number;
  ambient: { color: string; intensity: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  /** Luna: direccional fría. Exterior = luz clave con sombra; interior = relleno por la ventana sin sombra. */
  moon: { color: string; intensity: number; dir: Vec3; castShadow: boolean };
  /**
   * Lámpara de techo (solo interior): foco cálido SIN sombra (charco de luz) +
   * `lampShadow`, direccional cálida casi cenital que es la luz clave con sombra.
   * Las sombras de spotLight junto al MeshReflectorMaterial del piso interior dan
   * GL_INVALID_OPERATION "Mismatch between texture format and sampler type (shadow)"
   * al montar el interior (medido en Chrome); las direccionales no. Por eso toda
   * sombra dinámica es direccional.
   */
  ceiling: { color: string; intensity: number; position: Vec3; angle: number; penumbra: number } | null;
  lampShadow: { color: string; intensity: number; dir: Vec3 } | null;
  /**
   * Baño de muros (solo interior): direccional sin sombra desde el lado de la
   * cámara de vista general. Las luces del cuarto apuntan al piso y los muros
   * solo recibían luz rasante (se veían marrón oscuro aun con tinte blanco).
   */
  wallWash: { color: string; intensity: number; dir: Vec3 } | null;
}

const INTERIOR: NightPreset = {
  background: '#06080c',
  fogNear: 26,
  fogFar: 62,
  exposure: 2.0,
  envIntensity: 0.3,
  ambient: { color: '#1b2233', intensity: 0.18 },
  hemisphere: { sky: '#2a3854', ground: '#0c0d10', intensity: 0.22 },
  moon: { color: '#8aa6d8', intensity: 0.45, dir: [-0.55, 0.5, -0.42], castShadow: false },
  ceiling: { color: '#ffc78a', intensity: 26, position: [0, 3.6, 0.4], angle: 1.12, penumbra: 0.95 },
  lampShadow: { color: '#ffcf96', intensity: 0.75, dir: [0.12, 1, 0.1] },
  wallWash: { color: '#ffe3c4', intensity: 0.55, dir: [0.62, 0.45, 0.64] },
};

const EXTERIOR: NightPreset = {
  background: '#05080f',
  fogNear: 24,
  fogFar: 70,
  exposure: 2.6,
  envIntensity: 0.35,
  ambient: { color: '#141c2c', intensity: 0.1 },
  hemisphere: { sky: '#22324f', ground: '#08090c', intensity: 0.26 },
  moon: { color: '#a8bde3', intensity: 0.6, dir: [-0.5, 0.72, -0.48], castShadow: true },
  ceiling: null,
  lampShadow: null,
  wallWash: null,
};

const VIAL: NightPreset = {
  ...EXTERIOR,
  background: '#06080e',
  exposure: 2.0,
  hemisphere: { sky: '#1f2d47', ground: '#07080a', intensity: 0.24 },
};

export function nightPreset(env: EnvironmentType): NightPreset {
  return env === 'cerrado' ? INTERIOR : env === 'vial' ? VIAL : EXTERIOR;
}

/**
 * Modo luz forense: factores a los que tienden las luces (transición ~0.6 s).
 * Cálidas al 10 %, relleno frío al 35 %, IBL al 25 %, exposición ×0.8, y una
 * ambiental violeta-azul tenue que nace de 0.
 */
export const FORENSIC = {
  warm: 0.1,
  cool: 0.35,
  env: 0.25,
  exposure: 0.8,
  uvColor: '#5a46ff',
  uvIntensity: 0.32,
  /** Constante de tiempo de la amortiguación exponencial (s): 3τ ≈ 0.6 s. */
  tau: 0.2,
} as const;

/** Amortiguación exponencial independiente del framerate. */
export function damp(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const round2 = (v: number) => Math.round(v * 100) / 100;

// --- Cámara ------------------------------------------------------------------

/** Dirección de la vista general (la de la cámara original [12, 11, 14]). */
export const OVERVIEW_DIR: Vec3 = normalize([12, 11, 14]);
export const OVERVIEW_TARGET: Vec3 = [0, 0.4, 0];
export const CAMERA_LIMITS = { minDistance: 4, maxDistance: 40, maxPolarAngle: Math.PI / 2.15 } as const;

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export interface CameraPose { position: Vec3; target: Vec3 }

/** Vista general: distancia proporcional al tamaño del escenario. */
export function overviewPose(dims: { w: number; d: number }): CameraPose {
  const r = Math.hypot(dims.w, dims.d) / 2;
  const dist = Math.min(34, Math.max(14, r * 2.1));
  return { position: scale(OVERVIEW_DIR, dist, OVERVIEW_TARGET), target: OVERVIEW_TARGET };
}

/** Punto de partida del vuelo de entrada: más alto, más lejos y girado ~35°. */
export function entryPose(dims: { w: number; d: number }): CameraPose {
  const o = overviewPose(dims);
  const dist = Math.hypot(o.position[0], o.position[1], o.position[2]) * 1.45;
  const az = Math.atan2(OVERVIEW_DIR[2], OVERVIEW_DIR[0]) - 0.6;
  const elev = 0.95; // rad (~54°)
  const p: Vec3 = [Math.cos(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.sin(az) * Math.cos(elev) * dist];
  return { position: p.map(round2) as Vec3, target: o.target };
}

/**
 * Encuadre de un EMP/EF: mira a su centro, conserva el azimut actual de la
 * cámara (no desorienta) y baja a ~50° de elevación; distancia según tamaño.
 */
export function framingPose(item: Pick<EvidenceItem, 'x' | 'z' | 'w' | 'd' | 'h'>, cameraPos: Vec3): CameraPose {
  const target: Vec3 = [item.x, Math.max(0.05, item.h / 2), item.z];
  const size = Math.max(item.w, item.d, item.h);
  const dist = Math.min(9, Math.max(4.5, size * 3.2 + 3));
  let az = Math.atan2(cameraPos[2] - target[2], cameraPos[0] - target[0]);
  if (!Number.isFinite(az)) az = Math.atan2(OVERVIEW_DIR[2], OVERVIEW_DIR[0]);
  const elev = 0.88; // rad (~50° sobre el horizonte): lejos del límite maxPolarAngle
  const position: Vec3 = [
    target[0] + Math.cos(az) * Math.cos(elev) * dist,
    target[1] + Math.sin(elev) * dist,
    target[2] + Math.sin(az) * Math.cos(elev) * dist,
  ];
  return { position: position.map(round2) as Vec3, target };
}

function scale(dir: Vec3, s: number, origin: Vec3): Vec3 {
  return [round2(origin[0] + dir[0] * s), round2(origin[1] + dir[1] * s), round2(origin[2] + dir[2] * s)];
}

// --- Paneles de la UI sobre el visor -----------------------------------------

/** Márgenes (px) que tapan los paneles superpuestos de la UI. */
export interface SceneInsets { top: number; right: number; bottom: number; left: number }
export const NO_INSETS: SceneInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Desplazamiento del centro óptico (camera.setViewOffset) para que el centro del
 * encuadre caiga en el centro del área libre y no bajo el inspector.
 * Devuelve null si no hay nada que desplazar o el lienzo es degenerado.
 */
export function viewOffsetFor(insets: SceneInsets, width: number, height: number): { x: number; y: number } | null {
  if (width <= 0 || height <= 0) return null;
  // Si los paneles se comen más del 70 % del ancho/alto, no compensar (diseño móvil/hoja inferior).
  const freeW = width - insets.left - insets.right;
  const freeH = height - insets.top - insets.bottom;
  if (freeW < width * 0.3 || freeH < height * 0.3) return null;
  const x = Math.round((insets.right - insets.left) / 2);
  const y = Math.round((insets.bottom - insets.top) / 2);
  return x === 0 && y === 0 ? null : { x, y };
}

/**
 * Márgenes que tapan los paneles, relativos al lienzo.
 * 1) Si la UI publica --scene-inset-{top,right,bottom,left} (px, relativos al lienzo), mandan.
 * 2) Si no, se deducen de las variables de maquetación de la UI (--rail-w, --top-h,
 *    --insp, --tray-h: bordes de los paneles fijos en coordenadas de ventana) y del
 *    rectángulo real del lienzo, así un lienzo que no ocupa toda la ventana no cuenta doble.
 * Valores ausentes o inválidos = 0.
 */
export function parseInsets(
  read: (name: string) => string,
  canvas: { left: number; top: number; right: number; bottom: number } | null = null,
  viewport: { width: number; height: number } | null = null,
): SceneInsets {
  const px = (n: string) => {
    const v = parseFloat(read(n));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const explicit = ['top', 'right', 'bottom', 'left'].some((k) => read(`--scene-inset-${k}`).trim() !== '');
  if (explicit || !canvas || !viewport) {
    return { top: px('--scene-inset-top'), right: px('--scene-inset-right'), bottom: px('--scene-inset-bottom'), left: px('--scene-inset-left') };
  }
  const r = (v: number) => Math.max(0, Math.round(v));
  return {
    left: r(px('--rail-w') - canvas.left),
    top: r(px('--top-h') - canvas.top),
    right: r(canvas.right - (viewport.width - px('--insp'))),
    bottom: r(canvas.bottom - (viewport.height - px('--tray-h'))),
  };
}

// --- HDRI local --------------------------------------------------------------

/**
 * Busca la URL de un HDRI (.hdr) en el módulo del manifiesto de assets, sea cual
 * sea su forma (lo genera el agente assets). Prefiere uno nocturno; nunca acepta
 * URLs remotas (todo offline).
 */
export function findHdriUrl(mod: unknown): string | null {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v === null || v === undefined || seen.has(v)) return;
    if (typeof v === 'string') {
      if (/\.hdr(\?.*)?$/i.test(v) && !/^[a-z]+:\/\//i.test(v) && !v.startsWith('//')) found.push(v);
      return;
    }
    if (typeof v !== 'object') return;
    seen.add(v);
    for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) walk(child, depth + 1);
  };
  walk(mod, 0);
  if (!found.length) return null;
  return found.find((u) => /night|noche|moon|luna|dusk|dark/i.test(u)) ?? found[0];
}


/** Paso de cámara de los botones de la interfaz: acercar/alejar (m) y girar (rad). */
export function cameraStep(cmd: 'in' | 'out' | 'left' | 'right'): { dolly: number; azimuth: number } {
  switch (cmd) {
    case 'in': return { dolly: 2.5, azimuth: 0 };
    case 'out': return { dolly: -2.5, azimuth: 0 };
    case 'left': return { dolly: 0, azimuth: Math.PI / 8 };
    case 'right': return { dolly: 0, azimuth: -Math.PI / 8 };
  }
}
