// Tipo de prop 3D del EMP/EF, derivado de su naturaleza y nombre.
import type { EvidenceItem } from '../../types';

export type PropKind =
  | 'shell' | 'phone' | 'camera' | 'garment' | 'stain' | 'document'
  | 'glass' | 'bag' | 'blunt' | 'autopart' | 'generic';

const has = (s: string, ...keys: string[]) => keys.some((k) => s.includes(k));

export function resolveKind(item: Pick<EvidenceItem, 'name' | 'nature'>): PropKind {
  const n = (item.nature || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  if (has(name, 'video', 'cámara', 'camara')) return 'camera';
  if (has(name, 'bolso') || has(n, 'física/documental', 'fisica/documental')) return 'bag';
  if (has(name, 'autoparte')) return 'autopart';
  if (has(n, 'traza') || has(name, 'vidrio')) return 'glass';
  if (has(n, 'bal')) return 'shell';
  // Biológico: prenda manchada salvo que sea una mancha directa sobre el piso.
  if (has(n, 'biológ', 'biolog')) return has(name, 'mancha') && !has(name, 'prenda', 'ropa', 'tela') ? 'stain' : 'garment';
  if (has(n, 'digital')) return 'phone';
  if (has(n, 'document')) return 'document';
  if (has(n, 'física', 'fisica')) return 'blunt';
  return 'generic';
}
