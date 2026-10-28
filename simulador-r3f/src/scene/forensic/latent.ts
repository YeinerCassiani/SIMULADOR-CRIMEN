// Manchas latentes del modo luz forense: dónde aparecen.
// Criterio pedagógico: hay manchas reales junto a los EMP/EF biológicos y unas
// pocas falsas/ambiguas lejos de todo EMP/EF, para que el estudiante no pueda
// inferir "aquí hay un indicio" solo porque algo brilla. Es solo visual.
import type { EvidenceItem } from '../../types';
import { rngFor } from './random';

/** ¿El EMP/EF deja rastro latente (fluorescente) bajo luz forense? */
export function hasLatentTrace(item: Pick<EvidenceItem, 'nature'>): boolean {
  return /biol[oó]g/i.test(item.nature || '');
}

export interface LatentStain {
  x: number;
  z: number;
  /** Radio aproximado en metros. */
  r: number;
  /** Rotación sobre el piso (radianes). */
  rot: number;
  /** Semilla de la forma (textura procedural). */
  seed: number;
  /** 'real' junto a un EMP/EF biológico; 'decoy' falsa/ambigua. */
  kind: 'real' | 'decoy';
  /** Id del EMP/EF de origen (solo las reales). */
  sourceId?: string;
}

/** Distancia del punto al rectángulo de huella del EMP/EF (0 si está dentro). */
export function distanceToFootprint(x: number, z: number, it: Pick<EvidenceItem, 'x' | 'z' | 'w' | 'd'>): number {
  const dx = Math.max(Math.abs(x - it.x) - it.w / 2, 0);
  const dz = Math.max(Math.abs(z - it.z) - it.d / 2, 0);
  return Math.hypot(dx, dz);
}

export const DECOY_COUNT = 3;
/** Separación mínima de una mancha falsa a cualquier EMP/EF. */
export const DECOY_CLEARANCE = 1.6;

/**
 * Lista determinista de manchas para un escenario: 3 reales en arrastre/goteo
 * alrededor de cada EMP/EF biológico (fuera de su huella, para no taparlo) y
 * DECOY_COUNT falsas dentro del área útil y lejos de todo EMP/EF.
 */
export function latentStains(items: EvidenceItem[], scenarioId: string, dims: { w: number; d: number }): LatentStain[] {
  const rnd = rngFor(`latent:${scenarioId}`);
  const out: LatentStain[] = [];
  const halfW = dims.w / 2 - 0.8, halfD = dims.d / 2 - 0.8;
  const clampX = (v: number) => Math.max(-halfW, Math.min(halfW, v));
  const clampZ = (v: number) => Math.max(-halfD, Math.min(halfD, v));

  for (const it of items) {
    if (!hasLatentTrace(it)) continue;
    // Dirección del arrastre/goteo y distancia creciente desde el EMP/EF.
    const dir = rnd() * Math.PI * 2;
    const base = Math.max(it.w, it.d) / 2 + 0.35;
    for (let k = 0; k < 3; k++) {
      const a = dir + (rnd() - 0.5) * 0.7;
      const dist = base + k * 0.55 + rnd() * 0.2;
      out.push({
        x: clampX(it.x + Math.cos(a) * dist),
        z: clampZ(it.z + Math.sin(a) * dist),
        r: 0.34 - k * 0.07 + rnd() * 0.06,
        rot: rnd() * Math.PI * 2,
        seed: Math.floor(rnd() * 1e9),
        kind: 'real',
        sourceId: it.id,
      });
    }
  }

  let guard = 0;
  let decoys = 0;
  while (decoys < DECOY_COUNT && guard++ < 400) {
    const x = (rnd() * 2 - 1) * halfW;
    const z = (rnd() * 2 - 1) * halfD;
    if (items.some((it) => distanceToFootprint(x, z, it) < DECOY_CLEARANCE)) continue;
    if (out.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) continue;
    out.push({ x, z, r: 0.2 + rnd() * 0.16, rot: rnd() * Math.PI * 2, seed: Math.floor(rnd() * 1e9), kind: 'decoy' });
    decoys++;
  }
  return out;
}
