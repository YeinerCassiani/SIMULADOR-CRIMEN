// Activación de especialistas por indicio (Sección 9, regla 6 del documento de roles;
// Manual Integrado de Criminalística FGN). Según la naturaleza del EMP/EF, ciertos
// elementos exigen un perito especializado: arma/munición → balística;
// dispositivo digital → informática forense; fluidos/tejidos → biología/genética;
// material traza → evidencia traza; explosivos → antiexplosivos.
//
// Pura y de solo lectura. El reducer aplica el feedback/penalización.

export interface SpecialistReq {
  /** Especialista que debería intervenir. */
  label: string;
  /** Laboratorio/área de destino asociado. */
  lab: string;
}

export function requiredSpecialist(nature: string): SpecialistReq | null {
  const n = (nature || '').toLowerCase();
  if (n.includes('digital')) return { label: 'Experto en informática forense', lab: 'Informática forense' };
  if (n.includes('bal')) return { label: 'Perito en balística', lab: 'Balística forense' };
  if (n.includes('biológ') || n.includes('biolog') || n.includes('genét') || n.includes('genet')) return { label: 'Perito en biología/genética', lab: 'Biología / genética forense' };
  if (n.includes('traza')) return { label: 'Perito en evidencia traza', lab: 'Evidencia traza' };
  if (n.includes('explos')) return { label: 'Técnico en explosivos', lab: 'Antiexplosivos' };
  return null; // física / documental: criminalística de campo general
}

// El rol "perito especializado" representa, en el conjunto jugable, al especialista
// competente para cualquiera de las naturalezas anteriores.
export function roleIsSpecialist(roleId: string): boolean {
  return roleId === 'perito';
}
