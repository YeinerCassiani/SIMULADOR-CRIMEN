// Trípodes de luz de trabajo: dónde se paran y a dónde apuntan.
import type { EvidenceItem } from '../../types';
import { distanceToFootprint } from './latent';

export interface WorkLightPlacement {
  /** Pie del trípode en el piso. */
  x: number;
  z: number;
  /** Punto al que apunta (centroide de los EMP/EF). */
  target: [number, number];
}

/** Altura del foco sobre el piso (m). */
export const WORK_LIGHT_HEIGHT = 2.1;
/** Holgura mínima entre un trípode y la huella de un EMP/EF (m). */
export const WORK_LIGHT_CLEARANCE = 0.9;

export function evidenceCentroid(items: Pick<EvidenceItem, 'x' | 'z'>[]): [number, number] {
  if (!items.length) return [0, 0];
  const sx = items.reduce((a, it) => a + it.x, 0);
  const sz = items.reduce((a, it) => a + it.z, 0);
  return [sx / items.length, sz / items.length];
}

/**
 * Dos trípodes en esquinas opuestas de la caja que envuelve los EMP/EF
 * (ampliada 1.4 m), dentro del área de la escena y apuntando al centroide.
 * Si una esquina queda pegada a un EMP/EF se desliza por el borde hasta liberar.
 * Siempre devuelve 2: la cantidad de luces es fija (no se recompilan shaders).
 */
export function workLightPlacements(items: EvidenceItem[], dims: { w: number; d: number }): WorkLightPlacement[] {
  const target = evidenceCentroid(items);
  const xs = items.map((i) => i.x), zs = items.map((i) => i.z);
  const pad = 1.4;
  const minX = (xs.length ? Math.min(...xs) : -2) - pad, maxX = (xs.length ? Math.max(...xs) : 2) + pad;
  const minZ = (zs.length ? Math.min(...zs) : -2) - pad, maxZ = (zs.length ? Math.max(...zs) : 2) + pad;
  const hx = dims.w / 2 - 0.6, hz = dims.d / 2 - 0.6;
  const clamp = (v: number, h: number) => Math.max(-h, Math.min(h, v));
  const corners: [number, number][] = [[minX, maxZ], [maxX, minZ]];
  const blocked = (x: number, z: number) => items.some((it) => distanceToFootprint(x, z, it) < WORK_LIGHT_CLEARANCE);
  return corners.map(([cx, cz], i) => {
    let x = clamp(cx, hx);
    const z = clamp(cz, hz);
    // Desliza a lo largo de X (hacia el centro) en pasos de 0.3 m hasta liberar.
    const step = i === 0 ? 0.3 : -0.3;
    for (let k = 0; k < 60 && blocked(x, z); k++) x = clamp(x + step, hx);
    return { x, z, target };
  });
}
