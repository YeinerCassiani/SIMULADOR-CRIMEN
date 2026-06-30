import { describe, it, expect } from 'vitest';
import { scoreLabel, scoreCustody } from '../validation';
import { SCENARIOS } from '../data/scenarios';
import { PACKAGING_LABELS } from '../types';

const scn = SCENARIOS[0];
const item = scn.evidenceItems[0];

describe('scoreLabel', () => {
  it('rótulo completo y coherente no tiene errores', () => {
    const r = scoreLabel(
      { nunc: scn.nunc, evidenceId: item.id, description: item.name, date: '2026-01-01', time: '10:00', location: scn.sceneLocation, collectedBy: 'Perito X', packaging: PACKAGING_LABELS[item.correctPackaging], obs: 'ok' },
      scn, item, item.correctPackaging,
    );
    expect(r.errors).toHaveLength(0);
    expect(r.pts).toBeGreaterThan(20);
  });

  it('rótulo vacío acumula errores', () => {
    const r = scoreLabel({ nunc: '', evidenceId: '', description: '', date: '', time: '', location: '', collectedBy: '', packaging: '', obs: '' }, scn, item, null);
    expect(r.errors).toContain('Falta NUNC');
    expect(r.errors.length).toBeGreaterThan(4);
  });
});

describe('scoreCustody', () => {
  it('registro completo no tiene errores', () => {
    const r = scoreCustody(
      { evidenceId: item.id, evidenceName: item.name, nunc: scn.nunc, idText: item.id, date: '2026-01-01', time: '10:00', from: 'A', to: 'B', purpose: 'análisis de laboratorio', container: 'sellado', description: item.name, obs: '' },
      scn, item,
    );
    expect(r.errors).toHaveLength(0);
  });

  it('NUNC inconsistente se reporta', () => {
    const r = scoreCustody(
      { evidenceId: item.id, evidenceName: item.name, nunc: '000', idText: item.id, date: '2026-01-01', time: '10:00', from: 'A', to: 'B', purpose: 'análisis', container: 'sellado', description: item.name, obs: '' },
      scn, item,
    );
    expect(r.errors).toContain('NUNC inconsistente');
  });
});
