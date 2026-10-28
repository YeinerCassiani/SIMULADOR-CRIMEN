import type { Dispatch } from 'react';
import { ChevronDown, Flashlight, PanelRight, PanelRightClose, Scan, Timer } from 'lucide-react';
import type { Action, SimState } from '../simulator';
import { grade } from '../simulator';
import { ROLE_DEFS } from '../roles';
import { AMBIENTE_LABEL, fmtTime } from './logic';

interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
  forensicLight: boolean;
  onToggleForensic: () => void;
  onOverview: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

// Barra superior: caso (selector de escenario sobre el título), número de caso,
// ambiente, rol, cronómetro, puntaje, nivel y controles de vista.
export function TopBar({ state, dispatch, forensicLight, onToggleForensic, onOverview, inspectorOpen, onToggleInspector }: Props) {
  const { scenario, timeLeft } = state;
  const low = timeLeft != null && timeLeft <= 30;
  return (
    <header className="topbar">
      <div className="case">
        <div className="case-switch">
          <h1 className="case-title"><span className="case-title-text">{scenario.title}</span><ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /></h1>
          <select
            className="case-select"
            aria-label="Escenario"
            data-eval="scenario"
            value={state.scenarioIndex}
            onChange={(e) => dispatch({ type: 'LOAD_SCENARIO', index: Number(e.target.value) })}
          >
            {state.scenarios.map((s, i) => <option key={s.scenarioId + i} value={i}>{s.title}</option>)}
          </select>
        </div>
        <p className="case-meta">
          <span className="num">NUNC {scenario.nunc}</span>
          <span aria-hidden="true"> · </span>
          <span>{AMBIENTE_LABEL[scenario.environmentType] ?? scenario.environmentType}</span>
        </p>
      </div>

      <div className="topbar-right">
        <label className="role-field">
          <span className="role-field-label">Rol</span>
          <select id="roleSel" className="control" value={state.role} onChange={(e) => dispatch({ type: 'SET_ROLE', role: e.target.value })}>
            {ROLE_DEFS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>

        <dl className="figures">
          {timeLeft != null && (
            <div className={`figure${low ? ' is-low' : ''}`} role="timer" aria-live="off" aria-label={`Tiempo de escena ${fmtTime(timeLeft)}${timeLeft === 0 ? ', riesgo de pérdida de EMP/EF' : ''}`}>
              <dt><Timer size={14} strokeWidth={1.5} aria-hidden="true" /> Tiempo</dt>
              <dd className="num">{fmtTime(timeLeft)}</dd>
            </div>
          )}
          <div className="figure" aria-live="polite">
            <dt>Puntaje</dt>
            <dd className="num">{state.score}</dd>
          </div>
          <div className="figure">
            <dt>Nivel</dt>
            <dd>{grade(state.score)}</dd>
          </div>
        </dl>

        <div className="view-tools">
          <button
            type="button"
            className={`btn-text toggle${forensicLight ? ' is-on' : ''}`}
            aria-pressed={forensicLight}
            data-eval="forensic-toggle"
            onClick={onToggleForensic}
          >
            <Flashlight size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="sel-line">Luz forense</span>
            <kbd className="kbd" aria-hidden="true">L</kbd>
          </button>
          <button type="button" className="btn-icon" aria-label="Vista general (Esc)" data-tip="Vista general (Esc)" onClick={onOverview}>
            <Scan size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={inspectorOpen ? 'Ocultar inspector' : 'Mostrar inspector'}
            aria-expanded={inspectorOpen}
            aria-controls="inspector"
            data-tip={inspectorOpen ? 'Ocultar inspector' : 'Mostrar inspector'}
            onClick={onToggleInspector}
          >
            {inspectorOpen ? <PanelRightClose size={18} strokeWidth={1.5} aria-hidden="true" /> : <PanelRight size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {timeLeft === 0 && <p className="topbar-alert" role="status">Tiempo agotado: riesgo de pérdida de EMP/EF no recolectados.</p>}
    </header>
  );
}
