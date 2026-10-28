// Flujo de la práctica (lógica pura, sin React): qué hacer a continuación y cómo
// se ejecuta cada intención del estudiante según el modo de práctica.
//
// - planTool / planGlobal / planWitness: traducen "quiero hacer X" a la acción del
//   reducer. En práctica guiada, si la acción es de otro rol se ofrece el relevo y,
//   si tiene riesgos, se avisa antes. En evaluación se ejecuta tal cual (el reducer
//   bloquea y penaliza lo que no corresponde).
// - nextStep: el siguiente paso sugerido del procedimiento (solo práctica guiada).
//
// El reducer (simulator.ts) sigue siendo la única autoridad de puntaje.
import type { Action, GlobalAction, SimState } from './simulator';
import { riskOfTool } from './simulator';
import type { EvidenceState, ToolId } from './types';
import { ROLE_DEFS, resolvePermission, roleLabel, type ActionKey, type RoleId } from './roles';

/** Rol al que naturalmente le corresponde cada acción (para sugerir el relevo). */
const OWNER_PREFERENCE: Record<ActionKey, RoleId> = {
  EPP: 'primer_responsable', CORDON: 'primer_responsable', INTERVIEW: 'primer_responsable',
  REPORT_INIT: 'primer_responsable', HANDOVER: 'primer_responsable',
  ROUTE: 'investigador_lider', SEARCH_METHOD: 'investigador_lider',
  OBSERVE: 'criminalistica', PHOTOGRAPH: 'criminalistica', MARK: 'criminalistica',
  COLLECT: 'criminalistica', PACKAGE: 'criminalistica', LABEL: 'criminalistica',
  CUSTODY: 'criminalistica', DELIVER: 'criminalistica',
  ANALYZE: 'perito', STORE: 'perito',
};

/** Rol que puede hacer la acción sin restricción: el preferido o, si no, el primero que pueda. */
export function ownerRole(action: ActionKey): RoleId {
  const pref = OWNER_PREFERENCE[action];
  if (resolvePermission(pref, action).level === 'allow') return pref;
  return ROLE_DEFS.find((r) => resolvePermission(r.id, action).level === 'allow')?.id ?? pref;
}

/** Nombre de cada acción en infinitivo, para frases como "Recolectar le corresponde a...". */
export const ACTION_NAME: Record<ActionKey, string> = {
  OBSERVE: 'Observar', PHOTOGRAPH: 'Fotografiar', MARK: 'Poner el numerador', COLLECT: 'Recolectar',
  PACKAGE: 'Embalar', LABEL: 'Rotular', CUSTODY: 'Diligenciar la cadena de custodia', DELIVER: 'Entregar al laboratorio',
  ANALYZE: 'Analizar en laboratorio', STORE: 'Almacenar en laboratorio',
  EPP: 'Usar el EPP', CORDON: 'Acordonar la escena', ROUTE: 'Definir la ruta de ingreso y salida',
  SEARCH_METHOD: 'Registrar el método de búsqueda', INTERVIEW: 'Gestionar a los testigos',
  REPORT_INIT: 'Registrar el reporte de iniciación', HANDOVER: 'Hacer la entrega formal del lugar',
};

const guided = (s: SimState) => s.practice.mode === 'guiada';

/** Envuelve una acción en el ofrecimiento de relevo si el rol actual no puede hacerla (solo guiada). */
function withRelevo(state: SimState, key: ActionKey, plan: (s: SimState) => Action): Action {
  if (guided(state) && resolvePermission(state.role, key).level === 'deny') {
    const role = ownerRole(key);
    return { type: 'OPEN_MODAL', modal: { kind: 'relevo', role, task: ACTION_NAME[key], then: plan({ ...state, role }) } };
  }
  return plan(state);
}

/** Aplicar una herramienta a un EMP/EF. */
export function planTool(state: SimState, tool: ToolId, id: string): Action {
  return withRelevo(state, tool, (s) => {
    if (guided(s)) {
      const warnings = riskOfTool(tool, id, s);
      if (warnings.length) return { type: 'OPEN_MODAL', modal: { kind: 'confirm', evidenceId: id, tool, warnings } };
    }
    return { type: 'APPLY_TOOL', id, tool };
  });
}

/** Acción global (EPP, acordonar, ruta...). */
export function planGlobal(state: SimState, action: GlobalAction): Action {
  return withRelevo(state, action, () => ({ type: 'APPLY_GLOBAL', action }));
}

/** Separar o entrevistar a un testigo. */
export function planWitness(state: SimState, id: string): Action {
  return withRelevo(state, 'INTERVIEW', () => ({ type: 'WITNESS_ACTION', id }));
}

// --- Siguiente paso sugerido ---

export type StepTarget =
  | { kind: 'global'; action: GlobalAction }
  | { kind: 'witness'; id: string }
  | { kind: 'evidence'; id: string; tool: ToolId }
  | { kind: 'access' }
  | { kind: 'closure' };

