import { describe, it, expect } from 'vitest';
import { resolvePermission } from '../roles';

describe('matriz de permisos por rol', () => {
  it('fotógrafo no puede recolectar pero sí documentar', () => {
    expect(resolvePermission('fotografo', 'COLLECT').level).toBe('deny');
    expect(resolvePermission('fotografo', 'PHOTOGRAPH').level).toBe('allow');
  });

  it('criminalística recolecta, embala, custodia y entrega', () => {
    expect(resolvePermission('criminalistica', 'COLLECT').level).toBe('allow');
    expect(resolvePermission('criminalistica', 'CUSTODY').level).toBe('allow');
    expect(resolvePermission('criminalistica', 'DELIVER').level).toBe('allow');
  });

  it('transportador hace custodia/entrega pero no recolecta', () => {
    expect(resolvePermission('transportador', 'COLLECT').level).toBe('deny');
    expect(resolvePermission('transportador', 'CUSTODY').level).toBe('allow');
    expect(resolvePermission('transportador', 'DELIVER').level).toBe('allow');
  });

  it('OBSERVE y EPP siempre permitidos', () => {
    expect(resolvePermission('transportador', 'OBSERVE').level).toBe('allow');
    expect(resolvePermission('fotografo', 'EPP').level).toBe('allow');
  });

  it('primer responsable: entrega formal y reporte de iniciación permitidos', () => {
    expect(resolvePermission('primer_responsable', 'HANDOVER').level).toBe('allow');
    expect(resolvePermission('primer_responsable', 'REPORT_INIT').level).toBe('allow');
    expect(resolvePermission('primer_responsable', 'COLLECT').level).toBe('deny');
  });

  it('rol desconocido no bloquea (degrada a allow)', () => {
    expect(resolvePermission('rol_inexistente', 'COLLECT').level).toBe('allow');
  });

  it('laboratorio (LAB): perito y transportador sí; criminalística no', () => {
    expect(resolvePermission('perito', 'ANALYZE').level).toBe('allow');
    expect(resolvePermission('transportador', 'STORE').level).toBe('allow');
    expect(resolvePermission('criminalistica', 'ANALYZE').level).toBe('deny');
  });
});
