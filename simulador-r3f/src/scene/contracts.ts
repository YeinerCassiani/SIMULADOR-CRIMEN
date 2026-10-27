// Contrato entre la interfaz (src/ui, App) y la escena 3D (src/scene).
// Es la única frontera compartida: la UI decide los ajustes de vista y la escena
// los respeta. Cambiar estos tipos es un cambio de contrato: actualizar ambos lados.
import type { Dispatch } from 'react';
import type { Action, SimState } from '../simulator';
import type { EvidenceItem, EvidenceState, Scenario } from '../types';

export type QualityTier = 'alta' | 'media' | 'baja';

export interface ViewSettings {
  /** Calidad elegida por el usuario; 'auto' deja decidir al monitor de rendimiento. */
  quality: 'auto' | QualityTier;
  /** Modo luz forense: penumbra y manchas latentes fluorescentes (solo visual). */
  forensicLight: boolean;
  /** Etiquetas Html (testigos, numeradores) sobre la escena. La UI las apaga con un modal abierto. */
  labels: boolean;
  /** Contador: cada incremento pide a la cámara volver a la vista general. */
  overview: number;
}

export const DEFAULT_VIEW: ViewSettings = {
  quality: 'auto',
  forensicLight: false,
  labels: true,
  overview: 0,
};

export interface SceneProps {
  state: SimState;
  dispatch: Dispatch<Action>;
  view: ViewSettings;
  /** Se llama cuando el nivel de calidad efectivo cambia (para mostrarlo en la UI). */
  onTierChange?: (tier: QualityTier) => void;
}

/** Props del EMP/EF en escena. Dueño: scene/forensic (Evidence.tsx); lo monta Scene.tsx. */
export interface EvidenceProps {
  item: EvidenceItem;
  state: EvidenceState;
  selected: boolean;
  onSelect: (id: string) => void;
  view: ViewSettings;
  tier: QualityTier;
}

/** Ambiente (arquitectura + mobiliario + exterior). Dueño: scene/env. */
export interface EnvironmentProps {
  scenario: Scenario;
  tier: QualityTier;
  forensicLight: boolean;
}

/** Capa forense de escena (cinta, ruta, manchas latentes). Dueño: scene/forensic. */
export interface ForensicLayerProps {
  state: SimState;
  view: ViewSettings;
  tier: QualityTier;
}
