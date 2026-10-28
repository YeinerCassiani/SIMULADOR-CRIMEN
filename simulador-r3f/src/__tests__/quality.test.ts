import { describe, expect, it } from 'vitest';
import {
  DECLINE_BELOW_FPS, INCLINE_AT_FPS, TIER_CONFIG, ceilingOf, initialMemory, initialTier, pickTier, stepQuality,
} from '../scene/render/quality';
import {
  CAMERA_LIMITS, FORENSIC, damp, entryPose, findHdriUrl, framingPose, nightPreset, overviewPose, parseInsets, viewOffsetFor,
} from '../scene/render/presets';
import { SCENARIOS } from '../data/scenarios';

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('pickTier', () => {
  it('la elección del usuario manda sobre los FPS', () => {
    expect(pickTier('alta', 5, 'alta')).toBe('alta');
    expect(pickTier('baja', 120, 'baja')).toBe('baja');
    expect(pickTier('alta', 120, 'media')).toBe('media');
  });

  it('baja un nivel por debajo del umbral y nunca salta dos', () => {
    expect(pickTier('alta', DECLINE_BELOW_FPS - 1, 'auto')).toBe('media');
    expect(pickTier('alta', 3, 'auto')).toBe('media');
    expect(pickTier('media', 20, 'auto')).toBe('baja');
    expect(pickTier('baja', 5, 'auto')).toBe('baja');
  });

  it('histéresis: en la banda muerta no se mueve en ningún sentido', () => {
    for (const fps of [DECLINE_BELOW_FPS, 45, 50, INCLINE_AT_FPS - 1]) {
      expect(pickTier('alta', fps, 'auto')).toBe('alta');
      expect(pickTier('media', fps, 'auto')).toBe('media');
      expect(pickTier('baja', fps, 'auto')).toBe('baja');
    }
  });

  it('sube un nivel solo con FPS holgados y respeta el techo', () => {
    expect(pickTier('baja', INCLINE_AT_FPS, 'auto')).toBe('media');
    expect(pickTier('media', 60, 'auto')).toBe('alta');
    expect(pickTier('alta', 144, 'auto')).toBe('alta');
    expect(pickTier('media', 60, 'auto', 'media')).toBe('media');
  });

  it('con muestras usa la mediana: un tirón aislado no decide', () => {
    expect(pickTier('alta', [60, 60, 12, 59, 61], 'auto')).toBe('alta');
    expect(pickTier('alta', [30, 31, 60, 29, 32], 'auto')).toBe('media');
    expect(pickTier('media', [], 'auto')).toBe('media');
    expect(pickTier('media', NaN, 'auto')).toBe('media');
  });
});

describe('stepQuality (controlador automático)', () => {
  it('una secuencia oscilante alta↔media queda bloqueada en media tras 2 bajadas', () => {
    let m = initialMemory('alta');
    const seen: string[] = [];
    // La máquina va a 30 fps en alta y a 60 en media: sin veto oscilaría siempre.
    for (let i = 0; i < 10; i++) {
      m = stepQuality(m, m.tier === 'alta' ? 30 : 60);
      seen.push(m.tier);
    }
    expect(seen.slice(0, 4)).toEqual(['media', 'alta', 'media', 'media']);
    expect(seen.slice(-5).every((t) => t === 'media')).toBe(true);
    expect(m.failures.alta).toBe(2);
    expect(ceilingOf(m)).toBe('media');
  });

  it('FPS estables en la banda muerta no cambian nada (mismo objeto)', () => {
    const m = initialMemory('media');
    expect(stepQuality(m, 48)).toBe(m);
  });

  it('subir no cuenta como fallo', () => {
    const m = stepQuality(initialMemory('baja'), 60);
    expect(m.tier).toBe('media');
    expect(m.failures).toEqual({ alta: 0, media: 0, baja: 0 });
  });
});

