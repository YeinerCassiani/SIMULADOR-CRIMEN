import { Flashlight, House, PanelRight, PanelRightClose, Timer, UserRound } from 'lucide-react';
import type { SimState } from '../simulator';
import { grade } from '../simulator';
import { roleLabel } from '../roles';
import { AMBIENTE_LABEL, fmtTime } from './logic';
import { MODE_LABEL } from './startLogic';

interface Props {
  state: SimState;
  forensicLight: boolean;
  onToggleForensic: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onHome: () => void;
  onRole: () => void;
}

// Barra superior: inicio, caso, rol y modo, cronómetro, puntaje (solo en práctica
// guiada) y controles de vista. El caso y el rol se eligen en la pantalla de inicio;
// aquí solo se muestran (el rol se cambia con un relevo, desde Ajustes o el aviso).
export function TopBar({ state, forensicLight, onToggleForensic, inspectorOpen, onToggleInspector, onHome, onRole }: Props) {
  const { scenario, timeLeft } = state;
  const low = timeLeft != null && timeLeft <= 30;
  const guided = state.practice.mode === 'guiada';
  return (
    <header className="topbar">
      <button type="button" className="btn-text home-btn" onClick={onHome} data-home>
        <House size={18} strokeWidth={1.75} aria-hidden="true" /> <span className="home-label">Inicio</span>
      </button>
      <div className="case">
        <h1 className="case-title"><span className="case-title-text">{scenario.title}</span></h1>
        <p className="case-meta">
          <span>{AMBIENTE_LABEL[scenario.environmentType] ?? scenario.environmentType}</span>
          <span aria-hidden="true"> · </span>
          <span>{MODE_LABEL[state.practice.mode]}</span>
        </p>
      </div>

      <div className="topbar-right">
        <button type="button" className="role-chip" onClick={onRole} aria-label={`Rol: ${roleLabel(state.role)}. Ver funciones o hacer relevo`}>
          <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="role-chip-text"><span className="role-chip-label">Rol</span> {roleLabel(state.role)}</span>
        </button>

        <dl className="figures">
          {timeLeft != null && (
            <div className={`figure${low ? ' is-low' : ''}`} role="timer" aria-live="off" aria-label={`Tiempo de escena ${fmtTime(timeLeft)}${timeLeft === 0 ? ', riesgo de pérdida de EMP/EF' : ''}`}>
              <dt><Timer size={14} strokeWidth={1.5} aria-hidden="true" /> Tiempo</dt>
              <dd className="num">{fmtTime(timeLeft)}</dd>
            </div>
          )}
          {guided && (
            <>
              <div className="figure" aria-live="polite">
                <dt>Puntaje</dt>
                <dd className="num">{state.score}</dd>
              </div>
              <div className="figure">
                <dt>Nivel</dt>
                <dd>{grade(state.score)}</dd>
              </div>
            </>
          )}
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
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={inspectorOpen ? 'Ocultar el panel del caso' : 'Mostrar el panel del caso'}
            aria-expanded={inspectorOpen}
            aria-controls="inspector"
            data-tip={inspectorOpen ? 'Ocultar el panel del caso' : 'Mostrar el panel del caso'}
            onClick={onToggleInspector}
          >
            {inspectorOpen ? <PanelRightClose size={18} strokeWidth={1.5} aria-hidden="true" /> : <PanelRight size={18} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {timeLeft === 0 && <p className="topbar-alert" role="status">Tiempo agotado: los EMP/EF no recolectados se dan por perdidos.</p>}
    </header>
  );
}
