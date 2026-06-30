// --- Matriz de roles y permisos del simulador ---
//
// Traduce la Sección 8 ("Matriz de permisos recomendada") del documento
// "Matriz de Roles y Límites de Intervención en el Lugar de los Hechos"
// (SIJUCIF-AIES, 2026) a permisos de juego. Es pura y de solo lectura, igual
// que `stages.ts`: el reducer (`simulator.ts`) sigue siendo la autoridad que
// aplica el bloqueo y el puntaje; aquí solo se resuelve "¿este rol puede hacer
// esta acción?" con su fundamento.
//
// Fuentes: MUPJ-3 (Manual Único de Policía Judicial v3), MSCC-2018 (Manual del
// Sistema de Cadena de Custodia), MC-FGN (Manual Integrado de Criminalística).

import type { ToolId } from './types';

// Las globales se replican aquí como literales para no acoplar con simulator.ts
// (evita ciclo de importación). Coinciden con `GlobalAction` de simulator.ts.
export type GlobalActionKey = 'EPP' | 'CORDON' | 'ROUTE' | 'SEARCH_METHOD' | 'INTERVIEW' | 'REPORT_INIT' | 'HANDOVER';
export type ActionKey = ToolId | GlobalActionKey;

export type RoleId =
  | 'primer_responsable'
  | 'investigador_lider'
  | 'criminalistica'
  | 'fotografo'
  | 'perito'
  | 'fiscal'
  | 'transportador';

export interface RoleDef { id: RoleId; label: string; description: string; }

export const ROLE_DEFS: RoleDef[] = [
  { id: 'primer_responsable', label: 'Primer responsable', description: 'Protege y preserva el lugar; controla accesos; identifica y separa testigos; entrega formalmente a policía judicial.' },
  { id: 'investigador_lider', label: 'Investigador líder', description: 'Recibe el lugar, coordina la inspección y el equipo técnico bajo dirección del fiscal.' },
  { id: 'criminalistica', label: 'Criminalística de campo', description: 'Busca, fija, recolecta, embala, rotula e inicia la cadena de custodia del EMP/EF.' },
  { id: 'fotografo', label: 'Fotógrafo / topógrafo forense', description: 'Fija visual y espacialmente la escena; no recolecta ni embala.' },
  { id: 'perito', label: 'Perito especializado', description: 'Interviene dentro de su especialidad y protocolo cuando es requerido.' },
  { id: 'fiscal', label: 'Fiscal del caso', description: 'Dirige funcionalmente; ordena y orienta; no sustituye la función técnica.' },
  { id: 'transportador', label: 'Transportador / almacén / laboratorio', description: 'Continúa la cadena de custodia: recibe, registra continuidad y entrega al siguiente responsable.' },
];

export const DEFAULT_ROLE: RoleId = 'primer_responsable';

export function roleLabel(id: string): string {
  return ROLE_DEFS.find((r) => r.id === id)?.label ?? id;
}

// --- Capacidades (columnas de la matriz de la Sección 8) ---

export type Capability = 'PROTECT' | 'DOCUMENT' | 'COLLECT' | 'CUSTODY' | 'INTERVIEW' | 'COORDINATE' | 'DELIVER' | 'LAB';
export type Level = 'allow' | 'conditional' | 'deny';

interface CapInfo { label: string; denyMsg: string; condMsg: string; }
export const CAP_INFO: Record<Capability, CapInfo> = {
  PROTECT: { label: 'Proteger / acordonar', denyMsg: 'no controla el perímetro ni acordona la escena', condMsg: 'solo por asignación o ingreso autorizado' },
  DOCUMENT: { label: 'Fijar / documentar', denyMsg: 'no realiza fijación técnica de la escena', condMsg: 'solo registro inicial o dentro de su especialidad' },
  COLLECT: { label: 'Recolectar / embalar / rotular', denyMsg: 'no recolecta, embala ni rotula EMP/EF', condMsg: 'solo por asignación expresa y protocolo' },
  CUSTODY: { label: 'Cadena de custodia', denyMsg: 'no diligencia el registro de cadena de custodia', condMsg: 'según protocolo de continuidad' },
  INTERVIEW: { label: 'Entrevistar testigos', denyMsg: 'no entrevista ni gestiona testigos como policía judicial', condMsg: 'entrevista básica si procede' },
  COORDINATE: { label: 'Ordenar / coordinar', denyMsg: 'no coordina la inspección; informa al investigador líder', condMsg: 'solo control inicial o asesoría técnica' },
  DELIVER: { label: 'Entregar EMP/EF', denyMsg: 'no entrega EMP/EF al laboratorio/almacén', condMsg: 'según protocolo de continuidad' },
  LAB: { label: 'Laboratorio (análisis/almacenamiento)', denyMsg: 'no realiza análisis ni almacenamiento de laboratorio', condMsg: 'coordina o recibe los informes de laboratorio' },
};

export const ACTION_CAPABILITY: Record<ActionKey, Capability> = {
  // Herramientas EMP/EF
  OBSERVE: 'DOCUMENT', PHOTOGRAPH: 'DOCUMENT', MARK: 'DOCUMENT',
  COLLECT: 'COLLECT', PACKAGE: 'COLLECT', LABEL: 'COLLECT',
  CUSTODY: 'CUSTODY', DELIVER: 'DELIVER',
  ANALYZE: 'LAB', STORE: 'LAB',
  // Acciones globales
  EPP: 'PROTECT', CORDON: 'PROTECT', HANDOVER: 'COORDINATE',
  ROUTE: 'COORDINATE', SEARCH_METHOD: 'COORDINATE', REPORT_INIT: 'COORDINATE',
  INTERVIEW: 'INTERVIEW',
};

