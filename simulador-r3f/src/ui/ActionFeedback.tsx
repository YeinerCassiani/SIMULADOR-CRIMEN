import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import type { LogEntry, LogType } from '../types';
import { freshEntries, logKey, stripPoints } from './logic';

const ICON: Record<LogType, typeof Info> = { good: CircleCheck, bad: CircleX, warn: TriangleAlert, info: Info };
const SHOW_MS = 7000;

// Tarjeta de respuesta sobre la bandeja: muestra lo que acaba de pasar (mensaje y
// puntos) sin que el estudiante tenga que abrir la bitácora. Se oculta sola a los
// 7 s o con la X. En modo evaluación (`neutral`) solo confirma que quedó registrado.
export function ActionFeedback({ log, neutral = false }: { log: LogEntry[]; neutral?: boolean }) {
  const [seen, setSeen] = useState(() => logKey(log[0]));
  const newest = logKey(log[0]);
  const fresh = freshEntries(log, seen);

  useEffect(() => {
    if (!fresh.length) return;
    const id = setTimeout(() => setSeen(newest), SHOW_MS);
    return () => clearTimeout(id);
  }, [newest, fresh.length]);

  if (!fresh.length) return null;
  return (
    <div className="feedback" role="status" aria-live="polite">
      {neutral ? (
        <p className="fb-item log-info"><Info size={18} strokeWidth={1.75} aria-hidden="true" /><span className="fb-msg">Acción registrada. El resultado se verá en el informe final.</span></p>
      ) : (
        fresh.map((l, i) => {
          const Icon = ICON[l.type];
          return (
            <p key={i} className={`fb-item log-${l.type}`}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="fb-msg">{stripPoints(l.message)}</span>
              {l.points !== 0 && <span className="fb-pts num">{l.points > 0 ? '+' : ''}{l.points}</span>}
            </p>
          );
        })
      )}
      <button type="button" className="btn-icon fb-close" aria-label="Ocultar aviso" onClick={() => setSeen(newest)}>
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
