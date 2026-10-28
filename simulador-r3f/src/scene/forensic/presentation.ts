// Reglas de presentación del EMP/EF y de las etiquetas Html (puras, testeables).
import type { EvidenceState } from '../../types';
import type { QualityTier, ViewSettings } from '../contracts';

/** Acento del sistema: amarillo placa de criminalística. */
export const ACCENT = '#f2c230';
export const NEGATIVE = '#e5566f';
export const POSITIVE = '#44a282';

/**
 * Rango de z-index de las etiquetas Html de la escena. drei usa por defecto
 * [16777271, 0], que pinta las etiquetas encima de toda la interfaz. Acuerdo
 * con ui: superficies de la interfaz >= 50, modales >= 100.
 */
export const LABEL_Z_RANGE: [number, number] = [40, 0];

/** Las etiquetas Html solo se pintan si la vista lo permite y no hay modal abierto. */
export function labelsVisible(view: Pick<ViewSettings, 'labels'>, modalOpen = false): boolean {
  return view.labels && !modalOpen;
}

export interface EvidencePresentation {
  /** El modelo 3D se dibuja (se oculta tras recolectar: queda su silueta). */
  showModel: boolean;
  /** Contorno en el piso del objeto recolectado. */
  showSilhouette: boolean;
  /** Placa numerada A-frame (señalizado). */
  showPlate: boolean;
  /** Testigo métrico en L (fijado fotográficamente, antes de recolectar). */
  showScale: boolean;
  /** Halo de selección/hover. */
  halo: 'none' | 'hover' | 'selected';
  /** Etiqueta Html con id y nombre. */
  showLabel: boolean;
  /** Entregado al laboratorio (marca sobre la silueta). */
  delivered: boolean;
  contaminated: boolean;
}

export function evidencePresentation(
  st: Pick<EvidenceState, 'marked' | 'photographed' | 'collected' | 'delivered' | 'contaminated'>,
  view: Pick<ViewSettings, 'labels'>,
  selected: boolean,
  hovered: boolean,
): EvidencePresentation {
  return {
    showModel: !st.collected,
    showSilhouette: st.collected,
    showPlate: st.marked,
    showScale: st.photographed && !st.collected,
    halo: selected ? 'selected' : hovered ? 'hover' : 'none',
    showLabel: labelsVisible(view) && selected,
    delivered: st.delivered,
    contaminated: st.contaminated,
  };
}

/**
 * Parámetros de las luces de trabajo por calidad. La cantidad de luces no
 * cambia nunca (montar/desmontar luces recompila todos los materiales); solo
 * varían intensidad, sombra y haz.
 */
export function workLightSettings(tier: QualityTier, forensicLight: boolean) {
  const dim = forensicLight ? 0.12 : 1;
  return {
    // Única luz de cada trípode (render ya no duplica estos focos): absorbe la
    // intensidad que antes sumaban los dos spot por posición.
    intensity: (tier === 'baja' ? 40 : 48) * dim,
    castShadow: tier === 'alta',
    beamOpacity: (tier === 'baja' ? 0.3 : 0.5) * dim,
    dust: tier === 'alta' && !forensicLight,
  };
}
