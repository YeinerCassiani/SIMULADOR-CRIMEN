// Ruta única de ingreso/salida: placas de paso de protección colocadas a
// intervalos regulares sobre la polilínea de la ruta, evitando los EMP/EF.
import type { EnvironmentType, EvidenceItem } from '../../types';
import { distanceToFootprint } from './latent';

export type XZ = [number, number];

/** Polilínea de la ruta por tipo de ambiente (misma traza que la versión con línea). */
export function routePath(env: EnvironmentType): XZ[] {
  return env === 'cerrado'
    ? [[-6, -4], [-3, -1], [-1, 0], [2, 2.2]]
    : [[-9, -7], [-6, -4], [-2, -2], [2, 0], [5, 3]];
}

export interface StepPlate {
  x: number;
  z: number;
  /** Rotación sobre Y para alinear la placa con el sentido de la ruta. */
  rotY: number;
  /** Índice de la placa desde el ingreso. */
  index: number;
}

/** Espaciado entre placas (m, centro a centro). */
export const STEP_SPACING = 0.78;
/** Holgura mínima entre una placa y la huella de un EMP/EF (m). */
export const STEP_CLEARANCE = 0.35;

/**
 * Placas cada `spacing` metros a lo largo de la polilínea. Se omiten las que
 * caerían sobre un EMP/EF (la ruta nunca pisa un indicio).
 */
export function routeSteps(path: XZ[], items: Pick<EvidenceItem, 'x' | 'z' | 'w' | 'd'>[] = [], spacing = STEP_SPACING): StepPlate[] {
  const out: StepPlate[] = [];
  let carry = spacing / 2; // primera placa a media separación del ingreso
  let index = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    // rotY tal que el eje +X local apunte al sentido de avance.
    const rotY = Math.atan2(-uz, ux);
    let s = carry;
    while (s <= len) {
      const x = ax + ux * s, z = az + uz * s;
      if (!items.some((it) => distanceToFootprint(x, z, it) < STEP_CLEARANCE)) out.push({ x, z, rotY, index: index++ });
      s += spacing;
    }
    carry = s - len;
  }
  return out;
}