describe('TIER_CONFIG', () => {
  it('mapSize de sombras por nivel: alta 2048, media 1024; baja sin sombras dinámicas', () => {
    expect(TIER_CONFIG.alta.shadowMapSize).toBe(2048);
    expect(TIER_CONFIG.media.shadowMapSize).toBe(1024);
    expect(TIER_CONFIG.alta.shadows && TIER_CONFIG.media.shadows).toBe(true);
    expect(TIER_CONFIG.baja.shadows).toBe(false);
  });

  it('presupuesto: N8AO, Bloom y SMAA fuera de baja; N8AO a media resolución en media', () => {
    expect(TIER_CONFIG.baja.ao || TIER_CONFIG.baja.smaa || TIER_CONFIG.baja.bloom).toBe(false);
    expect(TIER_CONFIG.media.aoHalfRes).toBe(true);
  });

  it('DPR: alta [1,2] con referencia estable, media 1.25, baja 1', () => {
    expect(TIER_CONFIG.alta.dpr).toEqual([1, 2]);
    expect(TIER_CONFIG.alta.dpr).toBe(TIER_CONFIG.alta.dpr);
    expect(TIER_CONFIG.media.dpr).toBe(1.25);
    expect(TIER_CONFIG.baja.dpr).toBe(1);
  });
});

describe('initialTier', () => {
  it('móvil o equipos modestos arrancan en media; el resto en alta', () => {
    expect(initialTier({ coarsePointer: true, cores: 16 })).toBe('media');
    expect(initialTier({ cores: 4 })).toBe('media');
    expect(initialTier({ cores: 12, deviceMemoryGb: 4 })).toBe('media');
    expect(initialTier({ cores: 12, deviceMemoryGb: 16 })).toBe('alta');
    expect(initialTier({})).toBe('alta');
  });
});

describe('preajustes de noche', () => {
  it('una sola sombra direccional por ambiente: lámpara en interior, luna en exterior', () => {
    const int = nightPreset('cerrado');
    expect(int.ceiling).not.toBeNull();
    expect(int.lampShadow).not.toBeNull();
    expect(int.wallWash).not.toBeNull();
    expect(int.moon.castShadow).toBe(false);
    for (const env of ['abierto', 'vial'] as const) {
      const p = nightPreset(env);
      expect(p.ceiling).toBeNull();
      expect(p.lampShadow).toBeNull();
      expect(p.wallWash).toBeNull();
      expect(p.moon.castShadow).toBe(true);
    }
  });

  it('IBL bajo (noche) y modo forense que atenúa las cálidas al 10 %', () => {
    for (const env of ['cerrado', 'abierto', 'vial'] as const) {
      const p = nightPreset(env);
      expect(p.envIntensity).toBeGreaterThanOrEqual(0.25);
      expect(p.envIntensity).toBeLessThanOrEqual(0.4);
    }
    expect(FORENSIC.warm).toBeCloseTo(0.1);
    expect(FORENSIC.exposure).toBeLessThan(1);
  });

  it('damp converge en ~0.6 s (3τ) a cualquier framerate', () => {
    for (const fps of [30, 60, 144]) {
      let v = 0;
      const dt = 1 / fps;
      for (let t = 0; t < 0.6; t += dt) v = damp(v, 1, FORENSIC.tau, dt);
      expect(v).toBeGreaterThan(0.94);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(damp(0.5, 1, FORENSIC.tau, -1)).toBe(0.5);
  });
});

describe('cámara', () => {
  it('vista general dentro de los límites de distancia en los 4 escenarios', () => {
    for (const s of SCENARIOS) {
      const o = overviewPose(s.dimensions);
      const d = dist(o.position, o.target);
      expect(d).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance);
      expect(d).toBeLessThanOrEqual(CAMERA_LIMITS.maxDistance);
      // El vuelo de entrada parte de más lejos y converge a la vista general.
      expect(dist(entryPose(s.dimensions).position, o.target)).toBeGreaterThan(d);
    }
  });

  it('encuadre de un EMP/EF: lo mira, conserva el azimut y respeta polar y distancia', () => {
    const item = { x: 2.2, z: -1.1, w: 0.55, d: 0.35, h: 0.15 };
    const cam: [number, number, number] = [12, 11, 14];
    const p = framingPose(item, cam);
    expect(p.target).toEqual([2.2, 0.075, -1.1]);
    const d = dist(p.position, p.target);
    expect(d).toBeGreaterThanOrEqual(CAMERA_LIMITS.minDistance);
    expect(d).toBeLessThanOrEqual(9.01);
    const az = (v: number[], t: number[]) => Math.atan2(v[2] - t[2], v[0] - t[0]);
    expect(az(p.position, p.target)).toBeCloseTo(az(cam, p.target), 2);
    const polar = Math.acos((p.position[1] - p.target[1]) / d);
    expect(polar).toBeLessThan(CAMERA_LIMITS.maxPolarAngle);
  });

  it('cámara justo encima del objeto: azimut válido (sin NaN)', () => {
    const p = framingPose({ x: 1, z: 1, w: 1, d: 1, h: 1 }, [1, 10, 1]);
    expect(p.position.every(Number.isFinite)).toBe(true);
  });
});

