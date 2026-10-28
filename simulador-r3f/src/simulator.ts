import type {
  AccessRecord, CustodyRecord, EvidenceState, LabelRecord, LogEntry, LogType,
  PackagingId, PracticeSettings, SalvamentoRecord, Scenario, ToolId, WitnessState,
} from './types';
import { DEFAULT_PRACTICE } from './types';
import { PACKAGING_LABELS } from './types';
import { resolvePermission, roleLabel, DEFAULT_ROLE, type ActionKey } from './roles';
import { scoreLabel, scoreCustody } from './validation';
import { requiredSpecialist, roleIsSpecialist } from './specialists';
import { normalize } from './util';
import { SCENARIOS } from './data/scenarios';

// --- Estado global del simulador (equivalente al objeto `app` del HTML original) ---

export type GlobalAction = 'EPP' | 'CORDON' | 'ROUTE' | 'SEARCH_METHOD' | 'INTERVIEW' | 'REPORT_INIT' | 'HANDOVER';

export type ModalState =
  | { kind: 'manual' }
  | { kind: 'package'; evidenceId: string }
  | { kind: 'label'; evidenceId: string }
  | { kind: 'custody'; evidenceId: string }
  | { kind: 'deliver'; evidenceId: string }
  | { kind: 'confirm'; evidenceId: string; tool: ToolId; warnings: string[] }
  | { kind: 'closure' }
  | { kind: 'manuals' }
  | { kind: 'salvamento' }
  | { kind: 'access' }
  | { kind: 'report' }
  /** Acción que corresponde a otro rol: ofrece el relevo y, al aceptar, la ejecuta. */
  | { kind: 'relevo'; role: string; task: string; then: Action };

export interface Globals {
  epp: boolean; cordon: boolean; route: boolean;
  searchMethod: boolean; interview: boolean; reportInit: boolean; handover: boolean; salvamento: boolean;
}

export interface SimState {
  scenarios: Scenario[];
  scenarioIndex: number;
  scenario: Scenario;
  role: string;
  searchMethodChoice: string;
  score: number;
  selectedTool: ToolId | null;
  selectedEvidenceId: string | null;
  evidence: Record<string, EvidenceState>;
  witnesses: Record<string, WitnessState>;
  globals: Globals;
  records: CustodyRecord[];
  salvamentoRecords: SalvamentoRecord[];
  accessLog: AccessRecord[];
  log: LogEntry[];
  modal: ModalState | null;
  finalized: boolean;
  /** Segundos restantes en escena abierta; null si no aplica. */
  timeLeft: number | null;
  /** Modo y cronómetro de la práctica (configuración del docente). */
  practice: PracticeSettings;
  /** La práctica se inició desde la pantalla de inicio (caso y rol elegidos). */
  started: boolean;
}

function freshEvidenceState(): EvidenceState {
  return {
    observed: false, photographed: false, marked: false, collected: false,
    packaged: false, labeled: false, custody: false, delivered: false,
    contaminated: false, contaminationReason: null, package: null, labelRecord: null, deliveredTo: null,
    analyzed: false, stored: false,
  };
}

function freshGlobals(): Globals {
  return { epp: false, cordon: false, route: false, searchMethod: false, interview: false, reportInit: false, handover: false, salvamento: false };
}

export function initState(scenarios: Scenario[] = SCENARIOS, scenarioIndex = 0, role: string = DEFAULT_ROLE, practice: PracticeSettings = DEFAULT_PRACTICE): SimState {
  const scenario = scenarios[scenarioIndex];
  const evidence: Record<string, EvidenceState> = {};
  scenario.evidenceItems.forEach((e) => { evidence[e.id] = freshEvidenceState(); });
  const witnesses: Record<string, WitnessState> = {};
  (scenario.witnesses || []).forEach((w) => { witnesses[w.id] = { separated: false, interviewed: false }; });
  return {
    scenarios, scenarioIndex, scenario, role,
    searchMethodChoice: 'zonas', score: 0,
    selectedTool: null, selectedEvidenceId: null,
    evidence, witnesses, globals: freshGlobals(), records: [], salvamentoRecords: [], accessLog: [], log: [],
    modal: null, finalized: false,
    timeLeft: scenario.environmentType !== 'cerrado' ? practice.timerSeconds : null,
    practice, started: false,
  };
}

