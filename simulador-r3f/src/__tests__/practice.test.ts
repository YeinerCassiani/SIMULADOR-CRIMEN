// Gate de la configuración docente, el editor de casos por formulario, el informe
// estructurado y lo que el modo evaluación oculta.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initState, reducer, type SimState } from '../simulator';
import { SCENARIOS } from '../data/scenarios';
import { layoutFor } from '../scene/env/layout';
import { reportModel } from '../report';
import {
  DEFAULT_CONFIG, availableRoles, availableScenarios, configFromHash, decodeConfig, encodeConfig,
  hashPin, normalizeConfig, practiceOf, studentLink, validPin, type TeacherConfig,
} from '../practiceConfig';
import {
  ENVIRONMENTS, clampToArea, draftToScenario, emptyDraft, scenarioToDraft, validateDraft, type CaseDraft,
} from '../ui/caseLogic';
import { modeSummary, timerSummary } from '../ui/startLogic';
import { TopBar } from '../ui/TopBar';
import { LogDrawer } from '../ui/LogDrawer';
import { ProcedureStrip } from '../ui/ProcedurePanel';
import { NextStepBar } from '../ui/PracticeAids';
import { StartScreen } from '../ui/StartScreen';
import { ReportView } from '../ui/ReportView';

const noop = () => {};

function fullDraft(): CaseDraft {
  return {
    ...emptyDraft(),
    title: 'Hurto en tienda «La Ñapa»',
    narrative: 'Se reporta un hurto con arma blanca.',
    witnesses: [{ name: 'Cajera', mustBeSeparated: true, hasRelevantInfo: true }],
    items: [
      { name: 'Navaja', nature: 'física', description: 'Junto a la caja', correctPackaging: 'caja_rigida', labDestination: 'Clínica y patología / lofoscopia', x: 2, z: 1 },
      { name: 'Recibo', nature: 'documental', description: '', correctPackaging: 'sobre_papel', labDestination: 'Documentología', x: -3, z: -2 },
    ],
  };
}

describe('configuración docente y enlace', () => {
  it('el enlace conserva la configuración, con tildes y casos propios', () => {
    const sc = draftToScenario(fullDraft(), 'DOC-1');
    const c: TeacherConfig = { ...DEFAULT_CONFIG, mode: 'evaluacion', timerSeconds: 300, roles: ['criminalistica'], hiddenCases: ['SCN-ABI-001'], cases: [sc] };
    const link = studentLink('https://sim.example/app/?x=1#viejo', c);
    expect(link.startsWith('https://sim.example/app/?x=1#practica=')).toBe(true);
    expect(configFromHash(new URL(link).hash)).toEqual(c);
    expect(decodeConfig(encodeConfig(c))?.cases[0].title).toBe('Hurto en tienda «La Ñapa»');
  });

  it('un enlace dañado o ajeno no se usa', () => {
    expect(configFromHash('')).toBeNull();
    expect(configFromHash('#practica=@@no-es-base64')).toBeNull();
    expect(decodeConfig(encodeConfig({ ...DEFAULT_CONFIG, v: 2 } as unknown as TeacherConfig))).toBeNull();
  });

  it('normaliza valores raros sin romper la práctica', () => {
    const c = normalizeConfig({ v: 1, mode: 'otro', timerSeconds: -5, roles: ['inventado', 'fiscal'], hiddenCases: [3], cases: [{ roto: true }] })!;
    expect(c).toEqual({ v: 1, mode: 'guiada', timerSeconds: null, roles: ['fiscal'], hiddenCases: [], cases: [] });
  });

  it('casos y roles visibles para el estudiante', () => {
    const hidden = { ...DEFAULT_CONFIG, hiddenCases: ['SCN-ABI-001'] };
    expect(availableScenarios(hidden).map((s) => s.scenarioId)).not.toContain('SCN-ABI-001');
    // Si se ocultan todos, se muestran los integrados: la práctica nunca queda vacía.
    expect(availableScenarios({ ...DEFAULT_CONFIG, hiddenCases: SCENARIOS.map((s) => s.scenarioId) })).toHaveLength(SCENARIOS.length);
    expect(availableRoles({ ...DEFAULT_CONFIG, roles: ['fiscal'] }).map((r) => r.id)).toEqual(['fiscal']);
    expect(availableRoles(DEFAULT_CONFIG).length).toBe(7);
    expect(practiceOf({ ...DEFAULT_CONFIG, mode: 'evaluacion', timerSeconds: null })).toEqual({ mode: 'evaluacion', timerSeconds: null });
  });

  it('PIN: 4 a 8 números y huella estable que no contiene el PIN', async () => {
    expect(validPin('1234')).toBe(true);
    expect(validPin('123')).toBe(false);
    expect(validPin('12a4')).toBe(false);
    const h = await hashPin('2468');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await hashPin(' 2468 '));
    expect(h).not.toBe(await hashPin('2469'));
    expect(h).not.toContain('2468');
  });

  it('PIN en páginas sin HTTPS (sin crypto.subtle): huella de respaldo estable', async () => {
    const a = await hashPin('2468', null);
    expect(a).toMatch(/^fnv:[0-9a-f]{16}$/);
    expect(a).toBe(await hashPin(' 2468', null));
    expect(a).not.toBe(await hashPin('2469', null));
    expect(a).not.toBe(await hashPin('2468'));
  });
});

