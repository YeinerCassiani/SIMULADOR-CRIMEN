import type { CustodyRecord, EvidenceState, Scenario } from './types';
import { grade, progressPercent, type SimState } from './simulator';
import { normalize } from './util';
import { currentStage } from './stages';
import { roleLabel } from './roles';

const STEP_LABELS: Record<string, string> = {
  photographed: 'fotografía', marked: 'numerador', collected: 'recolección',
  packaged: 'embalaje', labeled: 'rótulo', custody: 'cadena de custodia', delivered: 'entrega',
};

function pendingSteps(st: EvidenceState): string[] {
  const order: (keyof EvidenceState)[] = ['photographed', 'marked', 'collected', 'packaged', 'labeled', 'custody', 'delivered'];
  return order.filter((k) => !st[k]).map((k) => STEP_LABELS[k as string]);
}

function feedbackText(delivered: number, total: number, contaminated: number, score: number): string {
  if (delivered === total && contaminated === 0 && score >= 180)
    return 'Actuación sólida: preservó la escena, documentó y mantuvo la continuidad.';
  if (delivered >= Math.ceil(total * 0.7) && contaminated <= 1)
    return 'Actuación aceptable: refuerce diligenciamiento documental y secuencia técnica.';
  return 'Actuación crítica: debe reforzar fijación previa, embalaje, rótulo y continuidad de cadena de custodia.';
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour12: false });
}

// --- Trazabilidad de la cadena de custodia (Ley 906/2004 art. 254) ---
// La cadena debe ser continua: el "recibe" de un traspaso debe ser el "entrega"
// del siguiente, y deben registrarse identidad, lugar y fecha de cada custodio.
// Aquí se reconstruye la secuencia por EMP/EF y se marcan rupturas de continuidad.

interface CustodyChain {
  evidenceId: string;
  evidenceName: string;
  hops: CustodyRecord[];
  /** Descripciones de rupturas de continuidad detectadas. */
  breaks: string[];
}

