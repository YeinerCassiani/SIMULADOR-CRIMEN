// Lógica pura de la pantalla de bienvenida: cuándo está lista la carga, qué
// porcentaje mostrar y qué texto de estado. Sin React ni three: se prueba en
// splash.test.ts. Splash.tsx solo lee el gestor de carga y llama a estas funciones.

export interface LoadSnapshot {
  /** Hay cargas en curso en el gestor de carga de three. */
  active: boolean;
  loaded: number;
  total: number;
  /** ms desde que el gestor quedó sin cargas activas (0 si está activo). */
  idleMs: number;
  /** ms desde que se montó la pantalla. */
  elapsedMs: number;
  /** document.fonts.ready resuelto. */
  fontsReady: boolean;
}

/** Tiempo sin cargas activas antes de dar la escena por lista (los lotes llegan en ráfagas). */
export const SETTLE_MS = 600;
/** Si en este tiempo no empezó ninguna carga (todo en caché o sin loaders), se da por lista. */
export const NO_LOAD_MS = 2500;
/** Tope: pasado este tiempo se permite entrar aunque algo siga cargando. */
export const TIMEOUT_MS = 30000;
/** Duración mínima en pantalla, para que la marca no parpadee en cargas instantáneas. */
export const MIN_SHOW_MS = 900;

export type SplashStatus = 'loading' | 'ready' | 'timeout';

export function splashStatus(s: LoadSnapshot): SplashStatus {
  if (s.elapsedMs < MIN_SHOW_MS) return 'loading';
  const settled = s.total > 0 && !s.active && s.loaded >= s.total && s.idleMs >= SETTLE_MS;
  const nothingToLoad = s.total === 0 && !s.active && s.elapsedMs >= NO_LOAD_MS;
  if (s.fontsReady && (settled || nothingToLoad)) return 'ready';
  if (s.elapsedMs >= TIMEOUT_MS) return 'timeout';
  return 'loading';
}

/**
 * Porcentaje mostrado: nunca retrocede (cuando llega un lote nuevo el total crece
 * y loaded/total bajaría) y no marca 100 hasta que la carga está realmente lista.
 */
export function nextPct(prev: number, s: Pick<LoadSnapshot, 'loaded' | 'total'>, status: SplashStatus): number {
  if (status !== 'loading') return 100;
  const raw = s.total > 0 ? Math.floor((s.loaded / s.total) * 100) : 0;
  return Math.max(prev, Math.min(raw, 99));
}

export type AssetKind = 'modelo' | 'textura' | 'entorno' | 'recurso';

/** Clase de recurso por URL, para el texto de estado. */
export function assetKind(url: string | null | undefined): AssetKind {
  if (!url) return 'recurso';
  const u = url.toLowerCase().split('?')[0];
  if (u.endsWith('.glb') || u.endsWith('.gltf')) return 'modelo';
  if (u.endsWith('.hdr') || u.endsWith('.exr')) return 'entorno';
  if (/\.(webp|png|jpe?g|ktx2|avif)$/.test(u)) return 'textura';
  return 'recurso';
}

const KIND_TEXT: Record<AssetKind, string> = {
  modelo: 'Cargando mobiliario 3D',
  textura: 'Cargando texturas',
  entorno: 'Cargando iluminación',
  recurso: 'Preparando la escena',
};

export function statusText(status: SplashStatus, item: string | null | undefined, s: Pick<LoadSnapshot, 'loaded' | 'total'>): string {
  if (status === 'ready') return 'Escena lista';
  if (status === 'timeout') return 'La conexión va lenta: puede entrar, la escena terminará de cargar dentro';
  const base = KIND_TEXT[assetKind(item)];
  return s.total > 0 ? `${base} · ${s.loaded} de ${s.total}` : base;
}

/** ?nosplash en la URL omite la pantalla (depuración). */
export function splashDisabled(search: string): boolean {
  return new URLSearchParams(search).has('nosplash');
}
