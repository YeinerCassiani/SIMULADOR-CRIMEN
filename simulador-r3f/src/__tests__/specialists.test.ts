import { describe, it, expect } from 'vitest';
import { requiredSpecialist, roleIsSpecialist } from '../specialists';

describe('especialista por indicio', () => {
  it('mapea la naturaleza al especialista correcto', () => {
    expect(requiredSpecialist('digital')?.lab).toMatch(/Inform/i);
    expect(requiredSpecialist('balística')?.lab).toMatch(/Balíst/i);
    expect(requiredSpecialist('biológica')?.lab).toMatch(/Biolog|Biológ/i);
    expect(requiredSpecialist('traza')?.lab).toMatch(/traza/i);
  });

  it('naturalezas generales no exigen especialista', () => {
    expect(requiredSpecialist('física')).toBeNull();
    expect(requiredSpecialist('documental')).toBeNull();
  });

  it('el rol perito representa al especialista', () => {
    expect(roleIsSpecialist('perito')).toBe(true);
    expect(roleIsSpecialist('criminalistica')).toBe(false);
  });
});
