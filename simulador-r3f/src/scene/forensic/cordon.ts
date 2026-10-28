// Cordón de aislamiento: postes (o conos en vía) y tramos de cinta alrededor
// del perímetro de la escena, a partir de sus dimensiones.

export interface CordonLayout {
  /** Postes en orden de recorrido (bucle cerrado, sin repetir el primero). */
  posts: [number, number][];
  /** Tramos de cinta entre postes consecutivos (el último cierra el bucle). */
  spans: { a: [number, number]; b: [number, number]; length: number }[];
}

/** Separación del cordón respecto al borde de la escena (m). */
export const CORDON_MARGIN = 0.7;
/** Tramo máximo de cinta entre dos postes (m). */
export const CORDON_MAX_SPAN = 3.2;
/** Altura de la cinta (m). */
export const TAPE_HEIGHT = 0.92;

export function cordonLayout(dims: { w: number; d: number }, margin = CORDON_MARGIN, maxSpan = CORDON_MAX_SPAN): CordonLayout {
  const hx = dims.w / 2 + margin, hz = dims.d / 2 + margin;
  const corners: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  const posts: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / maxSpan));
    // Desde la esquina (incluida) hasta antes de la siguiente esquina.
    for (let k = 0; k < n; k++) posts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  const spans = posts.map((a, i) => {
    const b = posts[(i + 1) % posts.length];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  return { posts, spans };
}

/**
 * Desplazamiento de un punto de la cinta: comba (hacia abajo) y ondulación
 * lateral por viento. u en [0,1] a lo largo del tramo; ambos son 0 en los postes.
 * windAmp = 0 deja la cinta quieta (interior o prefers-reduced-motion).
 */
export function tapeOffset(u: number, length: number, t: number, windAmp: number, phase = 0): { sag: number; sway: number } {
  const env = Math.sin(Math.PI * u); // 0 en los extremos, 1 al centro
  const sag = -0.012 * length * env;
  const sway = windAmp * env * Math.sin(t * 2.3 + u * length * 1.7 + phase) * Math.min(1, length / 2.5);
  return { sag, sway };
}
