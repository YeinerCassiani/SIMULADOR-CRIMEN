import { describe, it, expect } from 'vitest';
import { reducer, initState, riskOfTool, type Action } from '../simulator';

function run(actions: Action[], state = initState()) {
  return actions.reduce(reducer, state);
}

const id = () => initState().scenario.evidenceItems[0].id;

describe('reducer — competencia por rol', () => {
  it('bloquea recolectar para fotógrafo (−15, sin mutar la evidencia)', () => {
    const eid = id();
    const before = initState();
    const s = run([
      { type: 'SET_ROLE', role: 'fotografo' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.evidence[eid].collected).toBe(false);
    expect(s.score).toBe(before.score - 15);
    expect(s.log[0].competence).toBe('deny');
  });

  it('permite recolectar para criminalística', () => {
    const eid = id();
    const s = run([
      { type: 'SET_ROLE', role: 'criminalistica' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.evidence[eid].collected).toBe(true);
  });
});

describe('reducer — contaminación con causa', () => {
  it('recolectar sin foto contamina y registra el motivo', () => {
    const eid = id();
    const s = run([
      { type: 'SET_ROLE', role: 'criminalistica' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.evidence[eid].contaminated).toBe(true);
    expect(s.evidence[eid].contaminationReason).toMatch(/fijación/i);
  });

  it('embalaje incorrecto contamina con su causa', () => {
    const eid = id();
    const item = initState().scenario.evidenceItems[0];
    const wrong = item.correctPackaging === 'bolsa_papel' ? 'bolsa_plastica' : 'bolsa_papel';
    const s = run([
      { type: 'OPEN_MODAL', modal: { kind: 'package', evidenceId: eid } },
      { type: 'SAVE_PACKAGE', choice: wrong },
    ]);
    expect(s.evidence[eid].contaminated).toBe(true);
    expect(s.evidence[eid].contaminationReason).toMatch(/embalaje/i);
  });

  it('embalaje correcto no contamina', () => {
    const eid = id();
    const item = initState().scenario.evidenceItems[0];
    const s = run([
      { type: 'OPEN_MODAL', modal: { kind: 'package', evidenceId: eid } },
      { type: 'SAVE_PACKAGE', choice: item.correctPackaging },
    ]);
    expect(s.evidence[eid].packaged).toBe(true);
    expect(s.evidence[eid].contaminated).toBe(false);
  });
});

describe('reducer — entrega formal del lugar', () => {
  it('registra el handover', () => {
    const s = reducer(initState(), { type: 'APPLY_GLOBAL', action: 'HANDOVER' });
    expect(s.globals.handover).toBe(true);
  });
});

describe('reducer — especialista por indicio', () => {
  const digitalId = () => initState().scenario.evidenceItems[1].id; // EMP-002 (digital)

  it('criminalística recibe advertencia de especialista al recolectar un digital', () => {
    const eid = digitalId();
    const s = run([
      { type: 'SET_ROLE', role: 'criminalistica' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.log.some((l) => /inform[áa]tica/i.test(l.message))).toBe(true);
  });

  it('el perito no recibe esa advertencia', () => {
    const eid = digitalId();
    const s = run([
      { type: 'SET_ROLE', role: 'perito' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.log.some((l) => /requiere Experto en inform/i.test(l.message))).toBe(false);
  });
});

describe('reducer — excepción por salvamento', () => {
  it('documentar salvamento activa la excepción y exime la penalización de EPP por orden', () => {
    const eid = id();
    const s = run([
      { type: 'SAVE_SALVAMENTO', record: { moved: 'prenda', reason: 'víctima herida', deliveredTo: 'salud' } },
      { type: 'SET_ROLE', role: 'criminalistica' },
      { type: 'SELECT_TOOL', tool: 'COLLECT' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.globals.salvamento).toBe(true);
    expect(s.log.some((l) => l.points === -12 && /sin registrar EPP/.test(l.message))).toBe(false);
  });
});

describe('reducer — registro de acceso', () => {
  it('agrega y quita registros de ingreso/salida', () => {
    const rec = { person: 'A', role: 'Primer responsable', time: '10:00', motive: 'protección', zone: 'crítico', action: 'ingreso' as const };
    let s = reducer(initState(), { type: 'ADD_ACCESS', record: rec });
    expect(s.accessLog).toHaveLength(1);
    s = reducer(s, { type: 'REMOVE_ACCESS', index: 0 });
    expect(s.accessLog).toHaveLength(0);
  });
});

describe('reducer — continuidad de laboratorio', () => {
  it('no se puede analizar sin entrega previa', () => {
    const eid = id();
    const s = run([
      { type: 'SET_ROLE', role: 'perito' },
      { type: 'SELECT_TOOL', tool: 'ANALYZE' },
      { type: 'APPLY_TOOL', id: eid },
    ]);
    expect(s.evidence[eid].analyzed).toBe(false);
  });

  it('tras la entrega, el perito analiza y luego almacena', () => {
    const base = initState();
    const eid = base.scenario.evidenceItems[0].id;
    const delivered = { ...base, role: 'perito', evidence: { ...base.evidence, [eid]: { ...base.evidence[eid], delivered: true } } };
    let s = reducer({ ...delivered, selectedTool: 'ANALYZE' }, { type: 'APPLY_TOOL', id: eid });
    expect(s.evidence[eid].analyzed).toBe(true);
    s = reducer({ ...s, selectedTool: 'STORE' }, { type: 'APPLY_TOOL', id: eid });
    expect(s.evidence[eid].stored).toBe(true);
  });
});

describe('reducer — cierre de escena', () => {
  it('finalizar con EMP/EF pendientes penaliza y marca finalizado', () => {
    const before = initState().score;
    const s = reducer(initState(), { type: 'FINALIZE' });
    expect(s.finalized).toBe(true);
    // −10 por EMP/EF pendientes y −4 por cierre sin registro de acceso (Sección 9, regla 3).
    expect(s.score).toBe(before - 14);
  });
});

describe('riskOfTool', () => {
  it('advierte al recolectar un EMP/EF sin fotografiar', () => {
    const s = initState();
    const eid = id();
    expect(riskOfTool('COLLECT', eid, s).length).toBeGreaterThan(0);
  });
});
