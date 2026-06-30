// Validación pura (testeable) del diligenciamiento de rótulo y cadena de custodia.
// Extraída del reducer para poder probarla en aislamiento sin construir SimState.
// La lógica de puntaje es idéntica a la que tenía simulator.ts.

import type { CustodyRecord, EvidenceItem, LabelRecord, PackagingId, Scenario } from './types';
import { PACKAGING_LABELS } from './types';
import { normalize } from './util';

export interface ScoreResult { pts: number; errors: string[]; }

export function scoreLabel(f: LabelRecord, scenario: Scenario, item: EvidenceItem, pkg: PackagingId | null): ScoreResult {
  let pts = 0; const errors: string[] = [];
  if (f.nunc) { pts += 4; if (normalize(f.nunc) === normalize(scenario.nunc)) pts += 4; else errors.push('NUNC inconsistente'); } else errors.push('Falta NUNC');
  if (f.evidenceId) { pts += 4; if (normalize(f.evidenceId) === normalize(item.id)) pts += 5; else errors.push('ID EMP/EF incorrecto'); } else errors.push('Falta ID EMP/EF');
  if (f.description) { pts += 3; if (normalize(f.description).includes(normalize(item.name).split(' ')[0])) pts += 3; } else errors.push('Falta descripción');
  if (f.date) pts += 2; else errors.push('Falta fecha');
  if (f.time) pts += 2; else errors.push('Falta hora');
  if (f.location) { pts += 3; if (normalize(f.location).includes(normalize(scenario.sceneLocation).split(' ')[0])) pts += 2; } else errors.push('Falta lugar de hallazgo');
  if (f.collectedBy) pts += 3; else errors.push('Falta recolector');
  if (f.packaging) {
    pts += 3;
    const pkgText = normalize(PACKAGING_LABELS[pkg as PackagingId] || '');
    if (normalize(f.packaging).includes(pkgText) || pkgText.includes(normalize(f.packaging))) pts += 4;
    else errors.push('Tipo de embalaje no corresponde al realmente seleccionado');
  } else errors.push('Falta embalaje');
  if (f.obs) pts += 1;
  return { pts, errors };
}

export function scoreCustody(r: CustodyRecord, scenario: Scenario, item: EvidenceItem): ScoreResult {
  let pts = 0; const errors: string[] = [];
  if (r.nunc) { pts += 4; if (normalize(r.nunc) === normalize(scenario.nunc)) pts += 4; else errors.push('NUNC inconsistente'); } else errors.push('Falta NUNC');
  if (r.idText) { pts += 4; if (normalize(r.idText) === normalize(item.id)) pts += 4; else errors.push('ID EMP/EF incorrecto'); } else errors.push('Falta ID EMP/EF');
  if (r.date) pts += 3; else errors.push('Falta fecha');
  if (r.time) pts += 3; else errors.push('Falta hora');
  if (r.from) pts += 3; else errors.push('Falta quien entrega');
  if (r.to) pts += 3; else errors.push('Falta quien recibe');
  if (r.purpose) {
    pts += 3;
    const p = normalize(r.purpose);
    if (p.includes('almac') || p.includes('anál') || p.includes('anal') || p.includes('lab')) pts += 2;
  } else errors.push('Falta destino o propósito');
  if (r.container) pts += 2; else errors.push('Falta estado del contenedor');
  if (r.description) { pts += 4; if (normalize(r.description).includes(normalize(item.name).split(' ')[0])) pts += 2; } else errors.push('Falta descripción del EMP/EF');
  if (r.obs) pts += 1;
  return { pts, errors };
}
