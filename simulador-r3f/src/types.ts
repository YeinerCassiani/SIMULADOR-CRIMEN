// Modelo de datos del simulador, portado 1:1 desde el JSON del simulador original.
// Mantener estos tipos alineados con DEFAULT_SCENARIOS permite reutilizar el editor
// docente y las exportaciones sin reescribir la estructura de datos.

export type ToolId =
  | 'OBSERVE'
  | 'PHOTOGRAPH'
  | 'MARK'
  | 'COLLECT'
  | 'PACKAGE'
  | 'LABEL'
  | 'CUSTODY'
  | 'DELIVER'
  | 'ANALYZE'
  | 'STORE';

export type PackagingId =
  | 'bolsa_papel'
  | 'bolsa_plastica'
  | 'bolsa_antiestatica'
  | 'caja_rigida'
  | 'sobre_papel'
  | 'contenedor_vidrio';

export type EnvironmentType = 'cerrado' | 'abierto' | 'vial';

export interface Witness {
  id: string;
  name: string;
  mustBeSeparated: boolean;
  hasRelevantInfo: boolean;
}

export interface EvidenceItem {
  id: string;
  name: string;
  nature: string;
  /** Posición en el plano (x = ancho, z = profundidad). Centro del objeto. */
  x: number;
  z: number;
  /** Dimensiones de la caja: w (x), d (z), h (alto/y). */
  w: number;
  d: number;
  h: number;
  correctPackaging: PackagingId;
  labDestination: string;
  description: string;
  requiresPhotoBeforeCollection: boolean;
}

export interface Scenario {
  scenarioId: string;
  title: string;
  environmentType: EnvironmentType;
  penalReference: string;
  recommendedSearchMethod: string;
  initialNarrative: string;
  nunc: string;
  dimensions: { w: number; d: number };
  sceneLocation: string;
  /** Variante de decoración para ambientes 'cerrado' (p. ej. 'apartamento', 'vivienda'). */
  decor?: string;
  witnesses: Witness[];
  evidenceItems: EvidenceItem[];
}

/** Diligenciamiento del rótulo básico. */
export interface LabelRecord {
  nunc: string;
  evidenceId: string;
  description: string;
  date: string;
  time: string;
  location: string;
  collectedBy: string;
  packaging: string;
  obs: string;
}

/** Registro básico de cadena de custodia. */
export interface CustodyRecord {
  evidenceId: string;
  evidenceName: string;
  nunc: string;
  idText: string;
  date: string;
  time: string;
  from: string;
  to: string;
  purpose: string;
  container: string;
  description: string;
  obs: string;
}

/** Estado mutable por cada EMP/EF durante la práctica. */
export interface EvidenceState {
  observed: boolean;
  photographed: boolean;
  marked: boolean;
  collected: boolean;
  packaged: boolean;
  labeled: boolean;
  custody: boolean;
  delivered: boolean;
  contaminated: boolean;
  /** Causa concreta de la contaminación, para feedback pedagógico. */
  contaminationReason: string | null;
  package: PackagingId | null;
  labelRecord: LabelRecord | null;
  deliveredTo: string | null;
  /** Continuidad de laboratorio (post-entrega): análisis y almacenamiento. */
  analyzed: boolean;
  stored: boolean;
}

/** Estado de gestión de cada testigo. */
export interface WitnessState {
  separated: boolean;
  interviewed: boolean;
}

/** Documentación de una intervención por salvamento de vida o control de riesgo. */
export interface SalvamentoRecord {
  moved: string;
  reason: string;
  deliveredTo: string;
}

/** Registro de ingreso/salida de personal al lugar (control de acceso). */
export interface AccessRecord {
  person: string;
  role: string;
  time: string;
  motive: string;
  zone: string;
  action: 'ingreso' | 'salida';
}

// Catálogo de destinos forenses para la decisión de entrega (incluye los correctos
// de todos los escenarios; el estudiante debe elegir el adecuado por naturaleza).
export const LAB_DESTINATIONS: string[] = [
  'Balística forense',
  'Informática forense',
  'Informática forense / video',
  'Biología / genética forense',
  'Documentología',
  'Clínica y patología / lofoscopia',
  'Evidencia traza',
  'Lofoscopia / análisis documental',
  'Automotores',
  'Almacén transitorio de evidencias',
];

export const PACKAGING_LABELS: Record<PackagingId, string> = {
  bolsa_papel: 'Bolsa de papel',
  bolsa_plastica: 'Bolsa plástica',
  bolsa_antiestatica: 'Bolsa antiestática',
  caja_rigida: 'Caja rígida',
  sobre_papel: 'Sobre de papel',
  contenedor_vidrio: 'Frasco o contenedor hermético',
};

export const SEARCH_METHODS = [
  { value: 'zonas', label: 'Por zonas' },
  { value: 'espiral', label: 'Espiral' },
  { value: 'franjas', label: 'Franjas' },
  { value: 'cuadricula', label: 'Cuadrícula' },
  { value: 'punto_a_punto', label: 'Punto a punto' },
] as const;

export type LogType = 'info' | 'good' | 'bad' | 'warn';

/**
 * Cómo se juega la práctica (lo decide el docente):
 * - guiada: siguiente paso sugerido, avisos antes de un error, relevo de rol ofrecido
 *   y puntaje visible tras cada acción.
 * - evaluacion: sin ayudas; el puntaje y la bitácora se ven en el informe final.
 */
export type PracticeMode = 'guiada' | 'evaluacion';

export interface PracticeSettings {
  mode: PracticeMode;
  /** Segundos del cronómetro en lugares abiertos y vías; null lo desactiva. */
  timerSeconds: number | null;
}

export const DEFAULT_PRACTICE: PracticeSettings = { mode: 'guiada', timerSeconds: 150 };

export interface LogEntry {
  time: string;
  message: string;
  type: LogType;
  points: number;
  score: number;
  /** Rol activo cuando se registró la acción (trazabilidad por actor). */
  role?: string;
  /** Marca de control de competencia: acción fuera de rol o condicionada. */
  competence?: 'deny' | 'conditional';
}
