import type { Dispatch } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Archive, Camera, CircleAlert, Eye, FlaskConical, Hand, Hash, Link2, Lock, Package, Tag, Truck } from 'lucide-react';
import type { Action, SimState } from '../simulator';
import type { ToolId } from '../types';
import { TOOLS, actionAriaLabel, permMark, toolLabel } from './logic';

const TOOL_ICON: Record<ToolId, LucideIcon> = {
  OBSERVE: Eye, PHOTOGRAPH: Camera, MARK: Hash, COLLECT: Hand, PACKAGE: Package,
  LABEL: Tag, CUSTODY: Link2, DELIVER: Truck, ANALYZE: FlaskConical, STORE: Archive,
};

// Bandeja inferior con las 10 herramientas. La activa se marca con la línea de acento
// de 1px del ancho de su etiqueta; el permiso del rol es un ícono (candado o condición)
// con su texto en el nombre accesible y en el tooltip.
export function ToolTray({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const active = state.selectedTool;
  return (
    <div className="tray" role="group" aria-label="Herramientas EMP/EF">
      <div className="tray-tools">
        {TOOLS.map((t) => {
          const Icon = TOOL_ICON[t.id];
          const mark = permMark(state.role, t.id);
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`tool${on ? ' is-on' : ''}${mark ? ' perm-' + mark.kind : ''}`}
              aria-pressed={on}
              aria-label={actionAriaLabel(t.label, mark)}
              title={mark ? `${t.label}. ${mark.reason}` : t.label}
              onClick={() => dispatch({ type: 'SELECT_TOOL', tool: on ? null : t.id })}
            >
              <span className="tool-icon">
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {mark?.kind === 'deny' && <Lock className="tool-perm deny" size={12} strokeWidth={2} aria-hidden="true" />}
                {mark?.kind === 'cond' && <CircleAlert className="tool-perm cond" size={12} strokeWidth={2} aria-hidden="true" />}
              </span>
              <span className="tool-label sel-line">{t.short}</span>
            </button>
          );
        })}
      </div>
      <p className="tray-hint" aria-live="polite">
        {active
          ? <>Herramienta activa: <b>{toolLabel(active)}</b>. Haga clic en un EMP/EF de la escena o de la lista del inspector.</>
          : 'Elija una herramienta y luego un EMP/EF en la escena o en la lista del inspector.'}
      </p>
    </div>
  );
}
