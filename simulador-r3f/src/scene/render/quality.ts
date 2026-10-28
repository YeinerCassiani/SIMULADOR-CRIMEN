// Calidad adaptativa (spec §4.1). Módulo puro: sin three ni React, para que la
// decisión de nivel se pruebe en vitest sin GPU.
//
// Flujo: drei <PerformanceMonitor> mide FPS en ventanas de 250 ms y dispara
// onIncline/onDecline; QualityMonitor promedia la ventana y llama stepQuality(),
// que aplica pickTier() con histéresis y un "techo" que bloquea el nivel que ya
// falló dos veces (evita oscilar alta↔media en máquinas al límite).
import type { QualityTier } from '../contracts';

/** Orden ascendente de coste. */
export const TIERS: readonly QualityTier[] = ['baja', 'media', 'alta'];

export interface TierConfig {
  /** DPR del Canvas (fuente única: prop dpr del Canvas, nunca setDpr aparte). */
  dpr: number | [number, number];
  /** Sombras dinámicas de la luz clave. En 'baja' no hay sombras (castShadow=false). */
  shadows: boolean;
  /** Tamaño del shadow map de la luz clave (y del foco de trabajo si proyecta). */
  shadowMapSize: number;
  /** N8AO montado siempre; esto lo habilita. */
  ao: boolean;
  /** N8AO a media resolución. */
  aoHalfRes: boolean;
  bloom: boolean;
  smaa: boolean;
  /** ContactShadows (render de profundidad propio): sustituto barato del AO. */
  contactShadows: boolean;
}

// Referencia estable: R3F compara el dpr en cada render del Canvas.
const DPR_ALTA: [number, number] = [1, 2];

export const TIER_CONFIG: Record<QualityTier, TierConfig> = {
  alta: { dpr: DPR_ALTA, shadows: true, shadowMapSize: 2048, ao: true, aoHalfRes: false, bloom: true, smaa: true, contactShadows: false },
  media: { dpr: 1.25, shadows: true, shadowMapSize: 1024, ao: true, aoHalfRes: true, bloom: true, smaa: true, contactShadows: true },
  baja: { dpr: 1, shadows: false, shadowMapSize: 512, ao: false, aoHalfRes: true, bloom: false, smaa: false, contactShadows: true },
};

/**
 * Umbrales absolutos de FPS. La banda muerta entre ambos es la histéresis:
 * bajar exige < 40 fps sostenidos, subir exige ≥ 55. Coinciden con los límites
 * por defecto de PerformanceMonitor en pantallas ≤ 100 Hz ([40, 60]).
 */
export const DECLINE_BELOW_FPS = 40;
export const INCLINE_AT_FPS = 55;

function fpsOf(sample: number | readonly number[]): number {
  if (typeof sample === 'number') return sample;
  if (!sample.length) return NaN;
  // Mediana: una ventana con un tirón (compilación de shaders) no decide sola.
  const s = [...sample].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const rank = (t: QualityTier) => TIERS.indexOf(t);

/**
 * Decide el nivel siguiente. Un paso por llamada (nunca alta→baja de golpe).
 * - userChoice ≠ 'auto' manda siempre.
 * - fps < DECLINE_BELOW_FPS baja un nivel; fps ≥ INCLINE_AT_FPS sube uno, sin pasar de `ceiling`.
 * - Entre ambos umbrales se queda donde está (histéresis).
 */
export function pickTier(
  current: QualityTier,
  fps: number | readonly number[],
  userChoice: 'auto' | QualityTier,
  ceiling: QualityTier = 'alta',
): QualityTier {
  if (userChoice !== 'auto') return userChoice;
  const f = fpsOf(fps);
  if (!Number.isFinite(f)) return current;
  const r = rank(current);
  if (f < DECLINE_BELOW_FPS && r > 0) return TIERS[r - 1];
  if (f >= INCLINE_AT_FPS && r < rank(ceiling)) return TIERS[r + 1];
  return current;
}

/** Memoria del controlador automático: nivel actual y bajadas sufridas por nivel. */
export interface QualityMemory {
  tier: QualityTier;
  failures: Record<QualityTier, number>;
}

/** Bajadas desde un nivel que lo vetan para volver a subir a él. */
export const LOCK_AFTER_FAILURES = 2;

export function initialMemory(tier: QualityTier): QualityMemory {
  return { tier, failures: { alta: 0, media: 0, baja: 0 } };
}

/** Nivel más alto que aún no está vetado. */
export function ceilingOf(mem: QualityMemory): QualityTier {
  for (let i = TIERS.length - 1; i > 0; i--) {
    if (mem.failures[TIERS[i]] < LOCK_AFTER_FAILURES) return TIERS[i];
  }
  return 'baja';
}

/** Paso del controlador automático (puro): aplica pickTier y cuenta las bajadas. */
export function stepQuality(mem: QualityMemory, fps: number | readonly number[]): QualityMemory {
  const next = pickTier(mem.tier, fps, 'auto', ceilingOf(mem));
  if (next === mem.tier) return mem;
  const failures = rank(next) < rank(mem.tier)
    ? { ...mem.failures, [mem.tier]: mem.failures[mem.tier] + 1 }
    : mem.failures;
  return { tier: next, failures };
}

/** Datos del dispositivo para elegir el nivel de arranque. */
export interface DeviceHints {
  cores?: number;
  coarsePointer?: boolean;
  deviceMemoryGb?: number;
}

/** Nivel inicial: 'media' en móvil/táctil o equipos modestos; 'alta' en el resto. */
export function initialTier(h: DeviceHints): QualityTier {
  if (h.coarsePointer) return 'media';
  if (h.cores !== undefined && h.cores <= 4) return 'media';
  if (h.deviceMemoryGb !== undefined && h.deviceMemoryGb <= 4) return 'media';
  return 'alta';
}

/** Lee las pistas del navegador (no puro; aislado aquí para no ensuciar Scene). */
export function probeDevice(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    cores: nav.hardwareConcurrency || undefined,
    deviceMemoryGb: nav.deviceMemory,
    coarsePointer: typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : undefined,
  };
}
