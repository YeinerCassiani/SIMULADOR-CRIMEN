// Editor de casos del docente (lógica pura, probada en caseEditor.test.ts): borrador
// en lenguaje de formulario, validación con mensajes llanos y conversión al modelo
// Scenario que usa el simulador. El docente nunca ve JSON.
import type { EnvironmentType, PackagingId, Scenario } from '../types';

export interface EnvChoice {
  key: string;
  label: string;
  environmentType: EnvironmentType;
  decor?: string;
  dims: { w: number; d: number };
  location: string;
}

export const ENVIRONMENTS: EnvChoice[] = [
  { key: 'apartamento', label: 'Apartamento (lugar cerrado)', environmentType: 'cerrado', decor: 'apartamento', dims: { w: 16, d: 12 }, location: 'Apartamento urbano - sala y comedor' },
  { key: 'vivienda', label: 'Vivienda, dormitorio (lugar cerrado)', environmentType: 'cerrado', decor: 'vivienda', dims: { w: 16, d: 12 }, location: 'Vivienda - dormitorio' },
  { key: 'parque', label: 'Parque público (lugar abierto)', environmentType: 'abierto', dims: { w: 20, d: 16 }, location: 'Parque público - sendero y zona verde' },
  { key: 'via', label: 'Vía pública (siniestro vial)', environmentType: 'vial', dims: { w: 20, d: 16 }, location: 'Vía pública - calzada y bermas' },
];

export interface NatureChoice { value: string; label: string; size: { w: number; d: number; h: number } }

export const NATURES: NatureChoice[] = [
  { value: 'balística', label: 'Balística (vainilla, proyectil)', size: { w: 0.55, d: 0.35, h: 0.15 } },
  { value: 'digital', label: 'Digital (celular, cámara, memoria)', size: { w: 0.8, d: 0.45, h: 0.14 } },
  { value: 'biológica', label: 'Biológica (mancha, fluido, prenda)', size: { w: 1.0, d: 0.6, h: 0.08 } },
  { value: 'documental', label: 'Documental (papel, cuaderno)', size: { w: 1.0, d: 0.65, h: 0.04 } },
  { value: 'física', label: 'Física (objeto, arma blanca, contundente)', size: { w: 1.0, d: 0.45, h: 0.3 } },
  { value: 'traza', label: 'Traza (vidrio, fibra, pintura)', size: { w: 0.55, d: 0.32, h: 0.12 } },
];

export interface ItemDraft {
  name: string;
  nature: string;
  description: string;
  correctPackaging: PackagingId | '';
  labDestination: string;
  /** null hasta que el docente lo ubica en el plano. */
  x: number | null;
  z: number | null;
}

export interface WitnessDraft { name: string; mustBeSeparated: boolean; hasRelevantInfo: boolean }

export interface CaseDraft {
  title: string;
  env: string;
  narrative: string;
  nunc: string;
  penalReference: string;
  searchMethod: string;
  witnesses: WitnessDraft[];
  items: ItemDraft[];
}

export const DEFAULT_PENAL = 'Caso académico. Marco procesal: Ley 906/2004 arts. 216, 254 y 255; Manual de Cadena de Custodia FGN.';

export function emptyItem(): ItemDraft {
  return { name: '', nature: 'física', description: '', correctPackaging: '', labDestination: '', x: null, z: null };
}

export function emptyDraft(): CaseDraft {
  return {
    title: '', env: 'apartamento', narrative: '', nunc: '', penalReference: DEFAULT_PENAL, searchMethod: 'zonas',
    witnesses: [{ name: '', mustBeSeparated: true, hasRelevantInfo: true }],
    items: [emptyItem()],
  };
}

export function envOf(key: string): EnvChoice {
  return ENVIRONMENTS.find((e) => e.key === key) ?? ENVIRONMENTS[0];
}

/** Margen al borde del plano: el EMP/EF no puede quedar contra el muro o fuera del área. */
const EDGE = 0.8;

/** Limita un punto del plano (metros, centro en 0) al área útil del ambiente. */
export function clampToArea(x: number, z: number, dims: { w: number; d: number }): { x: number; z: number } {
  const hx = dims.w / 2 - EDGE, hz = dims.d / 2 - EDGE;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { x: r(Math.min(hx, Math.max(-hx, x))), z: r(Math.min(hz, Math.max(-hz, z))) };
}