function buildCustodyChains(state: SimState): CustodyChain[] {
  const byItem = new Map<string, CustodyRecord[]>();
  state.records.forEach((r) => {
    const arr = byItem.get(r.evidenceId) ?? [];
    arr.push(r);
    byItem.set(r.evidenceId, arr);
  });

  return state.scenario.evidenceItems.map((item) => {
    const hops = (byItem.get(item.id) ?? []).slice().sort((a, b) => {
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
    const breaks: string[] = [];
    for (let i = 1; i < hops.length; i++) {
      const prev = hops[i - 1];
      const cur = hops[i];
      // Continuidad: quien recibió el tramo anterior debe ser quien entrega el siguiente.
      if (prev.to && cur.from && normalize(prev.to) !== normalize(cur.from)) {
        breaks.push(
          `Discontinuidad entre traspasos: "${prev.to}" recibió pero el siguiente traspaso lo entrega "${cur.from}" (art. 254: la custodia debe ser continua).`,
        );
      }
    }
    return { evidenceId: item.id, evidenceName: item.name, hops, breaks };
  });
}

function custodyTraceText(state: SimState): { text: string; totalBreaks: number } {
  const chains = buildCustodyChains(state);
  let totalBreaks = 0;
  const blocks = chains.map((c) => {
    if (c.hops.length === 0) {
      return `- ${c.evidenceId} ${c.evidenceName}: sin registros de custodia (cadena no iniciada).`;
    }
    const lines = c.hops.map((h, i) =>
      `    ${i + 1}) ${h.date || 's/f'} ${h.time || 's/h'} — entrega: ${h.from || '(sin registrar)'} → recibe: ${h.to || '(sin registrar)'} | propósito: ${h.purpose || '(sin registrar)'} | contenedor: ${h.container || '(sin registrar)'}`,
    );
    totalBreaks += c.breaks.length;
    const brk = c.breaks.length ? c.breaks.map((b) => `    ! ${b}`).join('\n') : '    Continuidad verificada en los traspasos registrados.';
    return `- ${c.evidenceId} ${c.evidenceName}:\n${lines.join('\n')}\n${brk}`;
  });
  return { text: blocks.join('\n') || 'No se diligenciaron registros de cadena de custodia.', totalBreaks };
}

function stageStatusText(state: SimState): string {
  return state.scenario.evidenceItems
    .map((e) => `- ${e.id} ${e.name}: etapa actual = ${currentStage(state.evidence[e.id]).label}`)
    .join('\n');
}

const STEP_KEYS: (keyof EvidenceState)[] = ['observed', 'photographed', 'marked', 'collected', 'packaged', 'labeled', 'custody', 'delivered'];

// Resumen por EMP/EF: pasos, contaminación (con causa) y novedades.
function perEvidenceText(state: SimState): string {
  return state.scenario.evidenceItems.map((e) => {
    const st = state.evidence[e.id];
    const done = STEP_KEYS.filter((k) => st[k]).length;
    const flags: string[] = [];
    if (st.contaminated) flags.push(`CONTAMINADO — ${st.contaminationReason || 'causa no registrada'}`);
    if (st.delivered) flags.push(`entregado a ${st.deliveredTo || 'destino'}`);
    const pend = pendingSteps(st);
    return `- ${e.id} ${e.name}: ${done}/8 pasos${flags.length ? '; ' + flags.join('; ') : ''}${pend.length ? `; pendiente: ${pend.join(', ')}` : ''}`;
  }).join('\n');
}

// Desempeño por competencia (rol vs acción): correspondencia entre el rol asumido
// y las acciones permitidas, según la Matriz de permisos (Sección 8 del documento).
function competenceText(state: SimState): string {
  const deny = state.log.filter((l) => l.competence === 'deny');
  const cond = state.log.filter((l) => l.competence === 'conditional');
  const rolesUsed = Array.from(new Set(state.log.map((l) => l.role).filter(Boolean))) as string[];
  const rolesLine = (rolesUsed.length ? rolesUsed : [state.role]).map(roleLabel).join(', ');
  const denyList = deny.length
    ? deny.slice().reverse().map((l) => `- ${timeOf(l.time)} [${roleLabel(l.role || state.role)}]: ${l.message}`).join('\n')
    : 'Ninguno.';
  return `Rol(es) asumido(s): ${rolesLine}
Acciones fuera de rol (bloqueadas): ${deny.length}
Acciones condicionadas: ${cond.length}

Detalle de intentos fuera de rol:
${denyList}`;
}

function labText(state: SimState): string {
  const delivered = state.scenario.evidenceItems.filter((e) => state.evidence[e.id].delivered);
  if (!delivered.length) return 'Ningún EMP/EF entregado aún al laboratorio.';
  return delivered.map((e) => {
    const st = state.evidence[e.id];
    const a = st.analyzed ? 'analizado' : 'pendiente de análisis';
    const s = st.stored ? 'almacenado' : 'pendiente de almacenamiento';
    return `- ${e.id} ${e.name}: ${a}; ${s}.`;
  }).join('\n');
}

function accessText(state: SimState): string {
  if (!state.accessLog.length) return 'Sin registro de ingreso/salida de personal.';
  return state.accessLog
    .map((a) => `- ${a.time || 's/h'} ${a.action} — ${a.person} (${a.role}) | zona: ${a.zone} | motivo: ${a.motive || '(sin registrar)'}`)
    .join('\n');
}

function salvamentoText(state: SimState): string {
  if (!state.salvamentoRecords.length) return 'No se registraron excepciones por salvamento.';
  return state.salvamentoRecords
    .map((r) => `- Movió: ${r.moved || '(sin registrar)'} | Razón: ${r.reason || '(sin registrar)'} | Entregó/informó a: ${r.deliveredTo || '(sin registrar)'}`)
    .join('\n');
}

export function buildReport(state: SimState): string {
  const s = state.scenario;
  const items = s.evidenceItems;
  const total = items.length;
  const delivered = items.filter((e) => state.evidence[e.id].delivered).length;
  const contaminated = items.filter((e) => state.evidence[e.id].contaminated).length;

  const pending = items.filter((e) => !state.evidence[e.id].delivered)
    .map((e) => `- ${e.id} ${e.name}: ${pendingSteps(state.evidence[e.id]).join(', ') || 'sin pendientes'}`)
    .join('\n') || 'Ninguno.';

  const trace = custodyTraceText(state);
  const stages = stageStatusText(state);
  const competence = competenceText(state);

  const errors = state.log.filter((l) => l.type === 'bad' || l.type === 'warn').slice().reverse()
    .map((l) => `- ${timeOf(l.time)}: ${l.message}`)
    .join('\n') || 'Sin errores o advertencias registradas.';

  return `SIMULADOR 3D DE INVESTIGACIÓN JUDICIAL Y CADENA DE CUSTODIA

Escenario: ${s.title}
ID: ${s.scenarioId}
Rol: ${roleLabel(state.role)}
NUNC ficticio: ${s.nunc}
Referencia penal: ${s.penalReference}

PUNTAJE FINAL: ${state.score}
CLASIFICACIÓN: ${grade(state.score)}
PROGRESO: ${progressPercent(state)}%

ACCIONES GLOBALES
- EPP: ${state.globals.epp ? 'Sí' : 'No'}
- Acordonamiento: ${state.globals.cordon ? 'Sí' : 'No'}
- Ruta ingreso/salida: ${state.globals.route ? 'Sí' : 'No'}
- Método de búsqueda: ${state.globals.searchMethod ? 'Sí' : 'No'} (${state.searchMethodChoice})
- Gestión de testigos: ${state.globals.interview ? 'Sí' : 'No'}
- Reporte de iniciación: ${state.globals.reportInit ? 'Sí' : 'No'}

RESULTADO EMP/EF
- Total EMP/EF: ${total}
- Entregados: ${delivered}
- Contaminados o con error grave: ${contaminated}

ESTADO POR ETAPA (máquina de 7 etapas)
${stages}

RESUMEN POR EMP/EF (estado y novedades)
${perEvidenceText(state)}

PENDIENTES
${pending}

TRAZABILIDAD DE LA CADENA DE CUSTODIA (Ley 906/2004 art. 254)
Rupturas de continuidad detectadas: ${trace.totalBreaks}
${trace.text}

DESEMPEÑO POR COMPETENCIA (rol vs acción) — Matriz de permisos, Sección 8
${competence}

ERRORES Y ADVERTENCIAS
${errors}

CONTROL DE ACCESO (Sección 9, regla 3)
${accessText(state)}

EXCEPCIONES POR SALVAMENTO (Sección 9, regla 5)
${salvamentoText(state)}

CONTINUIDAD DE LABORATORIO (Sección 9, regla 7: procesamiento de escena ≠ análisis de laboratorio)
${labText(state)}

CIERRE DE ESCENA (Sección 9, regla 10)
- Inventario: ${total} EMP/EF; entregados ${delivered}; pendientes ${total - delivered}; con alteración ${contaminated}.
- Liberación formal del lugar: ${state.finalized ? 'registrada' : 'no registrada'}.

RETROALIMENTACIÓN
${feedbackText(delivered, total, contaminated, state.score)}

Nota: este informe es académico y no reemplaza formatos oficiales reales.`;
}

export function exportData(state: SimState) {
  return {
    scenario: state.scenario,
    role: state.role,
    score: state.score,
    grade: grade(state.score),
    global: state.globals,
    records: state.records,
    log: state.log,
  };
}

export function buildCSV(state: SimState): string {
  const rows: string[][] = [['fecha', 'tipo', 'puntos', 'puntaje', 'mensaje']];
  state.log.slice().reverse().forEach((l) => rows.push([l.time, l.type, String(l.points), String(l.score), l.message]));
  return rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

// Validación equivalente a validateScenario() del HTML original.
export function validateScenario(s: unknown): asserts s is Scenario {
  const sc = s as Partial<Scenario>;
  if (!sc || !sc.scenarioId || !sc.title || !Array.isArray(sc.evidenceItems))
    throw new Error('Debe contener scenarioId, title y evidenceItems[].');
  sc.evidenceItems.forEach((e) => {
    if (!e.id || !e.name || typeof e.x !== 'number' || typeof e.z !== 'number')
      throw new Error('Cada EMP/EF requiere id, name, x y z.');
  });
}

// --- Informe estructurado (vista imprimible, sin datos personales) ---

export interface ReportModel {
  caseTitle: string;
  nunc: string;
  location: string;
  mode: SimState['practice']['mode'];
  /** Hora ISO de la primera acción (inicio de la práctica). */
  startedAt: string | null;
  /** Rol con el que inició y roles que actuaron (en orden de aparición). */
  initialRole: string;
  roles: string[];
  score: number;
  grade: string;
  verdict: string;
  progress: number;
  delivered: number;
  total: number;
  contaminated: number;
  evidence: { id: string; name: string; done: number; contaminated: boolean; reason: string | null; deliveredTo: string | null; pending: string[] }[];
  /** Errores y alertas en orden cronológico. */
  mistakes: { time: string; role: string; message: string; points: number }[];
  offRole: number;
  custodyBreaks: number;
  accessRecords: number;
  salvamento: number;
  finalized: boolean;
}

export function reportModel(state: SimState): ReportModel {
  const items = state.scenario.evidenceItems;
  const total = items.length;
  const delivered = items.filter((e) => state.evidence[e.id].delivered).length;
  const contaminated = items.filter((e) => state.evidence[e.id].contaminated).length;
  const chrono = state.log.slice().reverse();
  const roles = Array.from(new Set(chrono.map((l) => l.role).filter((r): r is string => !!r)));
  return {
    caseTitle: state.scenario.title,
    nunc: state.scenario.nunc,
    location: state.scenario.sceneLocation,
    mode: state.practice.mode,
    startedAt: chrono[0]?.time ?? null,
    initialRole: roles[0] ?? state.role,
    roles: roles.length ? roles : [state.role],
    score: state.score,
    grade: grade(state.score),
    verdict: feedbackText(delivered, total, contaminated, state.score),
    progress: progressPercent(state),
    delivered, total, contaminated,
    evidence: items.map((e) => {
      const st = state.evidence[e.id];
      return {
        id: e.id, name: e.name, done: STEP_KEYS.filter((k) => st[k]).length,
        contaminated: st.contaminated, reason: st.contaminationReason, deliveredTo: st.deliveredTo, pending: pendingSteps(st),
      };
    }),
    mistakes: chrono.filter((l) => l.type === 'bad' || l.type === 'warn').map((l) => ({
      time: timeOf(l.time), role: roleLabel(l.role || state.role), message: l.message.replace(/^[+-]?\d+ pts - /, ''), points: l.points,
    })),
    offRole: state.log.filter((l) => l.competence === 'deny').length,
    custodyBreaks: custodyTraceText(state).totalBreaks,
    accessRecords: state.accessLog.length,
    salvamento: state.salvamentoRecords.length,
    finalized: state.finalized,
  };
}
