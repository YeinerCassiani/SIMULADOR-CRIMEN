// Gate del flujo de la práctica: siguiente paso sugerido, relevo de rol en práctica
// guiada (antes de bloquear) y penalización directa en evaluación.
import { describe, it, expect } from 'vitest';
import { initState, reducer, type Action, type SimState } from '../simulator';
import { DEFAULT_PRACTICE, type PracticeSettings } from '../types';
import { SCENARIOS } from '../data/scenarios';
import { ROLE_DEFS, resolvePermission, type ActionKey } from '../roles';
import { ACTION_NAME, nextEvidenceTool, nextStep, ownerRole, planGlobal, planTool, planWitness } from '../flow';

const GUIDED: PracticeSettings = { mode: 'guiada', timerSeconds: 150 };
const EVAL: PracticeSettings = { mode: 'evaluacion', timerSeconds: 150 };
const start = (role: string, practice: PracticeSettings = GUIDED, index = 0): SimState =>
  reducer(initState(), { type: 'START_PRACTICE', scenarios: SCENARIOS, index, role, practice });

/** Ejecuta el plan como lo haría la interfaz: si abre un aviso, acepta y sigue. */
function act(s: SimState, a: Action): SimState {
  let next = reducer(s, a);
  if (next.modal?.kind === 'relevo') {
    const m = next.modal;
    next = reducer(reducer(reducer(next, { type: 'CLOSE_MODAL' }), { type: 'SET_ROLE', role: m.role }), m.then);
  }
  if (next.modal?.kind === 'confirm') {
    const m = next.modal;
    next = reducer(reducer(next, { type: 'CLOSE_MODAL' }), { type: 'APPLY_TOOL', id: m.evidenceId, tool: m.tool });
  }
  return next;
}

describe('ownerRole', () => {
  it('cada acción tiene un rol que la puede hacer sin restricción', () => {
    for (const key of Object.keys(ACTION_NAME) as ActionKey[]) {
      expect(resolvePermission(ownerRole(key), key).level).toBe('allow');
    }
  });

  it('roles naturales: criminalística recolecta, primer responsable acordona', () => {
    expect(ownerRole('COLLECT')).toBe('criminalistica');
    expect(ownerRole('CORDON')).toBe('primer_responsable');
    expect(ROLE_DEFS.some((r) => r.id === ownerRole('ANALYZE'))).toBe(true);
  });
});

describe('planTool: práctica guiada', () => {
  it('fuera de rol ofrece el relevo en vez de bloquear y penalizar', () => {
    const s = start('primer_responsable');
    const a = planTool(s, 'COLLECT', 'EMP-001');
    expect(a.type).toBe('OPEN_MODAL');
    if (a.type !== 'OPEN_MODAL' || a.modal.kind !== 'relevo') throw new Error('se esperaba relevo');
    expect(a.modal.role).toBe('criminalistica');
    expect(a.modal.task).toBe('Recolectar');
    // Al aceptar, se evalúan los riesgos ya con el rol nuevo (aviso antes del error).
    expect(a.modal.then.type).toBe('OPEN_MODAL');
  });

  it('con riesgos avisa antes de actuar (no aplica de una)', () => {
    const s = start('criminalistica');
    const a = planTool(s, 'COLLECT', 'EMP-001');
    expect(a.type === 'OPEN_MODAL' && a.modal.kind === 'confirm').toBe(true);
  });

  it('sin riesgos aplica directamente la herramienta indicada', () => {
    const s = start('investigador_lider');
    expect(planTool(s, 'OBSERVE', 'EMP-001')).toEqual({ type: 'APPLY_TOOL', id: 'EMP-001', tool: 'OBSERVE' });
  });

  it('aceptar el relevo cambia el rol, lo registra y no cobra la penalización por rol', () => {
    // Criminalística no coordina: definir la ruta le corresponde a otro rol.
    let s = start('criminalistica');
    expect(resolvePermission('criminalistica', 'ROUTE').level).toBe('deny');
    s = act(s, planGlobal(s, 'ROUTE'));
    expect(s.log.some((l) => l.competence === 'deny')).toBe(false);
    expect(s.log.some((l) => /Cambio de rol/.test(l.message))).toBe(true);
    expect(s.role).toBe(ownerRole('ROUTE'));
    expect(s.globals.route).toBe(true);
  });
});

describe('planTool: evaluación', () => {
  it('no hay relevo ni aviso: el reducer bloquea y penaliza', () => {
    const s = start('primer_responsable', EVAL);
    const a = planTool(s, 'COLLECT', 'EMP-001');
    expect(a).toEqual({ type: 'APPLY_TOOL', id: 'EMP-001', tool: 'COLLECT' });
    const after = reducer(s, a);
    expect(after.log[0].competence).toBe('deny');
    expect(after.evidence['EMP-001'].collected).toBe(false);
  });

  it('testigos y globales también van directo', () => {
    const s = start('criminalistica', EVAL);
    expect(planWitness(s, 'T-001')).toEqual({ type: 'WITNESS_ACTION', id: 'T-001' });
    expect(planGlobal(s, 'HANDOVER')).toEqual({ type: 'APPLY_GLOBAL', action: 'HANDOVER' });
  });
});