// --- Helpers de puntuación, calificación, progreso y normalización ---

export function grade(score: number): string {
  if (score >= 180) return 'Excelente';
  if (score >= 130) return 'Adecuado';
  if (score >= 85) return 'Corregible';
  if (score > 0) return 'Crítico';
  return '-';
}

export function progressPercent(state: SimState): number {
  const ev = state.scenario.evidenceItems;
  const totalEvidence = ev.length * 8;
  const keys: (keyof EvidenceState)[] = ['observed', 'photographed', 'marked', 'collected', 'packaged', 'labeled', 'custody', 'delivered'];
  const done = ev.reduce((a, e) => a + keys.filter((k) => state.evidence[e.id]?.[k]).length, 0);
  const globals = Object.values(state.globals).filter(Boolean).length;
  const totalGlobals = Object.keys(state.globals).length;
  return Math.min(100, Math.round(((done + globals) / (totalEvidence + totalGlobals)) * 100));
}

export function phaseLabel(state: SimState): string {
  const g = state.globals;
  let msg = 'Fase: recepción, verificación y preparación inicial.';
  if (g.epp && !g.cordon) msg = 'Fase: asegurar la escena mediante acordonamiento.';
  else if (g.cordon && !g.route) msg = 'Fase: definir ruta y método de búsqueda.';
  else if (g.route && g.searchMethod && !g.handover) msg = 'Fase: entrega formal del lugar (primer responsable → investigador líder).';
  else if (g.handover) msg = 'Fase: intervenir EMP/EF y diligenciar registros.';
  const items = state.scenario.evidenceItems;
  if (items.length && items.every((e) => state.evidence[e.id]?.delivered)) msg = 'Fase: cierre, entrega final e informe.';
  return msg;
}

// --- Riesgo de una acción (aviso previo): advertencias que el estudiante debería
// conocer ANTES de ejecutar. Pura; si devuelve [], la acción procede sin fricción.
export function riskOfTool(tool: ToolId, id: string, state: SimState): string[] {
  const warnings: string[] = [];
  const st = state.evidence[id];
  const item = state.scenario.evidenceItems.find((e) => e.id === id);
  if (!st || !item) return warnings;
  if (tool === 'COLLECT' && !st.collected) {
    if (!st.photographed) warnings.push('Recolectar sin fijación fotográfica previa CONTAMINA el EMP/EF (−25; Ley 906/2004 art. 254: registrar el estado original antes de manipular).');
    if (!st.marked) warnings.push('Recolectar sin numerador previo resta puntos (−10).');
    const witnessesPending = (state.scenario.witnesses || []).some((w) => w.mustBeSeparated && !state.witnesses[w.id]?.separated);
    if (witnessesPending) warnings.push('Hay testigos sin separar: recolectar con testigos presentes arriesga contaminación de versiones (−8).');
    const spec = requiredSpecialist(item.nature);
    if (spec && !roleIsSpecialist(state.role)) warnings.push(`Este EMP/EF (${item.nature}) requiere ${spec.label} (${spec.lab}); recolectarlo sin el especialista arriesga su integridad (−6; Sección 9, regla 6).`);
  }
  if (tool !== 'OBSERVE' && !state.globals.handover) {
    warnings.push('No se ha hecho la entrega formal del lugar (primer responsable → investigador líder): intervenir antes alerta y penaliza (Sección 9, regla 2).');
  }
  return warnings;
}

// --- Acciones del reducer ---

