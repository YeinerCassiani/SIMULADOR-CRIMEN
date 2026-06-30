import { describe, it, expect } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { LAB_DESTINATIONS } from '../types';
import { initState, reducer } from '../simulator';

describe('integridad de escenarios', () => {
  it('hay al menos 4 escenarios', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(4);
  });

  it('cada destino correcto de EMP/EF existe en LAB_DESTINATIONS (entrega siempre posible)', () => {
    SCENARIOS.forEach((s) => s.evidenceItems.forEach((e) => {
      expect(LAB_DESTINATIONS, `${e.id} → ${e.labDestination}`).toContain(e.labDestination);
    }));
  });

  it('cada escenario carga sin romper el reducer', () => {
    SCENARIOS.forEach((_, i) => {
      const s = reducer(initState(), { type: 'LOAD_SCENARIO', index: i });
      expect(s.scenario.evidenceItems.length).toBeGreaterThan(0);
      expect(Object.keys(s.evidence).length).toBe(s.scenario.evidenceItems.length);
    });
  });
});
