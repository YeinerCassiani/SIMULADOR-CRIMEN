import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { MODELS } from '../assets/manifest';
import { routePath } from '../scene/forensic/route';
import { workLightPlacements } from '../scene/forensic/workLights';
import {
  anchorOffset, anisotropyFor, baseLayout, bushSpots, crossingsAtZ, curbSpans, envKind, evidenceRect,
  footprintHalf, interiorShell, layoutFor, layoutModels, PARK_PATH, PARK_PATH_WIDTH, placementRect,
  pointSegmentDistance, polylineRectGap, practicalIntensity, practicalShadow, rectGap, repeatFor, ribbon,
  ROAD_HALF, SCENARIO_BUDGET_BYTES, scenarioBytes, surfaceRepeat, treeGeometry, treeSpots, wallPieces,
  WALL_HEIGHT, type Placement,
} from '../scene/env/layout';
import type { Scenario } from '../types';

const solids = (pls: Placement[]) => pls.filter((p) => p.solid);

describe('repeat de texturas por metros reales', () => {
  it('repeatFor divide metros entre el lado de la baldosa', () => {
    expect(repeatFor(16, 2)).toBe(8);
    expect(repeatFor(3, 4)).toBe(0.75);
    expect(repeatFor(1, 3)).toBe(0.333);
  });
  it('entradas inválidas devuelven 1 (nunca NaN ni 0)', () => {
    expect(repeatFor(0, 2)).toBe(1);
    expect(repeatFor(5, 0)).toBe(1);
    expect(repeatFor(Number.NaN, 2)).toBe(1);
  });
  it('surfaceRepeat usa el tamaño real de cada textura', () => {
    expect(surfaceRepeat('wood_floor', 16, 12)).toEqual([8, 6]);
    expect(surfaceRepeat('asphalt_02', 44, 8)).toEqual([11, 2]);
  });
  it('anisotropía 8 solo en alta', () => {
    expect(anisotropyFor('alta')).toBe(8);
    expect(anisotropyFor('media')).toBeLessThan(8);
    expect(anisotropyFor('baja')).toBe(1);
  });
});

describe('muros con vanos', () => {
  const area = (ps: ReturnType<typeof wallPieces>) => ps.reduce((a, p) => a + (p.u1 - p.u0) * (p.y1 - p.y0), 0);
  it('sin vanos es una sola pieza', () => {
    expect(wallPieces(16, 2.6)).toEqual([{ u0: -8, u1: 8, y0: 0, y1: 2.6 }]);
  });
  it('el área es la del muro menos la de los vanos', () => {
    for (const decor of ['apartamento', 'vivienda']) {
      const sh = interiorShell(decor);
      for (const [len, ops] of [[16, sh.back], [12, sh.left]] as const) {
        const holes = ops.reduce((a, o) => a + o.width * (o.top - o.bottom), 0);
        expect(area(wallPieces(len, WALL_HEIGHT, ops))).toBeCloseTo(len * WALL_HEIGHT - holes, 6);
      }
    }
  });
  it('una puerta no deja antepecho (llega al piso) y una ventana sí', () => {
    const door = wallPieces(4, 2.6, [{ kind: 'door', center: 0, width: 1, bottom: 0, top: 2.1 }]);
    expect(door.some((p) => p.u0 === -0.5 && p.y0 === 0)).toBe(false);
    const win = wallPieces(4, 2.6, [{ kind: 'window', center: 0, width: 1, bottom: 1, top: 2 }]);
    expect(win.some((p) => p.u0 === -0.5 && p.y0 === 0 && p.y1 === 1)).toBe(true);
  });
  it('la puerta queda donde empieza la ruta de ingreso de cerrado', () => {
    const start = routePath('cerrado')[0];
    for (const decor of ['apartamento', 'vivienda']) {
      const door = interiorShell(decor).left.find((o) => o.kind === 'door')!;
      expect(Math.abs(door.center - start[1])).toBeLessThan(door.width);
    }
  });
});

describe('anclaje de modelos', () => {
  it('piso: el bbox queda apoyado en y=0 y centrado en X/Z', () => {
    const b = MODELS.GothicBed_01.bbox;
    const [ox, oy, oz] = anchorOffset(b);
    expect(b.min[1] + oy).toBeCloseTo(0, 6);
    expect((b.min[0] + b.max[0]) / 2 + ox).toBeCloseTo(0, 6);
    expect((b.min[2] + b.max[2]) / 2 + oz).toBeCloseTo(0, 6);
  });
  it('techo: el tope del modelo queda en el punto de cuelgue', () => {
    const b = MODELS.modern_ceiling_lamp_01.bbox;
    expect(b.max[1] + anchorOffset(b, 'ceiling')[1]).toBeCloseTo(0, 6);
  });
  it('muro: la cara trasera queda en z=0', () => {
    const b = MODELS.hanging_picture_frame_01.bbox;
    expect(b.min[2] + anchorOffset(b, 'wall')[2]).toBeCloseTo(0, 6);
  });
  it('la huella rotada 90° intercambia ancho y fondo', () => {
    const [hx, hz] = footprintHalf({ size: [2, 1, 1], rotY: Math.PI / 2 });
    expect(hx).toBeCloseTo(0.5, 6);
    expect(hz).toBeCloseTo(1, 6);
  });
});

