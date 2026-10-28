import { useRef, type Dispatch, type KeyboardEvent } from 'react';
import { Check, CircleAlert, ClipboardList, Download, FileText, Flag, LifeBuoy, Lock, RotateCcw, TriangleAlert, X } from 'lucide-react';
import type { Action, SimState } from '../simulator';
import { SEARCH_METHODS } from '../types';
import { buildReport, buildCSV, downloadText, exportData } from '../report';
import { ROLE_DEFS, capabilitySummary, LEVEL_LABEL } from '../roles';
import { planGlobal, planWitness } from '../flow';
import { EvidenceActions } from './PracticeAids';
import type { QualityTier, ViewSettings } from '../scene/contracts';
import { EvidenceLabelCard } from './EvidenceLabelCard';
import { LogDrawer } from './LogDrawer';
import { ProcedurePanel } from './ProcedurePanel';
import type { PanelId } from './Rail';
import { QUALITY_OPTIONS, actionAriaLabel, nextIndex, permMark, stepsDone } from './logic';

type GlobalId = 'EPP' | 'CORDON' | 'ROUTE' | 'SEARCH_METHOD' | 'INTERVIEW' | 'REPORT_INIT' | 'HANDOVER';

const GLOBALS: { id: GlobalId; label: string; flag: keyof SimState['globals'] }[] = [
  { id: 'EPP', label: 'Usar EPP', flag: 'epp' },
  { id: 'CORDON', label: 'Acordonar', flag: 'cordon' },
  { id: 'ROUTE', label: 'Ruta ingreso/salida', flag: 'route' },
  { id: 'SEARCH_METHOD', label: 'Método de búsqueda', flag: 'searchMethod' },
  { id: 'INTERVIEW', label: 'Separar/entrevistar testigos', flag: 'interview' },
  { id: 'REPORT_INIT', label: 'Reporte de iniciación', flag: 'reportInit' },
  { id: 'HANDOVER', label: 'Entrega formal del lugar', flag: 'handover' },
];

const TABS: { id: PanelId; label: string }[] = [
  { id: 'escena', label: 'Escena' },
  { id: 'procedimiento', label: 'Avance' },
  { id: 'ajustes', label: 'Ajustes' },
];

interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
  open: boolean;
  panel: PanelId;
  onPanel: (p: PanelId) => void;
  onClose: () => void;
  logOpen: boolean;
  onToggleLog: () => void;
  view: ViewSettings;
  onQuality: (q: ViewSettings['quality']) => void;
  tier: QualityTier | null;
}

export function Inspector(props: Props) {
  const { open, panel, onPanel, onClose, state, logOpen, onToggleLog } = props;
  return (
    <aside id="inspector" className={`inspector${open ? ' is-open' : ''}`} aria-label="Panel del caso" hidden={!open}>
      <div className="insp-head">
        <div className="tabs" role="tablist" aria-label="Secciones del panel">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={panel === t.id}
              aria-controls="insp-body"
              className={`tab${panel === t.id ? ' is-on' : ''}`}
              onClick={() => onPanel(t.id)}
            ><span className="sel-line">{t.label}</span></button>
          ))}
        </div>
        <button type="button" className="btn-icon insp-close" aria-label="Cerrar el panel" onClick={onClose}>
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div id="insp-body" className="insp-body" role="tabpanel" aria-labelledby={`tab-${panel}`}>
        {panel === 'escena' && <ScenePanel {...props} />}
        {panel === 'procedimiento' && <ProcedurePanel state={state} />}
        {panel === 'ajustes' && <SettingsPanel {...props} />}
      </div>
      <LogDrawer state={state} open={logOpen} onToggle={onToggleLog} />
    </aside>
  );
}

function PermIcon({ kind }: { kind: 'deny' | 'cond' }) {
  return kind === 'deny'
    ? <Lock className="perm-ic deny" size={14} strokeWidth={1.75} aria-hidden="true" />
    : <CircleAlert className="perm-ic cond" size={14} strokeWidth={1.75} aria-hidden="true" />;
}