/** Errores en lenguaje llano; lista vacía si el caso se puede guardar. */
export function validateDraft(d: CaseDraft): string[] {
  const errors: string[] = [];
  if (!d.title.trim()) errors.push('Escriba el título del caso.');
  if (!d.narrative.trim()) errors.push('Escriba el relato inicial: lo que se le cuenta al estudiante al empezar.');
  if (d.items.length === 0) errors.push('Agregue al menos un EMP/EF.');
  d.items.forEach((it, i) => {
    const n = `EMP/EF ${i + 1}`;
    if (!it.name.trim()) errors.push(`${n}: escriba su nombre.`);
    if (!it.correctPackaging) errors.push(`${n}: elija el embalaje correcto.`);
    if (!it.labDestination) errors.push(`${n}: elija el laboratorio de destino correcto.`);
    if (it.x === null || it.z === null) errors.push(`${n}: ubíquelo en el plano.`);
  });
  const placed = d.items.filter((it) => it.x !== null && it.z !== null);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (Math.hypot(placed[i].x! - placed[j].x!, placed[i].z! - placed[j].z!) < 1) {
        errors.push(`"${placed[i].name || 'Un EMP/EF'}" y "${placed[j].name || 'otro EMP/EF'}" están demasiado juntos en el plano: sepárelos al menos 1 metro.`);
      }
    }
  }
  d.witnesses.forEach((w, i) => { if (!w.name.trim()) errors.push(`Testigo ${i + 1}: escriba un nombre o quítelo.`); });
  return errors;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Convierte el borrador al modelo del simulador. `id` identifica el caso (se conserva al editar). */
export function draftToScenario(d: CaseDraft, id: string): Scenario {
  const env = envOf(d.env);
  return {
    scenarioId: id,
    title: d.title.trim(),
    environmentType: env.environmentType,
    ...(env.decor ? { decor: env.decor } : {}),
    penalReference: d.penalReference.trim() || DEFAULT_PENAL,
    recommendedSearchMethod: d.searchMethod,
    initialNarrative: d.narrative.trim(),
    nunc: d.nunc.trim() || '000000000000000000000',
    dimensions: { ...env.dims },
    sceneLocation: env.location,
    witnesses: d.witnesses.map((w, i) => ({ id: `T-D${pad(i + 1)}`, name: w.name.trim(), mustBeSeparated: w.mustBeSeparated, hasRelevantInfo: w.hasRelevantInfo })),
    evidenceItems: d.items.map((it, i) => {
      const size = (NATURES.find((n) => n.value === it.nature) ?? NATURES[4]).size;
      return {
        id: `EMP-D${pad(i + 1)}`, name: it.name.trim(), nature: it.nature,
        x: it.x ?? 0, z: it.z ?? 0, ...size,
        correctPackaging: it.correctPackaging as PackagingId,
        labDestination: it.labDestination,
        description: it.description.trim() || it.name.trim(),
        requiresPhotoBeforeCollection: true,
      };
    }),
  };
}

/** Borrador a partir de un caso guardado (para editarlo). */
export function scenarioToDraft(s: Scenario): CaseDraft {
  const env = ENVIRONMENTS.find((e) => e.environmentType === s.environmentType && (e.decor ?? null) === (s.decor ?? null))
    ?? ENVIRONMENTS.find((e) => e.environmentType === s.environmentType) ?? ENVIRONMENTS[0];
  return {
    title: s.title, env: env.key, narrative: s.initialNarrative, nunc: s.nunc === '000000000000000000000' ? '' : s.nunc,
    penalReference: s.penalReference, searchMethod: s.recommendedSearchMethod,
    witnesses: s.witnesses.map((w) => ({ name: w.name, mustBeSeparated: w.mustBeSeparated, hasRelevantInfo: w.hasRelevantInfo })),
    items: s.evidenceItems.map((e) => ({
      name: e.name, nature: e.nature, description: e.description, correctPackaging: e.correctPackaging,
      labDestination: e.labDestination, x: e.x, z: e.z,
    })),
  };
}