describe('layout por escenario (los 4 integrados)', () => {
  for (const sc of SCENARIOS) {
    const kind = envKind(sc);
    const pls = layoutFor(sc);
    describe(`${sc.scenarioId} (${kind})`, () => {
      it('ningún mueble se descarta: el layout está diseñado para estos EMP/EF', () => {
        expect(pls.map((p) => p.key)).toEqual(baseLayout(kind).map((p) => p.key));
      });
      it('ningún EMP/EF queda dentro ni pegado a un mueble (holgura ≥ 0.3 m)', () => {
        for (const pl of solids(pls)) for (const it of sc.evidenceItems) {
          expect(rectGap(placementRect(pl), evidenceRect(it)), `${pl.key} vs ${it.id}`).toBeGreaterThanOrEqual(0.3);
        }
      });
      it('los muebles no se solapan entre sí', () => {
        const s = solids(pls);
        for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
          expect(rectGap(placementRect(s[i]), placementRect(s[j])), `${s[i].key} vs ${s[j].key}`).toBeGreaterThan(0.05);
        }
      });
      it('la ruta de ingreso/salida no atraviesa muebles (holgura ≥ 0.35 m)', () => {
        const path = routePath(sc.environmentType);
        for (const pl of solids(pls)) expect(polylineRectGap(path, placementRect(pl)), pl.key).toBeGreaterThanOrEqual(0.35);
      });
      it('los trípodes de luz forense tienen sitio libre', () => {
        for (const wl of workLightPlacements(sc.evidenceItems, sc.dimensions)) {
          for (const pl of solids(pls)) expect(rectGap(placementRect(pl), { x: wl.x, z: wl.z, hx: 0.4, hz: 0.4 }), pl.key).toBeGreaterThan(0.2);
        }
      });
      it('todo lo que no es decorado exterior queda dentro del área de la escena', () => {
        const { w, d } = sc.dimensions;
        for (const pl of solids(pls).filter((p) => !p.outside)) {
          const r = placementRect(pl);
          expect(Math.abs(pl.x) + r.hx, pl.key).toBeLessThanOrEqual(w / 2);
          expect(Math.abs(pl.z) + r.hz, pl.key).toBeLessThanOrEqual(d / 2);
        }
      });
      it('presupuesto de descarga ≤ 20 MB', () => {
        expect(scenarioBytes(sc)).toBeLessThanOrEqual(SCENARIO_BUDGET_BYTES);
      });
      it('cada modelo existe en el manifest', () => {
        for (const id of layoutModels(pls)) expect(MODELS[id].url).toMatch(/^\/assets\/models\/.+\.glb$/);
      });
    });
  }

  it('las puertas interiores quedan libres (nada sólido en el paso)', () => {
    for (const sc of SCENARIOS.filter((s) => s.environmentType === 'cerrado')) {
      const door = interiorShell(sc.decor).left.find((o) => o.kind === 'door')!;
      const pass = { x: -sc.dimensions.w / 2 + 0.6, z: door.center, hx: 0.6, hz: door.width / 2 };
      for (const pl of solids(layoutFor(sc))) expect(rectGap(placementRect(pl), pass), pl.key).toBeGreaterThan(0.1);
    }
  });

  it('un EMP/EF del docente encima de un mueble lo elimina (y lo que va encima)', () => {
    const base = SCENARIOS[0];
    const cab = baseLayout('apartamento').find((p) => p.key === 'tv-cabinet')!;
    const sc: Scenario = { ...base, evidenceItems: [{ ...base.evidenceItems[0], x: cab.x, z: cab.z }] };
    const keys = layoutFor(sc).map((p) => p.key);
    expect(keys).not.toContain('tv-cabinet');
    expect(keys).not.toContain('tv');
    expect(keys).toContain('sofa');
  });

  it('un área más chica descarta lo que queda fuera', () => {
    const sc: Scenario = { ...SCENARIOS[0], dimensions: { w: 10, d: 8 } };
    const keys = layoutFor(sc).map((p) => p.key);
    expect(keys).not.toContain('stove');
    for (const pl of solids(layoutFor(sc))) expect(Math.abs(pl.x) + placementRect(pl).hx).toBeLessThanOrEqual(5);
  });
});

