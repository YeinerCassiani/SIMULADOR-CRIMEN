import type { Dispatch } from 'react';
import type { Action, SimState } from '../simulator';
import { grade, riskOfTool } from '../simulator';
import { SEARCH_METHODS } from '../types';
import type { EvidenceState, ToolId } from '../types';
import { buildReport, exportData, buildCSV, downloadText } from '../report';
import { currentStage, nextStage } from '../stages';
import { ROLE_DEFS, resolvePermission, capabilitySummary, LEVEL_LABEL, type ActionKey } from '../roles';
import { ProcedurePanel } from './ProcedurePanel';

// Badge de permiso para una acción según el rol activo: 🔒 (no permitido) o ~ (condicionado).
function permBadge(role: string, actionKey: ActionKey): { mark: string; title: string; cls: string } | null {
  const p = resolvePermission(role, actionKey);
  if (p.level === 'deny') return { mark: '🔒', title: p.reason, cls: 'deny' };
  if (p.level === 'conditional') return { mark: '~', title: p.reason, cls: 'cond' };
  return null;
}

interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
}

const TOOLS: { id: ToolId; label: string }[] = [
  { id: 'OBSERVE', label: 'Observar' },
  { id: 'PHOTOGRAPH', label: 'Fotografiar' },
  { id: 'MARK', label: 'Numerador' },
  { id: 'COLLECT', label: 'Recolectar' },
  { id: 'PACKAGE', label: 'Embalar' },
  { id: 'LABEL', label: 'Rotular' },
  { id: 'CUSTODY', label: 'Cadena custodia' },
  { id: 'DELIVER', label: 'Entregar' },
  { id: 'ANALYZE', label: 'Analizar (lab)' },
  { id: 'STORE', label: 'Almacenar (lab)' },
];

const GLOBALS: { id: 'EPP' | 'CORDON' | 'ROUTE' | 'SEARCH_METHOD' | 'INTERVIEW' | 'REPORT_INIT' | 'HANDOVER'; label: string; flag: keyof SimState['globals'] }[] = [
  { id: 'EPP', label: 'Usar EPP', flag: 'epp' },
  { id: 'CORDON', label: 'Acordonar', flag: 'cordon' },
  { id: 'ROUTE', label: 'Ruta ingreso/salida', flag: 'route' },
  { id: 'SEARCH_METHOD', label: 'Método de búsqueda', flag: 'searchMethod' },
  { id: 'INTERVIEW', label: 'Separar/entrevistar testigos', flag: 'interview' },
  { id: 'REPORT_INIT', label: 'Reporte de iniciación', flag: 'reportInit' },
  { id: 'HANDOVER', label: 'Entrega formal del lugar', flag: 'handover' },
];

const PILLS: { key: keyof EvidenceState; label: string }[] = [
  { key: 'observed', label: 'Observado' },
  { key: 'photographed', label: 'Fotografiado' },
  { key: 'marked', label: 'Señalizado' },
  { key: 'collected', label: 'Recolectado' },
  { key: 'packaged', label: 'Embalado' },
  { key: 'labeled', label: 'Rotulado' },
  { key: 'custody', label: 'Cadena' },
  { key: 'delivered', label: 'Entregado' },
];