describe('paneles de la UI sobre el visor', () => {
  it('desplaza el centro óptico al centro del área libre', () => {
    // Riel 56 px, inspector 360 px, barra 56 px, bandeja 120 px a 1600×900.
    const off = viewOffsetFor({ left: 56, right: 360, top: 56, bottom: 120 }, 1600, 900);
    expect(off).toEqual({ x: 152, y: 32 });
    // Centro del área libre = W/2 - x.
    expect(1600 / 2 - off!.x).toBe(56 + (1600 - 56 - 360) / 2);
  });

  it('sin paneles, paneles simétricos o lienzo degenerado → sin desplazamiento', () => {
    expect(viewOffsetFor({ left: 0, right: 0, top: 0, bottom: 0 }, 1600, 900)).toBeNull();
    expect(viewOffsetFor({ left: 100, right: 100, top: 40, bottom: 40 }, 1600, 900)).toBeNull();
    expect(viewOffsetFor({ left: 0, right: 360, top: 0, bottom: 0 }, 0, 900)).toBeNull();
    // Paneles que tapan > 70 % del ancho (móvil): no compensar.
    expect(viewOffsetFor({ left: 0, right: 300, top: 0, bottom: 0 }, 400, 800)).toBeNull();
  });

  it('parseInsets: las variables --scene-inset-* explícitas mandan', () => {
    const vars: Record<string, string> = { '--scene-inset-right': ' 360px', '--scene-inset-left': '56px', '--scene-inset-top': 'auto', '--rail-w': '999px' };
    expect(parseInsets((n) => vars[n] ?? '', { left: 0, top: 0, right: 1600, bottom: 900 }, { width: 1600, height: 900 }))
      .toEqual({ top: 0, right: 360, bottom: 0, left: 56 });
  });

  it('parseInsets deduce los márgenes de la maquetación de la UI y del rectángulo del lienzo', () => {
    const ui: Record<string, string> = { '--rail-w': '56px', '--top-h': '56px', '--insp': '360px' };
    const read = (n: string) => ui[n] ?? '';
    // Lienzo a pantalla completa bajo los paneles.
    expect(parseInsets(read, { left: 0, top: 0, right: 1600, bottom: 900 }, { width: 1600, height: 900 }))
      .toEqual({ top: 56, right: 360, bottom: 0, left: 56 });
    // Lienzo que ya empieza tras el riel y acaba antes del inspector: no cuenta doble.
    expect(parseInsets(read, { left: 56, top: 56, right: 1240, bottom: 900 }, { width: 1600, height: 900 }))
      .toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    // Inspector plegado (--insp: 0px).
    expect(parseInsets((n) => (n === '--insp' ? '0px' : read(n)), { left: 0, top: 0, right: 1600, bottom: 900 }, { width: 1600, height: 900 }).right).toBe(0);
    // Sin lienzo: sin márgenes.
    expect(parseInsets(read)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('findHdriUrl', () => {
  it('encuentra un .hdr local en cualquier forma de manifiesto y prefiere el nocturno', () => {
    expect(findHdriUrl({})).toBeNull();
    expect(findHdriUrl({ '../../assets/manifest.ts': { HDRI: { url: '/assets/hdri/studio_1k.hdr' } } })).toBe('/assets/hdri/studio_1k.hdr');
    expect(findHdriUrl({ m: { list: [{ file: '/assets/a_1k.hdr' }, { file: '/assets/moonless_golf_1k.hdr' }] } })).toBe('/assets/moonless_golf_1k.hdr');
  });

  it('rechaza URLs remotas (todo offline) y no se cuelga con ciclos', () => {
    const cyc: Record<string, unknown> = { url: 'https://dl.polyhaven.org/x_1k.hdr' };
    cyc.self = cyc;
    expect(findHdriUrl(cyc)).toBeNull();
    expect(findHdriUrl({ u: '//cdn.example.com/x.hdr', t: '/assets/tex/wood.webp' })).toBeNull();
  });
});
