// Lógica pura de la interfaz (sin DOM ni React): formato, conteos, permisos y
// atajos de teclado. Se prueba en src/__tests__/ui.test.ts sin navegador.
import type { EvidenceState, ToolId } from '../types';
import type { ViewSettings } from '../scene/contracts';
import { resolvePermission, type ActionKey } from '../roles';

/** Las 8 marcas del ciclo de un EMP/EF, en el orden del rótulo. */
export const EVIDENCE_STEPS: { key: keyof EvidenceState; label: string }[] = [
  { key: 'observed', label: 'Observado' },
  { key: 'photographed', label: 'Fotografiado' },
  { key: 'marked', label: 'Señalizado' },
  { key: 'collected', label: 'Recolectado' },
  { key: 'packaged', label: 'Embalado' },
  { key: 'labeled', label: 'Rotulado' },
  { key: 'custody', label: 'Cadena' },
  { key: 'delivered', label: 'Entregado' },
];

/** Cuántas de las 8 marcas tiene cumplidas el EMP/EF. */
export function stepsDone(st: EvidenceState): number {
  return EVIDENCE_STEPS.filter((p) => st[p.key]).length;
}

/** Segundos a m:ss (cronómetro). Negativos y no enteros se recortan a 0 y se truncan. */
export function fmtTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60), sec = t % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Hora de una entrada de bitácora en 24 h (es-CO). */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('es-CO', { hour12: false });
}

export const TOOLS: { id: ToolId; label: string; short: string }[] = [
  { id: 'OBSERVE', label: 'Observar', short: 'Observar' },
  { id: 'PHOTOGRAPH', label: 'Fotografiar', short: 'Fotografiar' },
  { id: 'MARK', label: 'Numerador', short: 'Numerador' },
  { id: 'COLLECT', label: 'Recolectar', short: 'Recolectar' },
  { id: 'PACKAGE', label: 'Embalar', short: 'Embalar' },
  { id: 'LABEL', label: 'Rotular', short: 'Rotular' },
  { id: 'CUSTODY', label: 'Cadena custodia', short: 'Custodia' },
  { id: 'DELIVER', label: 'Entregar', short: 'Entregar' },
  { id: 'ANALYZE', label: 'Analizar (lab)', short: 'Analizar' },
  { id: 'STORE', label: 'Almacenar (lab)', short: 'Almacenar' },
];

export function toolLabel(id: ToolId | null): string {
  return TOOLS.find((t) => t.id === id)?.label ?? 'ninguna';
}

export type PermMark = { kind: 'deny' | 'cond'; text: string; reason: string } | null;

/** Marca de permiso de una acción para el rol activo (candado o condición), o null si está permitida. */
export function permMark(role: string, action: ActionKey): PermMark {
  const p = resolvePermission(role, action);
  if (p.level === 'deny') return { kind: 'deny', text: 'No permitido para este rol', reason: p.reason };
  if (p.level === 'conditional') return { kind: 'cond', text: 'Condicionado para este rol', reason: p.reason };
  return null;
}

/** Nombre accesible de un botón de acción: etiqueta + aviso de permiso. */
export function actionAriaLabel(label: string, mark: PermMark): string {
  return mark ? `${label}. ${mark.text}: ${mark.reason}` : label;
}

export const AMBIENTE_LABEL: Record<string, string> = { cerrado: 'Lugar cerrado', abierto: 'Lugar abierto', vial: 'Vía pública' };

// --- Atajos de teclado ---

export type Shortcut = 'toggle-forensic' | 'close-modal' | 'overview' | null;

export interface KeyInfo {
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** tagName del destino del evento (INPUT, TEXTAREA, SELECT, BUTTON, BODY...). */
  targetTag?: string;
  /** El destino es o está dentro de un [contenteditable]. */
  editable?: boolean;
  modalOpen: boolean;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** ¿El foco está en un campo donde el usuario escribe o elige? (ahí los atajos no aplican). */
export function isTypingTarget(tag: string | undefined, editable?: boolean): boolean {
  return !!editable || TYPING_TAGS.has((tag ?? '').toUpperCase());
}

/**
 * Decide qué atajo dispara una tecla. Un solo punto de verdad para el keydown global:
 * - Esc con modal abierto cierra el modal (como un <dialog> nativo, también desde un campo).
 * - Esc sin modal y fuera de un campo pide vista general.
 * - L (sin modificadores, fuera de campos y sin modal) alterna la luz forense.
 * - Teclas repetidas (mantener pulsado) no disparan nada.
 */
export function shortcutFor(k: KeyInfo): Shortcut {
  if (k.repeat) return null;
  if (k.ctrlKey || k.metaKey || k.altKey) return null;
  if (k.key === 'Escape') {
    if (k.modalOpen) return 'close-modal';
    return isTypingTarget(k.targetTag, k.editable) ? null : 'overview';
  }
  if (k.modalOpen || isTypingTarget(k.targetTag, k.editable)) return null;
  if (k.key.toLowerCase() === 'l') return 'toggle-forensic';
  return null;
}

/** Ajustes que recibe la escena: las etiquetas Html se apagan mientras hay un modal (no atraviesan el scrim). */
export function sceneView(view: ViewSettings, modalOpen: boolean): ViewSettings {
  return modalOpen && view.labels ? { ...view, labels: false } : view;
}

export const QUALITY_OPTIONS: { value: ViewSettings['quality']; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

/** Índice siguiente en una lista navegable con flechas (envuelve en los extremos). */
export function nextIndex(current: number, length: number, key: string): number {
  if (length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown') return (current + 1) % length;
  if (key === 'ArrowUp') return (current - 1 + length) % length;
  return current;
}