export interface NextStep {
  target: StepTarget;
  /** Instrucción en lenguaje llano. */
  text: string;
  /** Si el rol actual no puede hacerlo: rol al que le corresponde. */
  owner: RoleId | null;
}

/** Orden del ciclo de cada EMP/EF: marca de estado y herramienta que la cumple. */
export const EVIDENCE_CYCLE: { key: keyof EvidenceState; tool: ToolId; ask: string }[] = [
  { key: 'observed', tool: 'OBSERVE', ask: 'obsérvelo sin tocarlo' },
  { key: 'photographed', tool: 'PHOTOGRAPH', ask: 'fotografíelo antes de moverlo' },
  { key: 'marked', tool: 'MARK', ask: 'póngale el numerador' },
  { key: 'collected', tool: 'COLLECT', ask: 'recoléctelo' },
  { key: 'packaged', tool: 'PACKAGE', ask: 'embálelo' },
  { key: 'labeled', tool: 'LABEL', ask: 'rotúlelo' },
  { key: 'custody', tool: 'CUSTODY', ask: 'diligencie su cadena de custodia' },
  { key: 'delivered', tool: 'DELIVER', ask: 'entréguelo al laboratorio' },
];

/** Herramienta del siguiente paso pendiente de un EMP/EF, o null si completó el ciclo. */
export function nextEvidenceTool(st: EvidenceState): ToolId | null {
  return EVIDENCE_CYCLE.find((c) => !st[c.key])?.tool ?? null;
}

const GLOBAL_STEPS: { action: GlobalAction; flag: keyof SimState['globals']; text: string }[] = [
  { action: 'EPP', flag: 'epp', text: 'Póngase el equipo de protección personal (EPP) antes de entrar.' },
  { action: 'CORDON', flag: 'cordon', text: 'Acordone la escena para protegerla.' },
  { action: 'ROUTE', flag: 'route', text: 'Defina la ruta de ingreso y salida.' },
  { action: 'SEARCH_METHOD', flag: 'searchMethod', text: 'Elija el método de búsqueda y regístrelo.' },
];

const LATE_GLOBALS: typeof GLOBAL_STEPS = [
  { action: 'INTERVIEW', flag: 'interview', text: 'Registre que ya gestionó a los testigos.' },
  { action: 'REPORT_INIT', flag: 'reportInit', text: 'Registre el reporte de iniciación.' },
  { action: 'HANDOVER', flag: 'handover', text: 'Haga la entrega formal del lugar al investigador líder.' },
];

function step(state: SimState, target: StepTarget, text: string, key: ActionKey | null): NextStep {
  const denied = key !== null && resolvePermission(state.role, key).level === 'deny';
  return { target, text, owner: denied ? ownerRole(key) : null };
}

/**
 * Siguiente paso del procedimiento: aseguramiento, testigos, entrega formal,
 * registro de acceso, ciclo de cada EMP/EF en orden y cierre. null si ya finalizó.
 * No revela respuestas (qué método, qué embalaje, qué laboratorio): solo el orden.
 */
export function nextStep(state: SimState): NextStep | null {
  if (state.finalized) return null;
  const g = state.globals;
  for (const s of GLOBAL_STEPS) if (!g[s.flag]) return step(state, { kind: 'global', action: s.action }, s.text, s.action);

  for (const w of state.scenario.witnesses) {
    const ws = state.witnesses[w.id];
    if (ws && !ws.separated) return step(state, { kind: 'witness', id: w.id }, `Separe al testigo "${w.name}" de los demás.`, 'INTERVIEW');
  }
  for (const w of state.scenario.witnesses) {
    const ws = state.witnesses[w.id];
    if (ws && !ws.interviewed) return step(state, { kind: 'witness', id: w.id }, `Entreviste al testigo "${w.name}".`, 'INTERVIEW');
  }
  for (const s of LATE_GLOBALS) if (!g[s.flag]) return step(state, { kind: 'global', action: s.action }, s.text, s.action);

  if (state.accessLog.length === 0) return step(state, { kind: 'access' }, 'Anote en el registro de acceso a las personas que ingresan a la escena.', null);

  for (const item of state.scenario.evidenceItems) {
    const st = state.evidence[item.id];
    const c = st && EVIDENCE_CYCLE.find((x) => !st[x.key]);
    if (c) return step(state, { kind: 'evidence', id: item.id, tool: c.tool }, `${item.name} (${item.id}): ${c.ask}.`, c.tool);
  }
  return step(state, { kind: 'closure' }, 'Todos los EMP/EF están entregados: cierre la escena y finalice la práctica.', null);
}

/** Frase del relevo para el aviso: "Recolectar le corresponde a Criminalística de campo." */
export function relevoText(task: string, role: string): string {
  return `${task} le corresponde a ${roleLabel(role)}.`;
}
