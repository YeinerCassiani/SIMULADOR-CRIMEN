import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SimState } from '../simulator';
import { fmtClock } from './logic';

// Bitácora como cajón plegable al pie del inspector. La cabecera siempre visible
// cuenta las entradas; el cuerpo es un role=log con la entrada más reciente arriba.
// El reducer guarda la bitácora con la entrada más reciente en la posición 0.
export function LogDrawer({ state, open, onToggle }: { state: SimState; open: boolean; onToggle: () => void }) {
  const n = state.log.length;
  const last = state.log[0];
  return (
    <section className={`drawer${open ? ' is-open' : ''}`} aria-label="Bitácora">
      <button type="button" className="drawer-head" aria-expanded={open} aria-controls="log-body" onClick={onToggle}>
        <span className="drawer-title">Bitácora</span>
        <span className="num muted">{n} {n === 1 ? 'entrada' : 'entradas'}</span>
        {open ? <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" /> : <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />}
      </button>
      {!open && last && <p className={`drawer-last log-${last.type}`}>{last.message}</p>}
      <div id="log-body" className="log" role="log" aria-live="polite" hidden={!open}>
        {n === 0 && <p className="meta">Sin acciones todavía.</p>}
        {state.log.map((l, i) => (
          <div key={n - i} className={`log-item log-${l.type}`}>
            <span className="log-time num">{fmtClock(l.time)}</span>
            <span className="log-msg">{l.message}</span>
            {l.points !== 0 && <span className="log-pts num">{l.points > 0 ? '+' : ''}{l.points}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
