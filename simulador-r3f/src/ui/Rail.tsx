import type { LucideIcon } from 'lucide-react';
import { Box, CircleHelp, ListChecks, Scale, Settings } from 'lucide-react';
import { Monogram } from './Monogram';

/** Paneles del inspector; los demás destinos del riel abren un modal. */
export type PanelId = 'escena' | 'procedimiento' | 'ajustes';

export type RailTarget = PanelId | 'normativo' | 'manual';

interface Dest { id: RailTarget; label: string; short: string; icon: LucideIcon }

const MAIN: Dest[] = [
  { id: 'escena', label: 'Escena: EMP/EF, testigos y acciones', short: 'Escena', icon: Box },
  { id: 'procedimiento', label: 'Procedimiento: qué lleva hecho', short: 'Avance', icon: ListChecks },
  { id: 'normativo', label: 'Marco normativo', short: 'Normas', icon: Scale },
];
const UTIL: Dest[] = [
  { id: 'manual', label: 'Ayuda: cómo se usa', short: 'Ayuda', icon: CircleHelp },
  { id: 'ajustes', label: 'Ajustes: rol, relevo y calidad de imagen', short: 'Ajustes', icon: Settings },
];

interface Props {
  active: PanelId | null;
  onGo: (t: RailTarget) => void;
}

// Riel con ícono y nombre visible (escritorio) que pasa a barra inferior (< 1100px).
// El destino activo se marca con la línea de acento de 1px en el borde del riel.
export function Rail({ active, onGo }: Props) {
  const item = (d: Dest) => {
    const Icon = d.icon;
    const on = active === d.id;
    return (
      <li key={d.id}>
        <button
          type="button"
          className={`rail-btn${on ? ' is-on' : ''}`}
          aria-label={d.label}
          aria-current={on ? 'true' : undefined}
          data-tip={d.label}
          onClick={() => onGo(d.id)}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="rail-short">{d.short}</span>
        </button>
      </li>
    );
  };
  return (
    <nav className="rail" aria-label="Destinos del simulador">
      <div className="rail-mark" title="Simulador de escena del crimen">
        <Monogram size={32} />
        <span className="sr-only">Simulador de escena del crimen</span>
      </div>
      <ul className="rail-list">{MAIN.map(item)}</ul>
      <ul className="rail-list rail-util">{UTIL.map(item)}</ul>
    </nav>
  );
}
