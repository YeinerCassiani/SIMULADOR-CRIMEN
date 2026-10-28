// Textos de la pantalla de inicio y del espacio docente (lógica pura, probada en
// practice.test.ts). Separados del componente para que Fast Refresh solo vea componentes.
import type { EnvironmentType, PracticeMode } from '../types';
import { fmtTime } from './logic';

export const MODE_LABEL: Record<PracticeMode, string> = { guiada: 'Práctica guiada', evaluacion: 'Evaluación' };

/** Qué cambia en cada modo, sin el nombre del modo (para tarjetas que ya lo muestran). */
export function modeDescription(mode: PracticeMode): string {
  return mode === 'guiada'
    ? 'El simulador indica el siguiente paso, avisa antes de un error y muestra los puntos de cada acción.'
    : 'Sin ayudas. Los puntos y la retroalimentación se ven en el informe final.';
}

export function modeSummary(mode: PracticeMode): string {
  return `${MODE_LABEL[mode]}: ${modeDescription(mode).charAt(0).toLowerCase()}${modeDescription(mode).slice(1)}`;
}

export function timerSummary(seconds: number | null, env: EnvironmentType): string {
  if (env === 'cerrado') return 'Sin límite (lugar cerrado).';
  if (seconds == null) return 'Sin límite de tiempo.';
  return `${fmtTime(seconds)} para recolectar antes de que los EMP/EF se pierdan (lugar abierto).`;
}
