// Numeración de las placas A-frame: el número visible sale del id del EMP/EF.

/**
 * "EMP-003" → "3", "EMP-A01" → "A1", "EMP-101" → "101".
 * Toma el último tramo tras '-', conserva el prefijo alfabético y quita los
 * ceros a la izquierda de la parte numérica. Si no hay número, devuelve el tramo.
 */
export function plateNumber(id: string): string {
  const tail = (id.split('-').pop() || id).trim();
  const m = /^([A-Za-z]*)0*(\d+)$/.exec(tail);
  if (!m) return tail.toUpperCase();
  return `${m[1].toUpperCase()}${m[2]}`;
}
