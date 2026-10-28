import type { Dispatch } from 'react';
import { Check, CircleAlert, Footprints, Lock, Maximize, Minus, Plus, RotateCcw, RotateCw, Search } from 'lucide-react';
import type { Action, SimState } from '../simulator';
import type { ToolId } from '../types';
import type { CameraCmd } from '../scene/contracts';
import { ACTION_NAME, EVIDENCE_CYCLE, nextStep, planTool, type NextStep } from '../flow';
import { roleLabel } from '../roles';
import { permMark } from './logic';

// Ayudas de la práctica: barra de siguiente paso (solo guiada), acciones del EMP/EF
// seleccionado (acción por objeto) y botones de cámara.

/** Barra "Siguiente paso" sobre la escena. Solo en práctica guiada. */
export function NextStepBar({ state, onShow }: { state: SimState; onShow: (s: NextStep) => void }) {
  if (state.practice.mode !== 'guiada') return null;
  const s = nextStep(state);
  if (!s) return null;
  return (
    <div className="next-step" role="status" aria-live="polite" data-next-step>
      <Footprints size={20} strokeWidth={1.75} aria-hidden="true" className="next-ic" />
      <div className="next-body">
        <span className="next-kicker">Siguiente paso</span>
        <span className="next-text">{s.text}</span>
        {s.owner && <span className="next-owner">Le corresponde a {roleLabel(s.owner)}: al hacerlo se le ofrecerá el relevo de rol.</span>}
      </div>
      <button type="button" className="btn-primary next-btn" onClick={() => onShow(s)}>
        <Search size={16} aria-hidden="true" /> Mostrarme dónde
      </button>
    </div>
  );
}

const LAB_STEPS: { tool: ToolId; done: 'analyzed' | 'stored' }[] = [
  { tool: 'ANALYZE', done: 'analyzed' },
  { tool: 'STORE', done: 'stored' },
];

/** Pasos del EMP/EF seleccionado, en orden, como botones (lo que se le puede hacer). */
export function EvidenceActions({ state, dispatch, id }: { state: SimState; dispatch: Dispatch<Action>; id: string }) {
  const st = state.evidence[id];
  if (!st) return null;
  // Solo se marca "Siguiente" si el paso del procedimiento es este EMP/EF: así la
  // tarjeta y la barra de siguiente paso nunca dan indicaciones distintas.
  const guide = state.practice.mode === 'guiada' ? nextStep(state) : null;
  const next = guide?.target.kind === 'evidence' && guide.target.id === id ? guide.target.tool : null;
  const rows = [
    ...EVIDENCE_CYCLE.map((c) => ({ tool: c.tool, done: st[c.key] as boolean })),
    ...(st.delivered ? LAB_STEPS.map((l) => ({ tool: l.tool, done: st[l.done] })) : []),
  ];
  return (
    <ol className="ev-steps" aria-label="Pasos del EMP/EF">
      {rows.map(({ tool, done }, i) => {
        const mark = permMark(state.role, tool);
        const isNext = tool === next;
        return (
          <li key={tool}>
            <button
              type="button"
              data-step={tool}
              className={`ev-step${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}
              disabled={done || state.finalized}
              aria-label={`${i + 1}. ${ACTION_NAME[tool]}${done ? ', hecho' : ''}${mark ? `. ${mark.text}` : ''}`}
              title={mark?.reason}
              onClick={() => dispatch(planTool(state, tool, id))}
            >
              <span className="ev-step-n num" aria-hidden="true">{done ? <Check size={14} strokeWidth={2.25} /> : i + 1}</span>
              <span className="ev-step-label">{ACTION_NAME[tool]}</span>
              {!done && mark?.kind === 'deny' && <Lock className="perm-ic deny" size={14} strokeWidth={1.75} aria-hidden="true" />}
              {!done && mark?.kind === 'cond' && <CircleAlert className="perm-ic cond" size={14} strokeWidth={1.75} aria-hidden="true" />}
              {isNext && <span className="ev-step-tag">Siguiente</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const CAM: { cmd: CameraCmd; label: string; Icon: typeof Plus }[] = [
  { cmd: 'in', label: 'Acercar', Icon: Plus },
  { cmd: 'out', label: 'Alejar', Icon: Minus },
  { cmd: 'left', label: 'Girar a la izquierda', Icon: RotateCcw },
  { cmd: 'right', label: 'Girar a la derecha', Icon: RotateCw },
];

/** Botones de cámara: alternativa visible al arrastre y la rueda del ratón. */
export function CameraPad({ onCmd, onOverview }: { onCmd: (c: CameraCmd) => void; onOverview: () => void }) {
  return (
    <div className="cam-pad" role="group" aria-label="Mover la cámara">
      {CAM.map(({ cmd, label, Icon }) => (
        <button key={cmd} type="button" className="cam-btn" aria-label={label} data-tip={label} onClick={() => onCmd(cmd)}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ))}
      <button type="button" className="cam-btn cam-all" onClick={onOverview}>
        <Maximize size={16} strokeWidth={1.75} aria-hidden="true" /> Vista general
      </button>
    </div>
  );
}
