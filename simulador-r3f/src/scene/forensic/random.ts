// Aleatoriedad determinista: la misma semilla produce siempre la misma escena.
// Nunca Math.random en la capa forense: las manchas y pliegues saltarían en
// cada remontaje (cambio de escenario, HMR) y los tests no serían deterministas.

/** Hash FNV-1a de 32 bits de un texto. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador mulberry32: devuelve una función que produce números en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Atajo: generador sembrado por un texto. */
export function rngFor(key: string): () => number {
  return mulberry32(hashString(key));
}