describe('editor de casos', () => {
  it('un borrador vacío explica qué falta, en lenguaje llano', () => {
    const errs = validateDraft(emptyDraft());
    expect(errs).toContain('Escriba el título del caso.');
    expect(errs.some((e) => /ubíquelo en el plano/.test(e))).toBe(true);
    expect(errs.some((e) => /embalaje correcto/.test(e))).toBe(true);
  });

  it('avisa si dos EMP/EF quedan encimados', () => {
    const d = fullDraft();
    d.items[1] = { ...d.items[1], x: 2.3, z: 1.2 };
    expect(validateDraft(d).some((e) => /demasiado juntos/.test(e))).toBe(true);
  });

  it('un caso completo se convierte, se juega y se puede volver a editar', () => {
    const d = fullDraft();
    expect(validateDraft(d)).toEqual([]);
    const sc = draftToScenario(d, 'DOC-x');
    expect(sc.evidenceItems.map((e) => e.id)).toEqual(['EMP-D01', 'EMP-D02']);
    expect(sc.evidenceItems[1].description).toBe('Recibo');
    expect(normalizeConfig({ ...DEFAULT_CONFIG, cases: [sc] })!.cases).toHaveLength(1);
    const s = reducer(initState(), { type: 'START_PRACTICE', scenarios: [sc], index: 0, role: 'criminalistica', practice: { mode: 'guiada', timerSeconds: null } });
    expect(Object.keys(s.evidence)).toEqual(['EMP-D01', 'EMP-D02']);
    expect(scenarioToDraft(sc)).toEqual({ ...d, items: d.items.map((it) => (it.description ? it : { ...it, description: 'Recibo' })) });
  });

  it('el mobiliario se aparta de los EMP/EF que ubica el docente', () => {
    for (const env of ENVIRONMENTS) {
      const sc = draftToScenario({ ...fullDraft(), env: env.key }, 'DOC-y');
      expect(() => layoutFor(sc)).not.toThrow();
    }
  });

  it('el plano mantiene cada EMP/EF dentro del área útil', () => {
    expect(clampToArea(50, -50, { w: 16, d: 12 })).toEqual({ x: 7.2, z: -5.2 });
    expect(clampToArea(1.234, 0.04, { w: 16, d: 12 })).toEqual({ x: 1.2, z: 0 });
  });
});

function playedEval(): SimState {
  let s = reducer(initState(), { type: 'START_PRACTICE', scenarios: SCENARIOS, index: 0, role: 'primer_responsable', practice: { mode: 'evaluacion', timerSeconds: 150 } });
  s = reducer(s, { type: 'CLOSE_MODAL' });
  s = reducer(s, { type: 'APPLY_GLOBAL', action: 'CORDON' });
  s = reducer(s, { type: 'APPLY_TOOL', id: 'EMP-001', tool: 'COLLECT' });
  return s;
}

