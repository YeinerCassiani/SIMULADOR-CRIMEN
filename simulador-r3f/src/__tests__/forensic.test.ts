import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { DEFAULT_VIEW } from '../scene/contracts';
import { plateNumber } from '../scene/forensic/plates';
import { resolveKind } from '../scene/forensic/kinds';
import { hasLatentTrace, latentStains, distanceToFootprint, DECOY_COUNT, DECOY_CLEARANCE } from '../scene/forensic/latent';
import { cordonLayout, tapeOffset, CORDON_MARGIN, CORDON_MAX_SPAN } from '../scene/forensic/cordon';
import { routePath, routeSteps, STEP_SPACING, STEP_CLEARANCE } from '../scene/forensic/route';
import { evidenceCentroid, workLightPlacements, WORK_LIGHT_CLEARANCE } from '../scene/forensic/workLights';
import { evidencePresentation, labelsVisible, workLightSettings, LABEL_Z_RANGE } from '../scene/forensic/presentation';
import { prefersReducedMotion } from '../scene/forensic/motion';
import { hashString, mulberry32 } from '../scene/forensic/random';

const blank = { marked: false, photographed: false, collected: false, delivered: false, contaminated: false };

describe('numeración de placas A-frame', () => {
  it('toma el número del id sin ceros a la izquierda', () => {
    expect(plateNumber('EMP-003')).toBe('3');
    expect(plateNumber('EMP-001')).toBe('1');
    expect(plateNumber('EMP-101')).toBe('101');
    expect(plateNumber('EMP-A01')).toBe('A1');
    expect(plateNumber('EF-010')).toBe('10');
  });
  it('ids sin número devuelven el tramo final', () => {
    expect(plateNumber('EMP-X')).toBe('X');
    expect(plateNumber('suelto')).toBe('SUELTO');
  });
  it('todos los EMP/EF integrados tienen placa corta y única por escenario', () => {
    for (const sc of SCENARIOS) {
      const nums = sc.evidenceItems.map((i) => plateNumber(i.id));
      expect(new Set(nums).size).toBe(nums.length);
      for (const n of nums) expect(n.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('manchas latentes (luz forense)', () => {
  it('solo los EMP/EF biológicos dejan rastro latente', () => {
    expect(hasLatentTrace({ nature: 'biológica' })).toBe(true);
    expect(hasLatentTrace({ nature: 'Biologica' })).toBe(true);
    expect(hasLatentTrace({ nature: 'digital' })).toBe(false);
    expect(hasLatentTrace({ nature: 'física/documental' })).toBe(false);
    expect(hasLatentTrace({ nature: '' })).toBe(false);
  });

  it('cada escenario: 3 reales por EMP/EF biológico + señuelos lejos de todo indicio', () => {
    for (const sc of SCENARIOS) {
      const stains = latentStains(sc.evidenceItems, sc.scenarioId, sc.dimensions);
      const bio = sc.evidenceItems.filter(hasLatentTrace);
      const real = stains.filter((s) => s.kind === 'real');
      const decoys = stains.filter((s) => s.kind === 'decoy');
      expect(real.length).toBe(bio.length * 3);
      for (const s of real) expect(bio.map((b) => b.id)).toContain(s.sourceId);
      expect(decoys.length).toBe(DECOY_COUNT);
      for (const d of decoys) {
        for (const it of sc.evidenceItems) expect(distanceToFootprint(d.x, d.z, it)).toBeGreaterThanOrEqual(DECOY_CLEARANCE);
      }
      // Dentro del área de la escena.
      for (const s of stains) {
        expect(Math.abs(s.x)).toBeLessThanOrEqual(sc.dimensions.w / 2);
        expect(Math.abs(s.z)).toBeLessThanOrEqual(sc.dimensions.d / 2);
      }
    }
  });

  it('las manchas reales quedan fuera de la huella del EMP/EF (no lo tapan)', () => {
    for (const sc of SCENARIOS) {
      for (const s of latentStains(sc.evidenceItems, sc.scenarioId, sc.dimensions)) {
        if (s.kind !== 'real') continue;
        const src = sc.evidenceItems.find((i) => i.id === s.sourceId)!;
        expect(distanceToFootprint(s.x, s.z, src)).toBeGreaterThan(0.2);
      }
    }
  });

  it('es determinista por escenario (no salta al remontar)', () => {
    const sc = SCENARIOS[0];
    expect(latentStains(sc.evidenceItems, sc.scenarioId, sc.dimensions)).toEqual(latentStains(sc.evidenceItems, sc.scenarioId, sc.dimensions));
    // Un escenario sin biológicos también tiene señuelos (el brillo no delata).
    const noBio = sc.evidenceItems.filter((i) => !hasLatentTrace(i));
    const st = latentStains(noBio, 'X', sc.dimensions);
    expect(st.every((s) => s.kind === 'decoy')).toBe(true);
    expect(st.length).toBe(DECOY_COUNT);
  });
});

describe('cordón de cinta', () => {
  it('encierra la escena con margen y tramos no mayores al máximo', () => {
    const dims = { w: 16, d: 12 };
    const { posts, spans } = cordonLayout(dims);
    expect(posts.length).toBe(spans.length);
    for (const s of spans) expect(s.length).toBeLessThanOrEqual(CORDON_MAX_SPAN + 1e-9);
    const hx = dims.w / 2 + CORDON_MARGIN, hz = dims.d / 2 + CORDON_MARGIN;
    for (const [x, z] of posts) {
      const onEdge = Math.abs(Math.abs(x) - hx) < 1e-9 || Math.abs(Math.abs(z) - hz) < 1e-9;
      expect(onEdge).toBe(true);
    }
    // Las 4 esquinas son postes.
    for (const c of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) {
      expect(posts.some(([x, z]) => Math.abs(x - c[0]) < 1e-9 && Math.abs(z - c[1]) < 1e-9)).toBe(true);
    }
    // El perímetro de los tramos es el del rectángulo.
    const per = spans.reduce((a, s) => a + s.length, 0);
    expect(per).toBeCloseTo(2 * (2 * hx + 2 * hz), 6);
  });

  it('la cinta no se mueve en los postes y queda quieta sin viento', () => {
    expect(tapeOffset(0, 3, 1.2, 0.05).sway).toBeCloseTo(0, 9);
    expect(tapeOffset(1, 3, 1.2, 0.05).sway).toBeCloseTo(0, 9);
    expect(tapeOffset(0.5, 3, 7.7, 0).sway).toBe(0);
    expect(tapeOffset(0.5, 3, 0, 0).sag).toBeLessThan(0);
    expect(tapeOffset(0.5, 3, 0, 0).sag).toBe(tapeOffset(0.5, 3, 99, 0).sag);
  });
});

describe('ruta de ingreso/salida con placas de paso', () => {
  it('placas espaciadas regularmente y sin pisar ningún EMP/EF', () => {
    for (const sc of SCENARIOS) {
      const steps = routeSteps(routePath(sc.environmentType), sc.evidenceItems);
      expect(steps.length).toBeGreaterThan(5);
      for (const s of steps) {
        for (const it of sc.evidenceItems) expect(distanceToFootprint(s.x, s.z, it)).toBeGreaterThanOrEqual(STEP_CLEARANCE);
      }
      expect(steps.map((s) => s.index)).toEqual(steps.map((_, i) => i));
    }
  });

  it('en un tramo recto, separación exacta y orientación al avance', () => {
    const steps = routeSteps([[0, 0], [4, 0]]);
    expect(steps.length).toBe(Math.floor((4 - STEP_SPACING / 2) / STEP_SPACING) + 1);
    for (let i = 1; i < steps.length; i++) expect(steps[i].x - steps[i - 1].x).toBeCloseTo(STEP_SPACING, 9);
    expect(steps[0].rotY).toBeCloseTo(0, 9);
    // Avanzar hacia +Z equivale a girar -90° sobre Y (eje +X local → +Z mundo).
    expect(routeSteps([[0, 0], [0, 3]])[0].rotY).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('el espaciado continúa a través de los vértices de la polilínea', () => {
    const steps = routeSteps([[0, 0], [1, 0], [1, 3]]);
    for (let i = 1; i < steps.length; i++) {
      // A lo largo de la polilínea la distancia es STEP_SPACING; en línea recta, a lo sumo eso.
      expect(Math.hypot(steps[i].x - steps[i - 1].x, steps[i].z - steps[i - 1].z)).toBeLessThanOrEqual(STEP_SPACING + 1e-9);
    }
  });
});

describe('trípodes de luz de trabajo', () => {
  it('siempre dos, dentro de la escena, apuntando al centroide y sin pisar EMP/EF', () => {
    for (const sc of SCENARIOS) {
      const pl = workLightPlacements(sc.evidenceItems, sc.dimensions);
      expect(pl.length).toBe(2);
      const c = evidenceCentroid(sc.evidenceItems);
      for (const p of pl) {
        expect(p.target).toEqual(c);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(sc.dimensions.w / 2);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(sc.dimensions.d / 2);
        for (const it of sc.evidenceItems) expect(distanceToFootprint(p.x, p.z, it)).toBeGreaterThanOrEqual(WORK_LIGHT_CLEARANCE);
      }
    }
    expect(workLightPlacements([], { w: 10, d: 10 }).length).toBe(2);
  });

  it('la cantidad de luces no depende de la calidad; solo intensidad/sombra', () => {
    const a = workLightSettings('alta', false), b = workLightSettings('baja', false);
    expect(a.castShadow).toBe(true);
    expect(b.castShadow).toBe(false);
    expect(b.dust).toBe(false);
    expect(workLightSettings('alta', true).intensity).toBeLessThan(a.intensity);
  });
});

describe('presentación del EMP/EF y etiquetas', () => {
  it('labels=false no renderiza etiquetas (ni testigos ni EMP/EF)', () => {
    expect(labelsVisible({ labels: false })).toBe(false);
    expect(labelsVisible({ labels: true }, true)).toBe(false); // modal abierto
    expect(labelsVisible({ labels: true })).toBe(true);
    expect(evidencePresentation(blank, { labels: false }, true, false).showLabel).toBe(false);
    expect(evidencePresentation(blank, DEFAULT_VIEW, true, false).showLabel).toBe(true);
  });

  it('z-index de las etiquetas por debajo de la interfaz (>= 50) y de los modales', () => {
    expect(LABEL_Z_RANGE[0]).toBeLessThan(50);
    expect(LABEL_Z_RANGE[1]).toBe(0);
  });

  it('placa al señalizar, escala al fotografiar, silueta al recolectar', () => {
    expect(evidencePresentation({ ...blank, marked: true }, DEFAULT_VIEW, false, false).showPlate).toBe(true);
    expect(evidencePresentation({ ...blank, photographed: true }, DEFAULT_VIEW, false, false).showScale).toBe(true);
    const col = evidencePresentation({ ...blank, marked: true, photographed: true, collected: true }, DEFAULT_VIEW, false, false);
    expect(col.showModel).toBe(false);
    expect(col.showSilhouette).toBe(true);
    expect(col.showScale).toBe(false);
    expect(col.showPlate).toBe(true); // la placa se queda en el lugar
    const idle = evidencePresentation(blank, DEFAULT_VIEW, false, false);
    expect(idle.showModel && !idle.showPlate && !idle.showScale && !idle.showSilhouette).toBe(true);
  });

  it('halo: selección tiene prioridad sobre hover', () => {
    expect(evidencePresentation(blank, DEFAULT_VIEW, true, true).halo).toBe('selected');
    expect(evidencePresentation(blank, DEFAULT_VIEW, false, true).halo).toBe('hover');
    expect(evidencePresentation(blank, DEFAULT_VIEW, false, false).halo).toBe('none');
  });
});

describe('tipo de prop por EMP/EF', () => {
  it('cada EMP/EF integrado resuelve a un prop específico (no genérico)', () => {
    for (const sc of SCENARIOS) for (const it of sc.evidenceItems) expect(resolveKind(it)).not.toBe('generic');
  });
  it('casos representativos', () => {
    expect(resolveKind({ name: 'Vainilla simulada', nature: 'balística' })).toBe('shell');
    expect(resolveKind({ name: 'Prenda con mancha hemática', nature: 'biológica' })).toBe('garment');
    expect(resolveKind({ name: 'Mancha hemática en asfalto', nature: 'biológica' })).toBe('stain');
    expect(resolveKind({ name: 'Autoparte desprendida', nature: 'física' })).toBe('autopart');
    expect(resolveKind({ name: 'Dispositivo de video', nature: 'digital' })).toBe('camera');
  });
});

describe('utilidades', () => {
  it('prefers-reduced-motion: lee matchMedia y tolera su ausencia', () => {
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(prefersReducedMotion({ matchMedia: () => { throw new Error('x'); } })).toBe(false);
  });
  it('aleatorio sembrado reproducible y en [0,1)', () => {
    const a = mulberry32(hashString('k')), b = mulberry32(hashString('k'));
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});