// Acciones siempre permitidas para cualquier rol: observación no invasiva y EPP
// (buena práctica universal). No se gatean por competencia.
const ALWAYS_ALLOW: ActionKey[] = ['OBSERVE', 'EPP'];

// Matriz rol → capacidad → nivel, derivada de la Sección 8 del documento.
export const ROLE_CAPS: Record<RoleId, Record<Capability, Level>> = {
  primer_responsable: { PROTECT: 'allow', DOCUMENT: 'conditional', COLLECT: 'deny', CUSTODY: 'deny', INTERVIEW: 'allow', COORDINATE: 'conditional', DELIVER: 'deny', LAB: 'deny' },
  investigador_lider: { PROTECT: 'allow', DOCUMENT: 'allow', COLLECT: 'conditional', CUSTODY: 'allow', INTERVIEW: 'allow', COORDINATE: 'allow', DELIVER: 'allow', LAB: 'conditional' },
  criminalistica: { PROTECT: 'conditional', DOCUMENT: 'allow', COLLECT: 'allow', CUSTODY: 'allow', INTERVIEW: 'deny', COORDINATE: 'deny', DELIVER: 'allow', LAB: 'deny' },
  fotografo: { PROTECT: 'conditional', DOCUMENT: 'allow', COLLECT: 'deny', CUSTODY: 'deny', INTERVIEW: 'deny', COORDINATE: 'deny', DELIVER: 'deny', LAB: 'deny' },
  perito: { PROTECT: 'conditional', DOCUMENT: 'allow', COLLECT: 'conditional', CUSTODY: 'conditional', INTERVIEW: 'deny', COORDINATE: 'conditional', DELIVER: 'deny', LAB: 'allow' },
  fiscal: { PROTECT: 'conditional', DOCUMENT: 'conditional', COLLECT: 'deny', CUSTODY: 'deny', INTERVIEW: 'allow', COORDINATE: 'allow', DELIVER: 'deny', LAB: 'deny' },
  transportador: { PROTECT: 'deny', DOCUMENT: 'conditional', COLLECT: 'deny', CUSTODY: 'allow', INTERVIEW: 'deny', COORDINATE: 'deny', DELIVER: 'allow', LAB: 'allow' },
};

// Excepciones por-acción dentro de una capacidad (matices del documento).
const ROLE_ACTION_OVERRIDES: Partial<Record<RoleId, Partial<Record<ActionKey, Level>>>> = {
  // El reporte de iniciación y la entrega formal del lugar son deberes del primer
  // responsable aunque su coordinación general sea solo "control inicial".
  primer_responsable: { REPORT_INIT: 'allow', HANDOVER: 'allow' },
  // Criminalística aplica el método de búsqueda (lo define el líder): condicionado.
  criminalistica: { SEARCH_METHOD: 'conditional' },
};

export interface Permission { level: Level; capability: Capability; reason: string; }

export function resolvePermission(roleId: string, actionKey: ActionKey): Permission {
  const capability = ACTION_CAPABILITY[actionKey];
  if (ALWAYS_ALLOW.includes(actionKey)) return { level: 'allow', capability, reason: '' };

  const caps = ROLE_CAPS[roleId as RoleId];
  // Rol desconocido (p. ej. dato antiguo): no bloquear, para no romper la práctica.
  if (!caps) return { level: 'allow', capability, reason: '' };

  const override = ROLE_ACTION_OVERRIDES[roleId as RoleId]?.[actionKey];
  const level = override ?? caps[capability];
  return { level, capability, reason: reasonText(roleId, capability, level) };
}

function reasonText(roleId: string, cap: Capability, level: Level): string {
  const info = CAP_INFO[cap];
  const who = roleLabel(roleId);
  if (level === 'deny') return `[Fuera de rol] ${who}: ${info.denyMsg} (Matriz de permisos, Sección 8; MUPJ-3 / MSCC-2018). Acción bloqueada.`;
  if (level === 'conditional') return `[Condicionado] ${who}: ${info.condMsg}; requiere asignación, orden o salvamento (Sección 8).`;
  return '';
}

export interface CapSummary { capability: Capability; label: string; level: Level; note: string; }

const ORDER: Capability[] = ['PROTECT', 'DOCUMENT', 'COLLECT', 'CUSTODY', 'INTERVIEW', 'COORDINATE', 'DELIVER', 'LAB'];

/** Resumen de permisos del rol para el HUD. */
export function capabilitySummary(roleId: string): CapSummary[] {
  const caps = ROLE_CAPS[roleId as RoleId];
  return ORDER.map((cap) => {
    const level: Level = caps ? caps[cap] : 'allow';
    const info = CAP_INFO[cap];
    const note = level === 'deny' ? info.denyMsg : level === 'conditional' ? info.condMsg : 'permitido';
    return { capability: cap, label: info.label, level, note };
  });
}

export const LEVEL_LABEL: Record<Level, string> = { allow: 'Sí', conditional: 'Condicionado', deny: 'No' };