function stepsDone(st: EvidenceState): number {
  return PILLS.filter((p) => st[p.key]).length;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function Hud({ state, dispatch }: Props) {
  const selected = state.scenario.evidenceItems.find((e) => e.id === state.selectedEvidenceId);
  const st = selected ? state.evidence[selected.id] : null;

  const pickEvidence = (id: string) => {
    if (state.selectedTool) {
      const warnings = riskOfTool(state.selectedTool, id, state);
      if (warnings.length) dispatch({ type: 'OPEN_MODAL', modal: { kind: 'confirm', evidenceId: id, tool: state.selectedTool, warnings } });
      else dispatch({ type: 'APPLY_TOOL', id });
    } else dispatch({ type: 'SELECT_EVIDENCE', id });
  };

  return (
    <>
      <aside className="panel panel-left" aria-label="Configuración y herramientas">
        <div className="section-title">Configuración</div>
        <label htmlFor="roleSel">Rol del participante</label>
        <select id="roleSel" value={state.role} onChange={(e) => dispatch({ type: 'SET_ROLE', role: e.target.value })}>
          {ROLE_DEFS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <p className="hint">{ROLE_DEFS.find((r) => r.id === state.role)?.description}</p>

        <div className="section-title">Permisos del rol</div>
        <div className="perm-list">
          {capabilitySummary(state.role).map((c) => (
            <div key={c.capability} className="perm-row" title={c.note}>
              <span className="perm-cap">{c.label}</span>
              <span className={`perm-badge ${c.level}`}>{LEVEL_LABEL[c.level]}</span>
            </div>
          ))}
        </div>
        <p className="hint">Una acción correcta hecha por un rol no facultado se bloquea y resta puntos (Matriz de permisos, Sección 8).</p>
        <label htmlFor="scnSel">Escenario</label>
        <select id="scnSel" value={state.scenarioIndex} onChange={(e) => dispatch({ type: 'LOAD_SCENARIO', index: Number(e.target.value) })}>
          {state.scenarios.map((s, i) => <option key={s.scenarioId + i} value={i}>{s.title}</option>)}
        </select>
        <div className="grid2" style={{ marginTop: 10 }}>
          <button onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'manual' } })}>Manual</button>
          <button onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'teacher' } })}>Editor docente</button>
          <button onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'manuals' } })}>Marco normativo</button>
          <button className={state.globals.salvamento ? 'active' : ''} onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'salvamento' } })}>Salvamento</button>
          <button onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'access' } })}>Registro acceso</button>
        </div>

        <div className="scoreBox" aria-live="polite">
          <div className="metric"><div className="n">{state.score}</div><div className="t">Puntaje</div></div>
          <div className="metric"><div className="n">{grade(state.score)}</div><div className="t">Nivel</div></div>
        </div>

        {state.timeLeft != null && (
          <div className={`timer ${state.timeLeft <= 30 ? 'low' : ''}`} role="timer" aria-live="off">
            ⏱ Tiempo de escena: <b>{fmtTime(state.timeLeft)}</b>
            {state.timeLeft === 0 && ' — riesgo de pérdida de EMP/EF'}
          </div>
        )}

        <ProcedurePanel state={state} />

        <div className="section-title">Acciones globales</div>
        <div className="grid2">
          {GLOBALS.map((g) => {
            const badge = permBadge(state.role, g.id);
            return (
              <button
                key={g.id}
                aria-pressed={state.globals[g.flag]}
                aria-label={badge ? `${g.label} — ${badge.title}` : g.label}
                title={badge?.title}
                className={`${state.globals[g.flag] ? 'active' : ''} ${badge ? 'perm-' + badge.cls : ''}`}
                onClick={() => dispatch({ type: 'APPLY_GLOBAL', action: g.id })}
              >{badge && <span className="btn-lock">{badge.mark}</span>}{g.label}</button>
            );
          })}
        </div>

        <label htmlFor="searchSel">Método de búsqueda</label>
        <select id="searchSel" value={state.searchMethodChoice} onChange={(e) => dispatch({ type: 'SET_SEARCH_METHOD', value: e.target.value })}>
          {SEARCH_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <div className="section-title">Herramientas EMP/EF</div>
        <div className="grid2">
          {TOOLS.map((t) => {
            const badge = permBadge(state.role, t.id);
            return (
              <button
                key={t.id}
                aria-pressed={state.selectedTool === t.id}
                aria-label={badge ? `${t.label} — ${badge.title}` : t.label}
                title={badge?.title}
                className={`${state.selectedTool === t.id ? 'active' : ''} ${badge ? 'perm-' + badge.cls : ''}`}
                onClick={() => dispatch({ type: 'SELECT_TOOL', tool: state.selectedTool === t.id ? null : t.id })}
              >{badge && <span className="btn-lock">{badge.mark}</span>}{t.label}</button>
            );
          })}
        </div>
        <p className="hint">Elija una herramienta y haga clic sobre un EMP/EF en la escena 3D, o use la lista de la derecha (accesible por teclado).</p>
      </aside>

      <aside className="panel panel-right" aria-label="EMP/EF, testigos y bitácora">
        <div className="section-title">EMP/EF del escenario</div>
        <div className="evidence-list" role="list">
          {state.scenario.evidenceItems.map((e) => {
            const es = state.evidence[e.id];
            const done = stepsDone(es);
            const label = `${e.id} ${e.name}, ${done} de 8 pasos${es.contaminated ? ', contaminado' : ''}${es.delivered ? ', entregado' : ''}`;
            return (
              <button
                key={e.id}
                role="listitem"
                aria-label={`${state.selectedTool ? 'Aplicar ' + state.selectedTool + ' a ' : 'Seleccionar '}${label}`}
                className={`evidence-row ${state.selectedEvidenceId === e.id ? 'sel' : ''}`}
                onClick={() => pickEvidence(e.id)}
              >
                <span className="er-title">{e.id} · {e.name}</span>
                <span className="er-meta">{done}/8 pasos{es.contaminated ? ' · ⚠ contaminado' : ''}{es.delivered ? ' · ✓ entregado' : ''}</span>
              </button>
            );
          })}
        </div>

        {selected && st && (
          <div className="evidence-card" aria-live="polite">
            <h3>{selected.id} · {selected.name}</h3>
            <div className="small">{selected.description}</div>
            <div className="small"><b>Naturaleza:</b> {selected.nature}{st.deliveredTo && <><br /><b>Entregado a:</b> {st.deliveredTo}</>}</div>
            <div className="small stage-line">
              <b>Etapa actual:</b> {currentStage(st).label}
              {nextStage(st) && <><br /><b>Siguiente:</b> {nextStage(st)!.label}</>}
              <br /><span className="legal-note">{currentStage(st).legalBasis}</span>
            </div>
            <div className="pills">
              {PILLS.map((p) => <span key={p.key} className={`pill ${st[p.key] ? 'ok' : ''}`}>{st[p.key] ? '✓ ' : ''}{p.label}</span>)}
              {st.contaminated && <span className="pill bad">⚠ Contaminado</span>}
            </div>
            {st.contaminated && st.contaminationReason && <p className="legal-note" style={{ marginTop: 6 }}><b>Motivo de contaminación:</b> {st.contaminationReason}</p>}
            {st.delivered && <p className="legal-note" style={{ marginTop: 6 }}><b>Laboratorio:</b> {st.analyzed ? '✓ analizado' : 'pendiente de análisis'}{st.stored ? ' · ✓ almacenado' : st.analyzed ? ' · pendiente de almacenar' : ''}</p>}
          </div>
        )}

        {state.scenario.witnesses.length > 0 && (
          <>
            <div className="section-title">Testigos</div>
            <div className="witness-list">
              {state.scenario.witnesses.map((w) => {
                const ws = state.witnesses[w.id];
                const next = !ws.separated ? 'Separar' : !ws.interviewed ? 'Entrevistar' : 'Gestionado';
                const status = ws.interviewed ? '✓ Entrevistado' : ws.separated ? '✓ Separado' : 'Sin gestionar';
                return (
                  <div key={w.id} className="witness-row">
                    <span><b>{w.name}</b><br /><span className="small">{status}</span></span>
                    <button disabled={ws.interviewed} aria-label={`${next} a ${w.name}`} onClick={() => dispatch({ type: 'WITNESS_ACTION', id: w.id })}>{next}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="section-title">Bitácora</div>
        <div className="log" role="log" aria-live="polite">
          {state.log.length === 0 && <p className="hint">Sin acciones todavía.</p>}
          {state.log.map((l, i) => (
            <div key={i} className={`log-item ${l.type}`}>
              <b>{new Date(l.time).toLocaleTimeString('es-CO', { hour12: false })}</b><br />{l.message}
            </div>
          ))}
        </div>

        <div className="section-title">Cierre y descargas</div>
        <button className="good full-btn" onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'closure' } })}>Cerrar y finalizar</button>
        <div className="grid2" style={{ marginTop: 8 }}>
          <button onClick={() => downloadText('informe_simulador_cadena_custodia.txt', buildReport(state))}>Informe TXT</button>
          <button onClick={() => downloadText('registro_simulador.json', JSON.stringify(exportData(state), null, 2))}>Registro JSON</button>
          <button onClick={() => downloadText('bitacora_simulador.csv', buildCSV(state))}>Bitácora CSV</button>
          <button className="bad" onClick={() => { if (confirm('¿Reiniciar la práctica actual?')) dispatch({ type: 'RESET' }); }}>Reiniciar</button>
        </div>
        {state.finalized && <p className="hint">Práctica finalizada: las acciones quedan bloqueadas. Use Reiniciar para una nueva práctica.</p>}
      </aside>
    </>
  );
}