export type Action =
  | { type: 'START_PRACTICE'; index: number; role: string; practice: PracticeSettings; scenarios?: Scenario[] }
  | { type: 'LOAD_SCENARIO'; index: number }
  | { type: 'RESET' }
  | { type: 'SET_ROLE'; role: string }
  | { type: 'SET_SEARCH_METHOD'; value: string }
  | { type: 'SELECT_TOOL'; tool: ToolId | null }
  | { type: 'SELECT_EVIDENCE'; id: string | null }
  | { type: 'APPLY_GLOBAL'; action: GlobalAction }
  /** `tool` aplica esa herramienta directamente (acción por objeto); sin ella usa la seleccionada. */
  | { type: 'APPLY_TOOL'; id: string; tool?: ToolId }
  | { type: 'SAVE_PACKAGE'; choice: PackagingId }
  | { type: 'SAVE_LABEL'; form: LabelRecord }
  | { type: 'SAVE_CUSTODY'; record: CustodyRecord }
  | { type: 'SAVE_DELIVER'; destination: string }
  | { type: 'SAVE_SALVAMENTO'; record: SalvamentoRecord }
  | { type: 'ADD_ACCESS'; record: AccessRecord }
  | { type: 'REMOVE_ACCESS'; index: number }
  | { type: 'WITNESS_ACTION'; id: string }
  | { type: 'TICK' }
  | { type: 'OPEN_MODAL'; modal: ModalState }
  | { type: 'CLOSE_MODAL' }
  | { type: 'FINALIZE' };

interface Mut { score: number; logs: LogEntry[]; }
function award(mut: Mut, points: number, message: string, type?: LogType, competence?: 'deny' | 'conditional') {
  mut.score += points;
  const t: LogType = type ?? (points >= 0 ? 'good' : 'bad');
  const sign = points >= 0 ? '+' : '';
  mut.logs.push({
    time: new Date().toISOString(),
    message: `${sign}${points} pts - ${message}`,
    type: t, points, score: mut.score, competence,
  });
}

function commit(state: SimState, mut: Mut, patch: Partial<SimState>): SimState {
  // Estampar el rol activo en cada acción (trazabilidad por actor, regla 9 del documento).
  const stamped = mut.logs.map((l) => ({ ...l, role: state.role }));
  return { ...state, score: mut.score, log: [...stamped.reverse(), ...state.log], ...patch };
}

// Control de competencia por rol (Sección 8 del documento). Devuelve 'blocked'
// cuando la acción está fuera de rol (ya registró la penalización) o 'ok' para
// continuar (si era condicionada, ya añadió la nota explicativa).
const COMPETENCE_PENALTY = -15;
function enforcePermission(state: SimState, mut: Mut, actionKey: ActionKey): 'ok' | 'blocked' {
  const perm = resolvePermission(state.role, actionKey);
  if (perm.level === 'deny') {
    award(mut, COMPETENCE_PENALTY, perm.reason, 'bad', 'deny');
    return 'blocked';
  }
  if (perm.level === 'conditional') {
    award(mut, 0, perm.reason, 'warn', 'conditional');
  }
  return 'ok';
}

