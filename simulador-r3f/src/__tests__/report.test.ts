import { describe, it, expect } from 'vitest';
import { initState } from '../simulator';
import { buildReport } from '../report';
import type { CustodyRecord } from '../types';

describe('report — continuidad de la cadena de custodia', () => {
  it('detecta ruptura cuando quien entrega no es quien recibió antes', () => {
    const base = initState();
    const item = base.scenario.evidenceItems[0];
    const r1: CustodyRecord = { evidenceId: item.id, evidenceName: item.name, nunc: base.scenario.nunc, idText: item.id, date: '2026-01-01', time: '10:00', from: 'A', to: 'B', purpose: 'análisis', container: 'sellado', description: item.name, obs: '' };
    const r2: CustodyRecord = { ...r1, time: '11:00', from: 'C', to: 'D' }; // C ≠ B → ruptura
    const state = { ...base, records: [r1, r2] };
    const rep = buildReport(state);
    expect(rep).toMatch(/Rupturas de continuidad detectadas: 1/);
  });

  it('cadena continua no reporta rupturas', () => {
    const base = initState();
    const item = base.scenario.evidenceItems[0];
    const r1: CustodyRecord = { evidenceId: item.id, evidenceName: item.name, nunc: base.scenario.nunc, idText: item.id, date: '2026-01-01', time: '10:00', from: 'A', to: 'B', purpose: 'análisis', container: 'sellado', description: item.name, obs: '' };
    const r2: CustodyRecord = { ...r1, time: '11:00', from: 'B', to: 'C' }; // continúa
    const rep = buildReport({ ...base, records: [r1, r2] });
    expect(rep).toMatch(/Rupturas de continuidad detectadas: 0/);
  });
});