describe('nextStep', () => {
  it('empieza por el EPP y no sugiere nada tras finalizar', () => {
    const s = start('investigador_lider');
    expect(nextStep(s)?.target).toEqual({ kind: 'global', action: 'EPP' });
    expect(nextStep({ ...s, finalized: true })).toBeNull();
  });

  it('indica el dueño cuando el rol actual no puede hacer el paso', () => {
    const s = start('criminalistica');
    let st = act(s, planGlobal(s, 'EPP'));
    st = act(st, planGlobal(st, 'CORDON'));
    const step = nextStep(st)!;
    expect(step.target).toEqual({ kind: 'global', action: 'ROUTE' });
    // Criminalística no coordina (deny): el paso dice a quién le corresponde.
    expect(step.owner).toBe(ownerRole('ROUTE'));
  });

  it('no revela respuestas: no menciona el método recomendado ni embalajes ni laboratorios', () => {
    let s = start('investigador_lider');
    const texts: string[] = [];
    for (let i = 0; i < 80; i++) {
      const step = nextStep(s);
      if (!step) break;
      texts.push(step.text);
      const t = step.target;
      if (t.kind === 'global') s = act(s, planGlobal(s, t.action));
      else if (t.kind === 'witness') s = act(s, planWitness(s, t.id));
      else if (t.kind === 'access') s = reducer(s, { type: 'ADD_ACCESS', record: { person: 'P', role: 'r', time: '10:00', motive: 'm', zone: 'z', action: 'ingreso' } });
      else if (t.kind === 'evidence') {
        s = act(s, planTool(s, t.tool, t.id));
        // Formularios: el estudiante los llena; aquí se guardan para avanzar.
        const m = s.modal;
        if (m?.kind === 'package') s = reducer(s, { type: 'SAVE_PACKAGE', choice: 'caja_rigida' });
        else if (m?.kind === 'label') s = reducer(s, { type: 'SAVE_LABEL', form: { nunc: 'n', evidenceId: t.id, description: 'd', date: 'x', time: 'x', location: 'l', collectedBy: 'c', packaging: 'p', obs: '' } });
        else if (m?.kind === 'custody') s = reducer(s, { type: 'SAVE_CUSTODY', record: { evidenceId: t.id, evidenceName: 'n', nunc: 'n', idText: 'i', date: 'x', time: 'x', from: 'a', to: 'b', purpose: 'p', container: 'c', description: 'd', obs: '' } });
        else if (m?.kind === 'deliver') s = reducer(s, { type: 'SAVE_DELIVER', destination: 'Almacén transitorio de evidencias' });
      } else if (t.kind === 'closure') break;
    }
    // El recorrido guiado llega hasta el cierre: el estudiante nunca queda sin saber qué hacer.
    expect(nextStep(s)?.target.kind).toBe('closure');
    const all = texts.join(' ');
    expect(all).not.toMatch(/zonas|espiral|franjas|cuadr[ií]cula/i);
    expect(all).not.toMatch(/caja r[ií]gida|bolsa|sobre de papel|Bal[ií]stica forense|Documentolog/i);
  });

  it('ciclo del EMP/EF en orden', () => {
    const st = initState().evidence['EMP-001'];
    expect(nextEvidenceTool(st)).toBe('OBSERVE');
    expect(nextEvidenceTool({ ...st, observed: true, photographed: true })).toBe('MARK');
    expect(nextEvidenceTool({ ...st, observed: true, photographed: true, marked: true, collected: true, packaged: true, labeled: true, custody: true, delivered: true })).toBeNull();
  });
});

describe('START_PRACTICE y configuración', () => {
  it('fija caso, rol, modo y cronómetro, y abre la ayuda', () => {
    const s = start('fotografo', { mode: 'evaluacion', timerSeconds: 300 }, 1);
    expect(s.started).toBe(true);
    expect(s.role).toBe('fotografo');
    expect(s.practice.mode).toBe('evaluacion');
    expect(s.scenario.environmentType).toBe('abierto');
    expect(s.timeLeft).toBe(300);
    expect(s.modal).toEqual({ kind: 'manual' });
  });

  it('cronómetro desactivado: sin tiempo en lugares abiertos', () => {
    expect(start('fotografo', { mode: 'guiada', timerSeconds: null }, 1).timeLeft).toBeNull();
  });

  it('empezar de nuevo conserva el modo y el cronómetro', () => {
    const s = reducer(start('fotografo', { mode: 'evaluacion', timerSeconds: 600 }, 1), { type: 'RESET' });
    expect(s.practice).toEqual({ mode: 'evaluacion', timerSeconds: 600 });
    expect(s.timeLeft).toBe(600);
    expect(s.started).toBe(true);
  });

  it('APPLY_TOOL con herramienta explícita no depende de la seleccionada', () => {
    const s = reducer(start('investigador_lider'), { type: 'APPLY_TOOL', id: 'EMP-001', tool: 'OBSERVE' });
    expect(s.evidence['EMP-001'].observed).toBe(true);
    expect(s.selectedTool).toBeNull();
  });

  it('el estado por defecto es práctica guiada sin iniciar', () => {
    const s = initState();
    expect(s.practice).toEqual(DEFAULT_PRACTICE);
    expect(s.started).toBe(false);
  });
});