export function reducer(state: SimState, action: Action): SimState {
  // Bug #6 del análisis: tras finalizar, se bloquean las acciones que modifican la práctica.
  const mutating = ['APPLY_GLOBAL', 'APPLY_TOOL', 'SAVE_PACKAGE', 'SAVE_LABEL', 'SAVE_CUSTODY', 'SAVE_DELIVER', 'SAVE_SALVAMENTO', 'WITNESS_ACTION'];
  if (state.finalized && mutating.includes(action.type)) return state;

  switch (action.type) {
    case 'START_PRACTICE': {
      const scenarios = action.scenarios ?? state.scenarios;
      const index = Math.min(Math.max(0, action.index), scenarios.length - 1);
      const mut: Mut = { score: 0, logs: [] };
      award(mut, 0, `Inicio de la práctica como ${roleLabel(action.role)} (${action.practice.mode === 'guiada' ? 'práctica guiada' : 'evaluación'}).`, 'info');
      return commit({ ...initState(scenarios, index, action.role, action.practice), started: true }, mut, { modal: { kind: 'manual' } });
    }

    case 'LOAD_SCENARIO':
      return { ...initState(state.scenarios, action.index, state.role, state.practice), started: state.started };

    case 'RESET':
      return { ...initState(state.scenarios, state.scenarioIndex, state.role, state.practice), started: state.started };

    case 'SET_ROLE': {
      if (action.role === state.role) return state;
      const mut: Mut = { score: state.score, logs: [] };
      award(mut, 0, `Cambio de rol: ${roleLabel(state.role)} → ${roleLabel(action.role)}.`, 'info');
      return commit({ ...state, role: action.role }, mut, {});
    }

    case 'SET_SEARCH_METHOD':
      return { ...state, searchMethodChoice: action.value };

    case 'SELECT_TOOL':
      return { ...state, selectedTool: action.tool };

    case 'SELECT_EVIDENCE':
      return { ...state, selectedEvidenceId: action.id };

    case 'OPEN_MODAL':
      return { ...state, modal: action.modal };

    case 'CLOSE_MODAL':
      return { ...state, modal: null };

    case 'FINALIZE': {
      // Cierre de escena (Sección 9, regla 10): inventario y liberación formal.
      const mut: Mut = { score: state.score, logs: [] };
      const items = state.scenario.evidenceItems;
      const pending = items.filter((e) => !state.evidence[e.id].delivered).length;
      const contaminated = items.filter((e) => state.evidence[e.id].contaminated).length;
      if (pending === 0) award(mut, 15, 'Cierre de escena: inventario completo y liberación formal del lugar (Sección 9, regla 10).', 'good');
      else award(mut, -10, `Cierre con ${pending} EMP/EF sin entregar: liberación formal con observaciones (Sección 9, regla 10).`, 'warn');
      if (contaminated > 0) award(mut, 0, `Acta de cierre: ${contaminated} EMP/EF con alteración registrada.`, 'info');
      if (state.accessLog.length === 0) award(mut, -4, 'Cierre sin registro de ingreso/salida de personal (Sección 9, regla 3).', 'warn');
      return commit({ ...state, finalized: true }, mut, { modal: { kind: 'report' } });
    }

    case 'APPLY_GLOBAL': {
      const mut: Mut = { score: state.score, logs: [] };
      // Control de competencia por rol antes de ejecutar la acción global.
      if (enforcePermission(state, mut, action.action) === 'blocked') return commit(state, mut, {});
      const g = { ...state.globals };
      switch (action.action) {
        case 'EPP':
          if (g.epp) award(mut, -2, 'EPP ya fue registrado.', 'warn');
          else { g.epp = true; award(mut, 10, 'Usó EPP antes de intervenir.', 'good'); }
          break;
        case 'CORDON':
          if (g.cordon) award(mut, -2, 'Acordonamiento ya registrado.', 'warn');
          else {
            if (!g.epp) award(mut, -10, 'Acordonó sin registrar EPP previo.', 'warn');
            g.cordon = true; award(mut, 10, 'Acordonó la escena.', 'good');
          }
          break;
        case 'ROUTE':
          if (g.route) award(mut, -2, 'Ruta ya definida.', 'warn');
          else {
            if (!g.cordon) award(mut, -12, 'Definió ruta sin acordonar primero.', 'bad');
            g.route = true; award(mut, 10, 'Definió ruta de ingreso y salida.', 'good');
          }
          break;
        case 'SEARCH_METHOD':
          if (g.searchMethod) award(mut, -2, 'Método de búsqueda ya registrado.', 'warn');
          else {
            g.searchMethod = true;
            const method = state.searchMethodChoice;
            if (method === state.scenario.recommendedSearchMethod) award(mut, 15, `Seleccionó método adecuado: ${method}.`, 'good');
            else award(mut, 6, `Seleccionó método ${method}.`, 'warn');
          }
          break;
        case 'INTERVIEW':
          if (g.interview) award(mut, -2, 'Gestión de testigos ya registrada.', 'warn');
          else { g.interview = true; award(mut, 10, 'Separó e individualizó testigos.', 'good'); }
          break;
        case 'REPORT_INIT':
          if (g.reportInit) award(mut, -2, 'Reporte de iniciación ya registrado.', 'warn');
          else { g.reportInit = true; award(mut, 12, 'Registró el reporte de iniciación.', 'good'); }
          break;
        case 'HANDOVER':
          if (g.handover) award(mut, -2, 'Entrega formal del lugar ya registrada.', 'warn');
          else {
            if (!g.cordon) award(mut, -8, 'Entrega formal sin haber acordonado/asegurado el lugar.', 'warn');
            g.handover = true;
            award(mut, 12, 'Entrega formal del lugar al investigador líder (Sección 9, regla 2: transferencia de responsabilidad).', 'good');
          }
          break;
      }
      return commit(state, mut, { globals: g });
    }

    case 'APPLY_TOOL': {
      const tool = action.tool ?? state.selectedTool;
      const st = state.evidence[action.id];
      const item = state.scenario.evidenceItems.find((e) => e.id === action.id);
      if (!tool || !st || !item) return { ...state, selectedEvidenceId: action.id };

      const mut: Mut = { score: state.score, logs: [] };

      // Control de competencia por rol (OBSERVE/EPP nunca se bloquean). Si la
      // herramienta está fuera de rol, se penaliza y NO se muta la evidencia.
      if (enforcePermission(state, mut, tool) === 'blocked') {
        return commit(state, mut, { selectedEvidenceId: action.id });
      }

      const next: EvidenceState = { ...st };

      // Penalizaciones de orden (gating) sobre acciones DE ESCENA. Las acciones de
      // laboratorio (ANALYZE/STORE) ocurren post-entrega y no se gatean por el orden
      // de escena. La excepción por salvamento (Sección 9, regla 5) excusa estas
      // penalizaciones cuando ya fue documentada.
      const urgency = state.globals.salvamento;
      const sceneTool = tool !== 'OBSERVE' && tool !== 'ANALYZE' && tool !== 'STORE';
      if (!state.globals.epp && sceneTool) {
        if (urgency) award(mut, 0, 'Intervino sin EPP bajo excepción de salvamento (documentada).', 'info');
        else award(mut, -12, 'Intervino EMP/EF sin registrar EPP (Ley 906/2004 art. 255: responsabilidad en el manejo del EMP/EF).', 'bad');
      }
      if (!state.globals.cordon && sceneTool) {
        if (urgency) award(mut, 0, 'Intervino sin acordonar bajo excepción de salvamento (documentada).', 'info');
        else award(mut, -10, 'Intervino EMP/EF sin acordonar la escena (Ley 906/2004 art. 216: asegurar para evitar alteración).', 'bad');
      }
      // Sección 9, regla 2: sin entrega formal del lugar, la intervención técnica alerta y penaliza (salvo salvamento).
      if (!state.globals.handover && sceneTool && !urgency) award(mut, -6, 'Intervención técnica antes de la entrega formal del lugar (Sección 9, regla 2: primer responsable → investigador líder).', 'warn');

      const base = { selectedEvidenceId: action.id };

      switch (tool) {
        case 'OBSERVE':
          if (next.observed) award(mut, -1, `${item.name} ya había sido observado.`, 'warn');
          else { next.observed = true; award(mut, 5, `Observó ${item.name} sin manipularlo.`, 'good'); }
          break;
        case 'PHOTOGRAPH':
          if (next.photographed) award(mut, -2, `${item.name} ya fue fotografiado.`, 'warn');
          else { next.photographed = true; next.observed = true; award(mut, 15, `Fijó fotográficamente ${item.name}.`, 'good'); }
          break;
        case 'MARK':
          if (next.marked) award(mut, -2, `${item.name} ya estaba señalizado.`, 'warn');
          else {
            if (!next.photographed) award(mut, -8, `Señalizó ${item.name} antes de fotografía.`, 'warn');
            next.marked = true; award(mut, 10, `Señalizó ${item.name} con numerador.`, 'good');
          }
          break;
        case 'COLLECT':
          if (next.collected) award(mut, -2, `${item.name} ya fue recolectado.`, 'warn');
          else {
            if (!next.photographed) {
              next.contaminated = true;
              next.contaminationReason = 'Recolectado sin fijación fotográfica previa.';
              award(mut, -25, `Recolectó ${item.name} sin fijación previa (Ley 906/2004 art. 254: debe registrarse el estado original antes de manipular).`, 'bad');
            }
            if (!next.marked) award(mut, -10, `Recolectó ${item.name} sin numerador previo.`, 'warn');
            const witnessesPending = (state.scenario.witnesses || []).some((w) => w.mustBeSeparated && !state.witnesses[w.id]?.separated);
            if (witnessesPending) award(mut, -8, `Recolectó ${item.name} con testigos sin separar (riesgo de contaminación de versiones; MUPJ-3: individualizar testigos primero).`, 'warn');
            const spec = requiredSpecialist(item.nature);
            if (spec && !roleIsSpecialist(state.role)) award(mut, -6, `${item.name} (${item.nature}) requiere ${spec.label} (${spec.lab}); recolectado sin el especialista (Sección 9, regla 6: activar especialistas según indicios).`, 'warn');
            next.collected = true;
            award(mut, next.contaminated ? 4 : 15, `Recolectó ${item.name}.`, next.contaminated ? 'warn' : 'good');
          }
          break;
        case 'PACKAGE':
          if (!next.collected) { award(mut, -18, `Intentó embalar ${item.name} sin recolección previa.`, 'bad'); break; }
          if (next.packaged) { award(mut, -2, `${item.name} ya fue embalado.`, 'warn'); break; }
          return commit(state, mut, { ...base, evidence: { ...state.evidence, [action.id]: next }, modal: { kind: 'package', evidenceId: action.id } });
        case 'LABEL':
          if (!next.packaged) { award(mut, -18, `Intentó rotular ${item.name} sin embalaje previo.`, 'bad'); break; }
          if (next.labeled) { award(mut, -2, `${item.name} ya fue rotulado.`, 'warn'); break; }
          return commit(state, mut, { ...base, evidence: { ...state.evidence, [action.id]: next }, modal: { kind: 'label', evidenceId: action.id } });
        case 'CUSTODY':
          if (!next.labeled) { award(mut, -22, `Intentó diligenciar cadena de custodia de ${item.name} sin rótulo previo.`, 'bad'); break; }
          if (next.custody) { award(mut, -2, `${item.name} ya tiene cadena de custodia.`, 'warn'); break; }
          return commit(state, mut, { ...base, evidence: { ...state.evidence, [action.id]: next }, modal: { kind: 'custody', evidenceId: action.id } });
        case 'DELIVER':
          if (!next.custody) { award(mut, -25, `Intentó entregar ${item.name} sin cadena de custodia (Ley 906/2004 art. 254: la continuidad de la custodia es obligatoria).`, 'bad'); break; }
          if (next.delivered) { award(mut, -2, `${item.name} ya fue entregado.`, 'warn'); break; }
          // El estudiante debe elegir el destino: ya no acierta automáticamente.
          return commit(state, mut, { ...base, evidence: { ...state.evidence, [action.id]: next }, modal: { kind: 'deliver', evidenceId: action.id } });
        // --- Continuidad de laboratorio (Sección 9, regla 7: separar procesamiento de escena de análisis de laboratorio) ---
        case 'ANALYZE':
          if (!next.delivered) { award(mut, -16, `Intentó analizar ${item.name} sin recepción formal en laboratorio (debe entregarse primero).`, 'bad'); break; }
          if (next.analyzed) { award(mut, -2, `${item.name} ya fue analizado.`, 'warn'); break; }
          next.analyzed = true; award(mut, 14, `Analizó ${item.name} en laboratorio (recepción, apertura registrada y método validado; Ley 906/2004 art. 254).`, 'good');
          break;
        case 'STORE':
          if (!next.analyzed) { award(mut, -14, `Intentó almacenar ${item.name} sin análisis/reembalaje previo.`, 'bad'); break; }
          if (next.stored) { award(mut, -2, `${item.name} ya fue almacenado.`, 'warn'); break; }
          next.stored = true; award(mut, 12, `Reembaló, selló y almacenó ${item.name} con registro de continuidad (MSCC-2018).`, 'good');
          break;
      }

      return commit(state, mut, { ...base, evidence: { ...state.evidence, [action.id]: next } });
    }

    case 'SAVE_PACKAGE': {
      if (state.modal?.kind !== 'package') return state;
      const id = state.modal.evidenceId;
      const item = state.scenario.evidenceItems.find((e) => e.id === id)!;
      const st = state.evidence[id];
      const mut: Mut = { score: state.score, logs: [] };
      const next: EvidenceState = { ...st, packaged: true, package: action.choice };
      if (action.choice === item.correctPackaging) {
        award(mut, 15, `Embaló ${item.name} correctamente en ${PACKAGING_LABELS[action.choice]}.`, 'good');
      } else {
        next.contaminated = true;
        next.contaminationReason = 'Embalaje inadecuado para la naturaleza del EMP/EF.';
        award(mut, -15, `Embalaje inadecuado para ${item.name} (Ley 906/2004 art. 216: el embalaje técnico debe evitar alteración o suplantación).`, 'bad');
      }
      return commit(state, mut, { evidence: { ...state.evidence, [id]: next }, modal: null });
    }

    case 'SAVE_LABEL': {
      if (state.modal?.kind !== 'label') return state;
      const id = state.modal.evidenceId;
      const item = state.scenario.evidenceItems.find((e) => e.id === id)!;
      const f = action.form;
      const { pts, errors } = scoreLabel(f, state.scenario, item, state.evidence[id].package);

      const mut: Mut = { score: state.score, logs: [] };
      const next: EvidenceState = { ...state.evidence[id], labeled: true, labelRecord: f };
      if (errors.length === 0) award(mut, 15 + Math.min(pts, 10), `Rótulo de ${item.name} diligenciado correctamente.`, 'good');
      else award(mut, Math.max(-12, pts - 12), `Rótulo de ${item.name} diligenciado con observaciones: ${errors.join('; ')}.`, errors.length > 3 ? 'bad' : 'warn');
      return commit(state, mut, { evidence: { ...state.evidence, [id]: next }, modal: null });
    }

    case 'SAVE_CUSTODY': {
      if (state.modal?.kind !== 'custody') return state;
      const id = state.modal.evidenceId;
      const item = state.scenario.evidenceItems.find((e) => e.id === id)!;
      const r = action.record;
      const { pts, errors } = scoreCustody(r, state.scenario, item);

      const mut: Mut = { score: state.score, logs: [] };
      const next: EvidenceState = { ...state.evidence[id], custody: true };
      if (errors.length === 0) award(mut, 18 + Math.min(pts, 10), `Cadena de custodia de ${item.name} diligenciada correctamente.`, 'good');
      else award(mut, Math.max(-14, pts - 13), `Cadena de custodia de ${item.name} con observaciones: ${errors.join('; ')}.`, errors.length > 3 ? 'bad' : 'warn');
      return commit(state, mut, { records: [...state.records, r], evidence: { ...state.evidence, [id]: next }, modal: null });
    }

    case 'SAVE_DELIVER': {
      if (state.modal?.kind !== 'deliver') return state;
      const id = state.modal.evidenceId;
      const item = state.scenario.evidenceItems.find((e) => e.id === id)!;
      const mut: Mut = { score: state.score, logs: [] };
      const next: EvidenceState = { ...state.evidence[id], delivered: true, deliveredTo: action.destination };
      if (normalize(action.destination) === normalize(item.labDestination)) {
        award(mut, 20, `Entregó ${item.name} al destino correcto: ${action.destination}.`, 'good');
      } else {
        award(mut, -10, `Entregó ${item.name} a destino inadecuado (${action.destination}); no corresponde a su naturaleza.`, 'bad');
      }
      return commit(state, mut, { evidence: { ...state.evidence, [id]: next }, modal: null });
    }

    case 'SAVE_SALVAMENTO': {
      const mut: Mut = { score: state.score, logs: [] };
      const r = action.record;
      const complete = !!(r.moved.trim() && r.reason.trim() && r.deliveredTo.trim());
      if (complete) award(mut, 8, `Excepción por salvamento documentada (movió "${r.moved}", entregó a ${r.deliveredTo}; Sección 9, regla 5).`, 'good');
      else award(mut, -6, 'Excepción por salvamento sin documentación completa (qué movió, por qué y a quién).', 'warn');
      return commit(state, mut, { globals: { ...state.globals, salvamento: true }, salvamentoRecords: [...state.salvamentoRecords, r], modal: null });
    }

    case 'ADD_ACCESS': {
      const mut: Mut = { score: state.score, logs: [] };
      award(mut, 0, `Registro de control de acceso: ${action.record.action} de ${action.record.person} (${action.record.role}).`, 'info');
      return commit(state, mut, { accessLog: [...state.accessLog, action.record] });
    }

    case 'REMOVE_ACCESS':
      return { ...state, accessLog: state.accessLog.filter((_, i) => i !== action.index) };

    case 'WITNESS_ACTION': {
      const w = state.scenario.witnesses.find((x) => x.id === action.id);
      const ws = state.witnesses[action.id];
      if (!w || !ws) return state;
      const mut: Mut = { score: state.score, logs: [] };
      // Control de competencia: entrevistar/gestionar testigos.
      if (enforcePermission(state, mut, 'INTERVIEW') === 'blocked') return commit(state, mut, {});
      const next: WitnessState = { ...ws };
      if (!ws.separated) {
        next.separated = true;
        if (w.mustBeSeparated) award(mut, 6, `Separó e individualizó al testigo ${w.name}.`, 'good');
        else award(mut, 2, `Individualizó al testigo ${w.name}.`, 'good');
      } else if (!ws.interviewed) {
        next.interviewed = true;
        if (w.hasRelevantInfo) award(mut, 8, `Entrevistó a ${w.name}: aportó información relevante.`, 'good');
        else award(mut, 3, `Entrevistó a ${w.name}: sin información relevante.`, 'warn');
      } else {
        award(mut, -2, `${w.name} ya fue separado y entrevistado.`, 'warn');
      }
      return commit(state, mut, { witnesses: { ...state.witnesses, [action.id]: next } });
    }

    case 'TICK': {
      if (state.timeLeft == null || state.finalized) return state;
      const t = state.timeLeft - 1;
      if (t > 0) return { ...state, timeLeft: t };
      // Tiempo agotado: los EMP/EF aún no recolectados se alteran por exposición.
      const mut: Mut = { score: state.score, logs: [] };
      const evidence = { ...state.evidence };
      state.scenario.evidenceItems.forEach((it) => {
        const s = evidence[it.id];
        if (!s.collected && !s.contaminated) {
          evidence[it.id] = { ...s, contaminated: true, contaminationReason: 'Exposición prolongada (tiempo de escena agotado).' };
          award(mut, -8, `Se alteró ${it.name} por exposición prolongada (tiempo agotado).`, 'bad');
        }
      });
      return commit(state, mut, { timeLeft: 0, evidence });
    }

    default:
      return state;
  }
}
