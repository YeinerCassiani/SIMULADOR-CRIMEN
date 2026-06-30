import { describe, it, expect } from 'vitest';
import { currentStage, nextStage } from '../stages';
import type { EvidenceState } from '../types';

function ev(partial: Partial<EvidenceState> = {}): EvidenceState {
  return {
    observed: false, photographed: false, marked: false, collected: false,
    packaged: false, labeled: false, custody: false, delivered: false,
    contaminated: false, contaminationReason: null, package: null, labelRecord: null, deliveredTo: null,
    analyzed: false, stored: false,
    ...partial,
  };
}

describe('máquina de etapas', () => {
  it('EMP/EF nuevo está en aseguramiento', () => {
    expect(currentStage(ev()).id).toBe('ASEGURAMIENTO');
  });

  it('con foto + numerador alcanza fijación', () => {
    expect(currentStage(ev({ photographed: true, marked: true })).id).toBe('FIJACION');
  });

  it('la siguiente etapa de uno nuevo es fijación', () => {
    expect(nextStage(ev())?.id).toBe('FIJACION');
  });

  it('entregado marca el ciclo como completado', () => {
    const full = ev({ photographed: true, marked: true, collected: true, packaged: true, labeled: true, custody: true, delivered: true });
    expect(currentStage(full).id).toBe('COMPLETADO');
    expect(nextStage(full)).toBeNull();
  });
});
