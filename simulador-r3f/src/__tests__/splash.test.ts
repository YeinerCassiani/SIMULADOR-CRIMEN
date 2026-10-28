// Gate de la pantalla de bienvenida: cuándo se habilita "Entrar", que la barra
// nunca retroceda ni marque 100 antes de tiempo, textos de estado y el render.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MIN_SHOW_MS, NO_LOAD_MS, SETTLE_MS, TIMEOUT_MS,
  assetKind, nextPct, splashDisabled, splashStatus, statusText, type LoadSnapshot,
} from '../ui/splashLogic';
import { Splash } from '../ui/Splash';
import { SplashLogo } from '../ui/SplashLogo';

const snap = (o: Partial<LoadSnapshot>): LoadSnapshot => ({
  active: false, loaded: 0, total: 0, idleMs: 0, elapsedMs: 5000, fontsReady: true, ...o,
});

describe('splashStatus', () => {
  it('no se habilita antes del tiempo mínimo aunque todo esté cargado', () => {
    expect(splashStatus(snap({ loaded: 10, total: 10, idleMs: 5000, elapsedMs: MIN_SHOW_MS - 1 }))).toBe('loading');
  });

  it('lista cuando todo cargó y el gestor lleva SETTLE_MS sin actividad', () => {
    expect(splashStatus(snap({ loaded: 34, total: 34, idleMs: SETTLE_MS }))).toBe('ready');
  });

  it('sigue cargando si el gestor acaba de quedar inactivo (puede llegar otro lote)', () => {
    expect(splashStatus(snap({ loaded: 34, total: 34, idleMs: SETTLE_MS - 1 }))).toBe('loading');
  });

  it('sigue cargando mientras haya cargas activas', () => {
    expect(splashStatus(snap({ active: true, loaded: 12, total: 34 }))).toBe('loading');
  });

  it('espera a las fuentes', () => {
    expect(splashStatus(snap({ loaded: 34, total: 34, idleMs: 5000, fontsReady: false }))).toBe('loading');
  });

  it('sin ninguna carga (todo en caché) se da por lista tras NO_LOAD_MS', () => {
    expect(splashStatus(snap({ elapsedMs: NO_LOAD_MS - 1 }))).toBe('loading');
    expect(splashStatus(snap({ elapsedMs: NO_LOAD_MS }))).toBe('ready');
  });

  it('pasado el tope permite entrar aunque algo siga cargando', () => {
    expect(splashStatus(snap({ active: true, loaded: 3, total: 34, elapsedMs: TIMEOUT_MS }))).toBe('timeout');
  });

  it('un recurso que falla cuenta como terminado (el gestor cierra el ítem igual)', () => {
    expect(splashStatus(snap({ loaded: 34, total: 34, idleMs: 1000 }))).toBe('ready');
  });
});

describe('nextPct', () => {
  it('no retrocede cuando un lote nuevo agranda el total', () => {
    const a = nextPct(0, { loaded: 5, total: 10 }, 'loading');
    const b = nextPct(a, { loaded: 6, total: 30 }, 'loading');
    const c = nextPct(b, { loaded: 24, total: 30 }, 'loading');
    expect(a).toBe(50);
    expect(b).toBe(50);
    expect(c).toBe(80);
  });

  it('no marca 100 hasta que la carga está lista', () => {
    expect(nextPct(0, { loaded: 34, total: 34 }, 'loading')).toBe(99);
    expect(nextPct(99, { loaded: 34, total: 34 }, 'ready')).toBe(100);
    expect(nextPct(10, { loaded: 3, total: 34 }, 'timeout')).toBe(100);
  });

  it('0 sin cargas y proporcional en el resto', () => {
    expect(nextPct(0, { loaded: 0, total: 0 }, 'loading')).toBe(0);
    expect(nextPct(0, { loaded: 17, total: 34 }, 'loading')).toBe(50);
  });
});

describe('textos', () => {
  it('clasifica recursos por URL', () => {
    expect(assetKind('/assets/models/Sofa_01.glb')).toBe('modelo');
    expect(assetKind('/assets/hdri/night.hdr?v=1')).toBe('entorno');
    expect(assetKind('/assets/textures/wood_diff.webp')).toBe('textura');
    expect(assetKind('')).toBe('recurso');
    expect(assetKind(null)).toBe('recurso');
  });

  it('estado con conteo, lista y tope', () => {
    expect(statusText('loading', '/a/b.glb', { loaded: 3, total: 34 })).toBe('Cargando mobiliario 3D · 3 de 34');
    expect(statusText('loading', '', { loaded: 0, total: 0 })).toBe('Preparando la escena');
    expect(statusText('ready', '', { loaded: 34, total: 34 })).toBe('Escena lista');
    expect(statusText('timeout', '', { loaded: 3, total: 34 })).toMatch(/puede entrar/);
  });

  it('?nosplash omite la pantalla', () => {
    expect(splashDisabled('?nosplash')).toBe(true);
    expect(splashDisabled('?perf&nosplash=1')).toBe(true);
    expect(splashDisabled('?perf')).toBe(false);
    expect(splashDisabled('')).toBe(false);
  });
});

describe('render', () => {
  it('marca, título, barra accesible y botón deshabilitado al arrancar', () => {
    const html = renderToStaticMarkup(createElement(Splash, { onEnter: () => {} }));
    expect(html).toContain('Simulador de Escena del Crimen');
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="0"/);
    expect(html).toMatch(/<button[^>]*data-splash-enter[^>]*disabled/);
    expect(html).toContain('aria-label="Placa de numeración de evidencia SC"');
  });

  it('el logo usa la placa amarilla y tinta oscura de la escena', () => {
    const svg = renderToStaticMarkup(createElement(SplashLogo));
    expect(svg).toContain('#f2c230');
    expect(svg).toContain('#131217');
  });
});