describe('exterior', () => {
  it('el sendero del parque pasa por el EMP/EF que está "sobre sendero"', () => {
    const park = SCENARIOS.find((s) => s.environmentType === 'abierto')!;
    const onPath = park.evidenceItems.find((i) => /sendero/i.test(i.description))!;
    const dist = Math.min(...PARK_PATH.slice(1).map((b, i) => pointSegmentDistance(onPath.x, onPath.z, PARK_PATH[i], b)));
    expect(dist).toBeLessThan(PARK_PATH_WIDTH / 2);
  });
  it('los EMP/EF "sobre la calzada" quedan en el asfalto', () => {
    const road = SCENARIOS.find((s) => s.environmentType === 'vial')!;
    for (const it of road.evidenceItems.filter((i) => /calzada|asfalto/i.test(i.description))) {
      expect(Math.abs(it.z) + it.d / 2).toBeLessThan(ROAD_HALF);
    }
  });
  it('árboles y arbustos lejos de EMP/EF y de la ruta', () => {
    for (const sc of SCENARIOS.filter((s) => s.environmentType !== 'cerrado')) {
      const path = routePath(sc.environmentType);
      for (const t of [...treeSpots(sc.environmentType), ...bushSpots(sc.environmentType)]) {
        const r = { x: t.x, z: t.z, hx: 0.3, hz: 0.3 };
        for (const it of sc.evidenceItems) expect(rectGap(r, evidenceRect(it))).toBeGreaterThan(1.0);
        expect(polylineRectGap(path, r)).toBeGreaterThan(0.8);
        for (const wl of workLightPlacements(sc.evidenceItems, sc.dimensions)) expect(Math.hypot(wl.x - t.x, wl.z - t.z)).toBeGreaterThan(1.2);
      }
    }
  });
  it('la geometría de árboles es determinista y tiene 3-5 masas por copa', () => {
    const trees = treeSpots('abierto');
    const a = treeGeometry(trees, bushSpots('abierto'));
    const b = treeGeometry(trees, bushSpots('abierto'));
    expect(a).toEqual(b);
    expect(a.trunks).toHaveLength(trees.length);
    const treeBlobs = a.blobs.length - b.blobs.filter((x) => x.y < 0.5).length;
    expect(treeBlobs).toBeGreaterThanOrEqual(trees.length * 3);
    expect(treeBlobs).toBeLessThanOrEqual(trees.length * 5);
    expect(new Set(a.blobs.map((x) => x.color)).size).toBeGreaterThan(2);
  });
  it('el bordillo deja rampa donde la ruta cruza el borde de la calzada', () => {
    const xs = crossingsAtZ(routePath('vial'), -ROAD_HALF);
    expect(xs.length).toBeGreaterThan(0);
    const spans = curbSpans(44, xs.map((x) => [x - 1, x + 1] as [number, number]));
    for (const x of xs) expect(spans.some(([a, b]) => x > a && x < b)).toBe(false);
    expect(spans[0][0]).toBe(-22);
    expect(spans[spans.length - 1][1]).toBe(22);
  });
});

describe('luces locales', () => {
  it('modo luz forense atenúa sin apagar (la cantidad de luces no cambia)', () => {
    expect(practicalIntensity(10, false)).toBe(10);
    expect(practicalIntensity(10, true)).toBeGreaterThan(0);
    expect(practicalIntensity(10, true)).toBeLessThan(3);
  });
  it('solo una luz local con sombra y solo en alta', () => {
    expect(practicalShadow(0, 'alta')).toBe(true);
    expect(practicalShadow(1, 'alta')).toBe(false);
    expect(practicalShadow(0, 'media')).toBe(false);
    expect(practicalShadow(0, 'baja')).toBe(false);
  });
});

describe('cinta del sendero', () => {
  it('dos vértices por punto, dos triángulos por tramo, ancho exacto', () => {
    const r = ribbon([[0, 0], [10, 0]], 2, 0.02);
    expect(r.positions).toHaveLength(12);
    expect(r.indices).toHaveLength(6);
    expect(Math.abs(r.positions[2] - r.positions[5])).toBeCloseTo(2, 6);
    expect(r.positions[1]).toBe(0.02);
    expect(r.uvs[4]).toBe(10);
  });
  it('los triángulos miran hacia +Y', () => {
    const r = ribbon([[0, 0], [5, 0], [10, 3]], 2);
    for (let t = 0; t < r.indices.length; t += 3) {
      const [a, b, c] = [r.indices[t], r.indices[t + 1], r.indices[t + 2]].map((i) => [r.positions[i * 3], r.positions[i * 3 + 2]]);
      // Normal Y del triángulo = componente y de (b-a)×(c-a) con ejes (x, z).
      const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      expect(ny).toBeGreaterThan(0);
    }
  });
});
