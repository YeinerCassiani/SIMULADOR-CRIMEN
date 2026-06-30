// --- Máquina de estados explícita de las 7 etapas procesales ---
//
// El reducer (`simulator.ts`) ya implementa el flujo E2E con flags booleanos por
// EMP/EF y gating de orden. Esta capa NO duplica esa lógica: la *formaliza* como
// una máquina de estados derivada y pura, para poder consultar de forma explícita
// "¿en qué etapa va este EMP/EF?", "¿cuál es la siguiente?" y "¿qué norma la
// fundamenta?". Es de solo lectura sobre `EvidenceState`; no muta estado.
//
// Fundamento normativo (Ley 906 de 2004, verificado):
//  - Art. 216: aseguramiento, embalaje y custodia para evitar suplantación/alteración.
//  - Art. 254: factores de la cadena (identidad, estado original, recolección,
//    preservación, embalaje, envío, lugares/fechas y registro de cada custodio).
//  - Art. 255: responsabilidad del servidor que entra en contacto con el EMP/EF.
//  El marco operativo es el Manual de Cadena de Custodia de la FGN.

import type { EvidenceState } from './types';

export type StageId =
  | 'ASEGURAMIENTO' // preparación de la escena (etapa global, previa al EMP/EF)
  | 'FIJACION'      // observación + fotografía + señalización
  | 'RECOLECCION'
  | 'EMBALAJE'
  | 'ROTULO'
  | 'CUSTODIA'
  | 'ENTREGA'
  | 'COMPLETADO';

export interface StageDef {
  id: StageId;
  /** Orden 1..7 dentro del ciclo de vida del EMP/EF (ASEGURAMIENTO es 0: global). */
  order: number;
  label: string;
  /** Flags de EvidenceState que deben cumplirse para considerar la etapa superada. */
  requires: (keyof EvidenceState)[];
  /** Fundamento normativo verificable (no decorativo). */
  legalBasis: string;
}

// Definición canónica de las 7 etapas. El orden refleja la secuencia técnica
// exigida por la cadena de custodia: no se puede avanzar sin completar la previa.
export const STAGES: StageDef[] = [
  {
    id: 'ASEGURAMIENTO', order: 0, label: 'Aseguramiento de la escena',
    requires: [],
    legalBasis: 'Ley 906/2004 art. 216 y 255; Manual de Cadena de Custodia FGN: asegurar antes de intervenir.',
  },
  {
    id: 'FIJACION', order: 1, label: 'Fijación (observación, fotografía y señalización)',
    requires: ['photographed', 'marked'],
    legalBasis: 'Ley 906/2004 art. 254: registro del estado original antes de manipular.',
  },
  {
    id: 'RECOLECCION', order: 2, label: 'Recolección técnica',
    requires: ['collected'],
    legalBasis: 'Ley 906/2004 art. 255: responsabilidad en la recolección del EMP/EF.',
  },
  {
    id: 'EMBALAJE', order: 3, label: 'Embalaje',
    requires: ['packaged'],
    legalBasis: 'Ley 906/2004 art. 216: embalaje técnico para evitar alteración o suplantación.',
  },
  {
    id: 'ROTULO', order: 4, label: 'Rótulo',
    requires: ['labeled'],
    legalBasis: 'Ley 906/2004 art. 254: identidad, lugar y fecha registrados en el rótulo.',
  },
  {
    id: 'CUSTODIA', order: 5, label: 'Cadena de custodia',
    requires: ['custody'],
    legalBasis: 'Ley 906/2004 art. 254: registro de custodios y traspasos; continuidad de la cadena.',
  },
  {
    id: 'ENTREGA', order: 6, label: 'Entrega de EMP/EF',
    requires: ['delivered'],
    legalBasis: 'Ley 906/2004 art. 254: envío al destino competente; cierre del tramo de custodia.',
  },
];

// Etapas que pertenecen al ciclo de vida del EMP/EF (excluye ASEGURAMIENTO, que es global).
const ITEM_STAGES = STAGES.filter((s) => s.order > 0);

function stageMet(st: EvidenceState, def: StageDef): boolean {
  return def.requires.every((k) => Boolean(st[k]));
}

/** Etapa actualmente alcanzada por un EMP/EF (la última superada en orden). */
export function currentStage(st: EvidenceState): StageDef {
  let reached: StageDef = STAGES[0]; // ASEGURAMIENTO por defecto
  for (const def of ITEM_STAGES) {
    if (stageMet(st, def)) reached = def;
    else break; // la secuencia es estricta: detenerse en el primer hueco
  }
  // Si entregó, el ciclo está completo.
  if (st.delivered) return { ...STAGES[STAGES.length - 1], id: 'COMPLETADO', label: 'Completado' };
  return reached;
}

/** Siguiente etapa pendiente, o null si el ciclo está completo. */
export function nextStage(st: EvidenceState): StageDef | null {
  for (const def of ITEM_STAGES) {
    if (!stageMet(st, def)) return def;
  }
  return null;
}

/**
 * Determina si una transición a la etapa `target` está habilitada según el orden.
 * Pura: el reducer sigue siendo la autoridad que aplica el scoring; esto solo
 * informa la UI/feedback de forma consistente con ese gating.
 */
export function canTransitionTo(st: EvidenceState, target: StageId): boolean {
  const def = ITEM_STAGES.find((s) => s.id === target);
  if (!def) return false;
  const prev = ITEM_STAGES.filter((s) => s.order < def.order);
  return prev.every((p) => stageMet(st, p));
}

/** Número de etapas del ciclo del EMP/EF superadas (0..7). */
export function stagesCompleted(st: EvidenceState): number {
  return ITEM_STAGES.filter((s) => stageMet(st, s)).length;
}

export const TOTAL_ITEM_STAGES = ITEM_STAGES.length; // = 6 etapas de EMP/EF (7 con aseguramiento global)