describe('modo evaluación: sin pistas durante la práctica', () => {
  const s = playedEval();

  it('la barra superior no muestra puntaje ni nivel', () => {
    const html = renderToStaticMarkup(createElement(TopBar, { state: s, forensicLight: false, onToggleForensic: noop, inspectorOpen: true, onToggleInspector: noop, onHome: noop, onRole: noop }));
    expect(html).not.toContain('Puntaje');
    expect(html).not.toContain('Nivel');
    expect(html).toContain('Evaluación');
  });

  it('la bitácora no muestra mensajes ni puntos hasta finalizar', () => {
    const html = renderToStaticMarkup(createElement(LogDrawer, { state: s, open: true, onToggle: noop }));
    expect(html).not.toMatch(/pts|Acordonó|Fuera de rol/);
    expect(html).toContain('informe final');
    const fin = renderToStaticMarkup(createElement(LogDrawer, { state: { ...s, finalized: true }, open: true, onToggle: noop }));
    expect(fin).toContain('Acordonó');
  });

  it('sin siguiente paso ni etapa en curso', () => {
    expect(renderToStaticMarkup(createElement(NextStepBar, { state: s, onShow: noop }))).toBe('');
    const strip = renderToStaticMarkup(createElement(ProcedureStrip, { state: s, onDetail: noop }));
    expect(strip).not.toContain('is-current');
    expect(strip).not.toContain('strip-current');
  });

  it('en guiada sí se ven el puntaje y el siguiente paso', () => {
    const g = { ...s, practice: { mode: 'guiada' as const, timerSeconds: 150 } };
    expect(renderToStaticMarkup(createElement(NextStepBar, { state: g, onShow: noop }))).toContain('Siguiente paso');
    const html = renderToStaticMarkup(createElement(TopBar, { state: g, forensicLight: false, onToggleForensic: noop, inspectorOpen: true, onToggleInspector: noop, onHome: noop, onRole: noop }));
    expect(html).toContain('Puntaje');
  });
});

describe('pantalla de inicio', () => {
  it('ofrece continuar una práctica sin terminar y los dos caminos', () => {
    const saved = reducer(initState(), { type: 'START_PRACTICE', scenarios: SCENARIOS, index: 2, role: 'fiscal', practice: { mode: 'guiada', timerSeconds: 150 } });
    const html = renderToStaticMarkup(createElement(StartScreen, { config: DEFAULT_CONFIG, fromLink: false, saved, onContinue: noop, onStart: noop, onTeacher: noop }));
    expect(html).toContain('Continuar práctica');
    expect(html).toContain('Fiscal del caso');
    expect(html).toContain('Soy estudiante');
    expect(html).toContain('Soy docente');
  });

  it('desde el enlace del docente no se ofrece el espacio docente', () => {
    const html = renderToStaticMarkup(createElement(StartScreen, { config: DEFAULT_CONFIG, fromLink: true, saved: null, onContinue: noop, onStart: noop, onTeacher: noop }));
    expect(html).not.toContain('Soy docente');
    expect(html).toContain('preparó su docente');
  });

  it('resumen de modo y tiempo', () => {
    expect(modeSummary('evaluacion')).toMatch(/sin ayudas/i);
    expect(timerSummary(150, 'cerrado')).toMatch(/Sin límite/);
    expect(timerSummary(150, 'abierto')).toMatch(/2:30/);
    expect(timerSummary(null, 'vial')).toMatch(/Sin límite/);
  });
});

describe('informe', () => {
  it('modelo con rol inicial, roles, errores en orden y sin datos personales', () => {
    const s = playedEval();
    const m = reportModel(s);
    expect(m.initialRole).toBe('primer_responsable');
    expect(m.mode).toBe('evaluacion');
    expect(m.offRole).toBe(1);
    expect(m.mistakes.length).toBeGreaterThan(0);
    expect(m.mistakes[0].message).not.toMatch(/^[+-]?\d+ pts/);
    expect(Object.keys(m)).not.toEqual(expect.arrayContaining(['name', 'student', 'nombre']));
    const html = renderToStaticMarkup(createElement(ReportView, { m }));
    expect(html).toContain('Primer responsable');
    expect(html).toContain('Errores y alertas');
    expect(html).toContain(s.scenario.title);
  });
});
