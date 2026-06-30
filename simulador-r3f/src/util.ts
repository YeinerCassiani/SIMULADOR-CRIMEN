// Utilidades puras compartidas (sin dependencias del estado) para evitar ciclos
// de importación entre simulator.ts, validation.ts y report.ts.

/** Normaliza texto para comparaciones tolerantes (trim + minúsculas + espacios). */
export function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
