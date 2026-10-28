// prefers-reduced-motion: la cinta deja de ondular y los testigos de balancearse.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

type MatchMediaHost = { matchMedia?: (q: string) => { matches: boolean } } | undefined;

/** Lectura pura (inyectable en tests): false si no hay matchMedia (node, SSR). */
export function prefersReducedMotion(host: MatchMediaHost = typeof window !== 'undefined' ? window : undefined): boolean {
  try {
    return !!host?.matchMedia?.(QUERY).matches;
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** Hook reactivo: cambia si el usuario activa/desactiva la preferencia. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => prefersReducedMotion(), () => false);
}
