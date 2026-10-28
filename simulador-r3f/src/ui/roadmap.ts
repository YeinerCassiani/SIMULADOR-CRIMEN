// Hoja de ruta del procedimiento (lógica pura, sin React): preparación/aseguramiento
// + ciclo de las etapas del EMP/EF. La consumen la tira compacta y el detalle de
// ProcedurePanel.tsx; va aparte para que Fast Refresh solo vea componentes allí.
import type { SimState } from '../simulator';
import { phaseLabel, progressPercent } from '../simulator';
import { STAGES, currentStage, type StageDef } from '../stages';

export interface RoadmapStep { id: string; label: string; done: boolean; current: boolean; count?: string }

export interface Roadmap {
  prep: RoadmapStep[];
  cycle: RoadmapStep[];
  current: StageDef;
  percent: number;
  phase: string;
}

export function buildRoadmap(state: SimState): Roadmap {
  const items = state.scenario.evidenceItems;
  const total = items.length;
  const itemStages = STAGES.filter((s) => s.order > 0);
  const metCount = (order: number) => items.filter((e) => currentStage(state.evidence[e.id]).order >= order).length;
  // Etapa colectiva "en curso": la primera del ciclo no completada en todos los EMP/EF.
  const current = itemStages.find((s) => metCount(s.order) < total) ?? itemStages[itemStages.length - 1];
  const g = state.globals;
  const prepRaw: [string, string, boolean][] = [
    ['epp', 'EPP', g.epp],
    ['cordon', 'Acordonar', g.cordon],
    ['route', 'Ruta de ingreso/salida', g.route],
    ['search', 'Método de búsqueda', g.searchMethod],
    ['handover', 'Entrega formal del lugar', g.handover],
  ];
  const firstPrepPending = prepRaw.findIndex(([, , d]) => !d);
  return {
    prep: prepRaw.map(([id, label, done], i) => ({ id, label, done, current: i === firstPrepPending })),
    cycle: itemStages.map((s) => {
      const n = metCount(s.order);
      return { id: s.id, label: s.label, done: n >= total, current: s.id === current.id && n < total, count: `${n}/${total}` };
    }),
    current,
    percent: progressPercent(state),
    phase: phaseLabel(state),
  };
}

/** Etiqueta corta para la tira: sin el paréntesis aclaratorio (el detalle conserva el texto completo). */
export function shortStage(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, '');
}