function ScenePanel({ state, dispatch, view }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const items = state.scenario.evidenceItems;
  const selected = items.find((e) => e.id === state.selectedEvidenceId);
  const st = selected ? state.evidence[selected.id] : null;

  const pickEvidence = (id: string) => dispatch({ type: 'SELECT_EVIDENCE', id: state.selectedEvidenceId === id ? null : id });
  const evaluation = state.practice.mode === 'evaluacion';

  // Flechas, Inicio y Fin mueven el foco entre los EMP/EF de la lista.
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button.ev-row') ?? []);
    const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
    const n = nextIndex(cur < 0 ? 0 : cur, btns.length, e.key);
    if (n !== cur && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); btns[n]?.focus(); }
  };

  return (
    <>
      {view.forensicLight && (
        <section className="section notice" aria-labelledby="fl-h">
          <h2 id="fl-h" className="section-h">Modo de luz alterna activo</h2>
          <p>La luz forense alterna (azul-violeta, con filtro) hace fluorescer fluidos biológicos y huellas latentes que no se ven a simple vista. Aquí es solo una ayuda visual: no suma puntos ni sustituye la observación, la fijación fotográfica ni la recolección técnica. Pulse L para volver a la luz normal.</p>
        </section>
      )}

      <section className="section" aria-labelledby="ev-h">
        <h2 id="ev-h" className="section-h">EMP/EF del escenario <span className="num muted">{items.length}</span></h2>
        <ul className="ev-list" ref={listRef} onKeyDown={onListKey}>
          {items.map((e) => {
            const es = state.evidence[e.id];
            const done = stepsDone(es);
            const label = `${e.id} ${e.name}, ${done} de 8 pasos${es.contaminated ? ', contaminado' : ''}${es.delivered ? ', entregado' : ''}`;
            const on = state.selectedEvidenceId === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={`ev-row${on ? ' is-on' : ''}`}
                  aria-current={on ? 'true' : undefined}
                  aria-label={`${on ? 'Cerrar' : 'Ver los pasos de'} ${label}`}
                  aria-expanded={on}
                  onClick={() => pickEvidence(e.id)}
                >
                  <span className="ev-plate num" aria-hidden="true">{e.id.split('-').pop()}</span>
                  <span className="ev-name"><span className="sel-line">{e.name}</span></span>
                  <span className="ev-meta">
                    {es.contaminated && <TriangleAlert className="neg" size={14} strokeWidth={1.75} aria-hidden="true" />}
                    {es.delivered && <Check className="pos" size={14} strokeWidth={2} aria-hidden="true" />}
                    <span className="num">{done}/8</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected && st
          ? (
            <div className="ev-detail">
              <h3 className="group-h">{selected.id} · {selected.name}</h3>
              <p className="meta">{selected.description}</p>
              <EvidenceActions state={state} dispatch={dispatch} id={selected.id} />
              <EvidenceLabelCard item={selected} st={st} scenario={state.scenario} />
            </div>
          )
          : <p className="empty">Toque un EMP/EF en la lista o en la escena para ver sus pasos.</p>}
      </section>

      {state.scenario.witnesses.length > 0 && (
        <section className="section" aria-labelledby="wit-h">
          <h2 id="wit-h" className="section-h">Testigos</h2>
          <ul className="rows">
            {state.scenario.witnesses.map((w) => {
              const ws = state.witnesses[w.id];
              const next = !ws.separated ? 'Separar' : !ws.interviewed ? 'Entrevistar' : 'Gestionado';
              const status = ws.interviewed ? 'Entrevistado' : ws.separated ? 'Separado' : 'Sin gestionar';
              return (
                <li key={w.id} className="row">
                  <span className="row-main"><span className="row-title">{w.name}</span><span className="meta">{status}</span></span>
                  <button type="button" className="btn-outline" data-witness={w.id} disabled={ws.interviewed || state.finalized} aria-label={`${next} a ${w.name}`} onClick={() => dispatch(planWitness(state, w.id))}>{next}</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="section" aria-labelledby="glob-h">
        <h2 id="glob-h" className="section-h">Acciones en la escena</h2>
        <ul className="actions">
          {GLOBALS.map((g) => {
            const mark = permMark(state.role, g.id);
            const on = state.globals[g.flag];
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={`action${on ? ' is-on' : ''}`}
                  data-global={g.id}
                  aria-pressed={on}
                  disabled={on || state.finalized}
                  aria-label={actionAriaLabel(g.label, mark)}
                  title={mark?.reason}
                  onClick={() => dispatch(planGlobal(state, g.id))}
                >
                  <span className="action-check" aria-hidden="true">{on && <Check size={14} strokeWidth={2} />}</span>
                  <span className="action-label">{g.label}</span>
                  {mark && <PermIcon kind={mark.kind} />}
                </button>
              </li>
            );
          })}
        </ul>
        <label className="field">
          <span className="field-label">Método de búsqueda</span>
          <select id="searchSel" className="control" value={state.searchMethodChoice} onChange={(e) => dispatch({ type: 'SET_SEARCH_METHOD', value: e.target.value })}>
            {SEARCH_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <div className="btn-row">
          <button type="button" className={`btn-outline${state.globals.salvamento ? ' is-on' : ''}`} aria-pressed={state.globals.salvamento} onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'salvamento' } })}>
            <LifeBuoy size={16} strokeWidth={1.5} aria-hidden="true" /> Salvamento
          </button>
          <button type="button" className="btn-outline" data-open="access" onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'access' } })}>
            <ClipboardList size={16} strokeWidth={1.5} aria-hidden="true" /> Registro acceso <span className="num muted">{state.accessLog.length}</span>
          </button>
        </div>
      </section>

      <section className="section" aria-labelledby="close-h">
        <h2 id="close-h" className="section-h">Terminar</h2>
        {!state.finalized
          ? <button type="button" className="btn-primary full" data-open="closure" onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'closure' } })}><Flag size={16} strokeWidth={1.75} aria-hidden="true" /> Cerrar la escena y finalizar</button>
          : <button type="button" className="btn-primary full" data-open="report" onClick={() => dispatch({ type: 'OPEN_MODAL', modal: { kind: 'report' } })}><FileText size={16} strokeWidth={1.75} aria-hidden="true" /> Ver y descargar el informe</button>}
        {state.finalized && <p className="meta">Práctica finalizada: las acciones quedan bloqueadas. Para practicar otra vez use Empezar de nuevo o vuelva al Inicio.</p>}
        {(!evaluation || state.finalized) && (
          <details className="more">
            <summary>Otros formatos de descarga</summary>
            <div className="btn-grid">
              <button type="button" className="btn-outline" onClick={() => downloadText('informe_simulador.txt', buildReport(state))}><Download size={16} strokeWidth={1.5} aria-hidden="true" /> Informe en texto</button>
              <button type="button" className="btn-outline" onClick={() => downloadText('bitacora_simulador.csv', buildCSV(state))}><Download size={16} strokeWidth={1.5} aria-hidden="true" /> Bitácora (hoja de cálculo)</button>
              <button type="button" className="btn-outline" onClick={() => downloadText('registro_simulador.json', JSON.stringify(exportData(state), null, 2))}><Download size={16} strokeWidth={1.5} aria-hidden="true" /> Registro técnico</button>
            </div>
          </details>
        )}
        <button type="button" className="btn-outline neg full" onClick={() => { if (confirm('¿Empezar de nuevo este caso? Se borra lo hecho en esta práctica.')) dispatch({ type: 'RESET' }); }}><RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" /> Empezar de nuevo</button>
      </section>
    </>
  );
}

function SettingsPanel({ state, dispatch, view, onQuality, tier }: Props) {
  const role = ROLE_DEFS.find((r) => r.id === state.role);
  return (
    <>
      <section className="section" aria-labelledby="role-h">
        <h2 id="role-h" className="section-h">Rol: {role?.label ?? state.role}</h2>
        <p>{role?.description}</p>
        <table className="perm-table">
          <caption className="sr-only">Permisos del rol</caption>
          <thead><tr><th scope="col">Capacidad</th><th scope="col">Permiso</th></tr></thead>
          <tbody>
            {capabilitySummary(state.role).map((c) => (
              <tr key={c.capability} title={c.note}>
                <th scope="row">{c.label}</th>
                <td className={`perm-${c.level}`}>
                  {c.level === 'allow' && <Check className="perm-ic allow" size={14} strokeWidth={2} aria-hidden="true" />}
                  {c.level === 'conditional' && <PermIcon kind="cond" />}
                  {c.level === 'deny' && <PermIcon kind="deny" />}
                  {LEVEL_LABEL[c.level]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="meta">Una acción hecha por un rol no facultado se bloquea y resta puntos (Matriz de permisos, Sección 8).</p>
        <label className="field">
          <span className="field-label">Relevo de rol: continuar como</span>
          <select className="control" data-relevo-select value={state.role} disabled={state.finalized} onChange={(e) => dispatch({ type: 'SET_ROLE', role: e.target.value })}>
            {ROLE_DEFS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <p className="meta">En una escena real cada quien entrega a la siguiente persona. El relevo queda en la bitácora con el rol de cada acción.</p>
      </section>

      <section className="section" aria-labelledby="q-h">
        <h2 id="q-h" className="section-h">Calidad de imagen</h2>
        <label className="field">
          <span className="field-label">Nivel de calidad</span>
          <select className="control" value={view.quality} onChange={(e) => onQuality(e.target.value as ViewSettings['quality'])}>
            {QUALITY_OPTIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        </label>
        <p className="meta">Ahora: <b>{tier ? tier[0].toUpperCase() + tier.slice(1) : 'calculando'}</b>. En automática, la imagen se simplifica sola si el equipo va lento. Si la escena se ve lenta o entrecortada, elija Baja.</p>
      </section>

      <section className="section" aria-labelledby="keys-h">
        <h2 id="keys-h" className="section-h">Atajos de teclado</h2>
        <dl className="keys">
          <div><dt><kbd className="kbd">L</kbd></dt><dd>Alterna la luz forense</dd></div>
          <div><dt><kbd className="kbd">Esc</kbd></dt><dd>Cierra el diálogo abierto; sin diálogo, vuelve a la vista general</dd></div>
          <div><dt><kbd className="kbd">Flechas</kbd></dt><dd>Recorren la lista de EMP/EF</dd></div>
          <div><dt>Ratón</dt><dd>Arrastre para girar la vista; la rueda acerca y aleja</dd></div>
        </dl>
      </section>
    </>
  );
}
