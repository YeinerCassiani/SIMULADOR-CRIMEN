// Configuración de la práctica que decide el docente: modo, cronómetro, roles
// disponibles, casos visibles y casos propios. Lógica pura más dos accesos al
// almacenamiento del navegador.
//
// Cómo llega a los estudiantes (sin servidor, funciona sin internet):
// 1. En el mismo equipo: se guarda en localStorage y la pantalla de inicio la usa.
// 2. En otros equipos: "Copiar enlace para estudiantes" pone la configuración en el
//    fragmento de la URL (#practica=...). El fragmento no se envía a ningún
//    servidor; el navegador del estudiante lo lee al abrir el enlace.
//
// El PIN del espacio docente evita que un estudiante entre por curiosidad. No es
// seguridad real: la configuración (y las respuestas de los casos) viajan en el
// enlace y alguien con conocimientos técnicos puede leerlas.
import type { PracticeMode, PracticeSettings, Scenario } from './types';
import { SCENARIOS } from './data/scenarios';
import { ROLE_DEFS, type RoleDef, type RoleId } from './roles';
import { validateScenario } from './report';

export interface TeacherConfig {
  v: 1;
  mode: PracticeMode;
  /** Segundos del cronómetro en lugares abiertos y vías; null lo desactiva. */
  timerSeconds: number | null;
  /** Roles que el estudiante puede elegir; vacío = todos. */
  roles: RoleId[];
  /** scenarioId de los casos integrados que no se muestran. */
  hiddenCases: string[];
  /** Casos creados por el docente. */
  cases: Scenario[];
}

export const DEFAULT_CONFIG: TeacherConfig = { v: 1, mode: 'guiada', timerSeconds: 150, roles: [], hiddenCases: [], cases: [] };

export const TIMER_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: 'Sin límite de tiempo' },
  { value: 150, label: '2 min 30 s' },
  { value: 300, label: '5 minutos' },
  { value: 600, label: '10 minutos' },
];

const ROLE_IDS = new Set<string>(ROLE_DEFS.map((r) => r.id));

/** Valida y completa una configuración leída de un enlace o del almacenamiento. null si no sirve. */
export function normalizeConfig(raw: unknown): TeacherConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<TeacherConfig>;
  if (r.v !== 1) return null;
  const mode: PracticeMode = r.mode === 'evaluacion' ? 'evaluacion' : 'guiada';
  const timerSeconds = typeof r.timerSeconds === 'number' && r.timerSeconds > 0 ? Math.round(r.timerSeconds) : null;
  const roles = Array.isArray(r.roles) ? r.roles.filter((x): x is RoleId => ROLE_IDS.has(x)) : [];
  const hiddenCases = Array.isArray(r.hiddenCases) ? r.hiddenCases.filter((x) => typeof x === 'string') : [];
  const cases: Scenario[] = [];
  for (const c of Array.isArray(r.cases) ? r.cases : []) {
    try { validateScenario(c); cases.push(c); } catch { /* caso dañado: se omite */ }
  }
  return { v: 1, mode, timerSeconds, roles, hiddenCases, cases };
}

// --- Enlace para estudiantes ---

const HASH_KEY = 'practica';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const std = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeConfig(c: TeacherConfig): string {
  return toBase64Url(JSON.stringify(c));
}

export function decodeConfig(code: string): TeacherConfig | null {
  try { return normalizeConfig(JSON.parse(fromBase64Url(code))); } catch { return null; }
}

/** Enlace para estudiantes a partir de la dirección actual (sin fragmento previo). */
export function studentLink(href: string, c: TeacherConfig): string {
  return `${href.split('#')[0]}#${HASH_KEY}=${encodeConfig(c)}`;
}

/** Configuración contenida en el fragmento de la URL, o null si no hay o está dañada. */
export function configFromHash(hash: string): TeacherConfig | null {
  const m = new RegExp(`[#&]${HASH_KEY}=([^&]+)`).exec(hash);
  return m ? decodeConfig(m[1]) : null;
}

// --- Qué ve el estudiante ---

export function availableScenarios(c: TeacherConfig): Scenario[] {
  const hidden = new Set(c.hiddenCases);
  const list = [...SCENARIOS.filter((s) => !hidden.has(s.scenarioId)), ...c.cases];
  // Si el docente ocultó todo, se muestran los integrados para no dejar la práctica vacía.
  return list.length ? list : [...SCENARIOS];
}

export function availableRoles(c: TeacherConfig): RoleDef[] {
  return c.roles.length ? ROLE_DEFS.filter((r) => c.roles.includes(r.id)) : ROLE_DEFS;
}

export function practiceOf(c: TeacherConfig): PracticeSettings {
  return { mode: c.mode, timerSeconds: c.timerSeconds };
}

// --- Espacio docente en este equipo ---

const STORE_KEY = 'simulador-docente-v1';

export interface TeacherStore { pinHash: string | null; config: TeacherConfig }

export function loadTeacher(): TeacherStore {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<TeacherStore> | null;
    return { pinHash: typeof raw?.pinHash === 'string' ? raw.pinHash : null, config: normalizeConfig(raw?.config) ?? DEFAULT_CONFIG };
  } catch {
    return { pinHash: null, config: DEFAULT_CONFIG };
  }
}

export function saveTeacher(t: TeacherStore): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch { /* almacenamiento no disponible */ }
}

/**
 * Huella del PIN (no se guarda el PIN en claro). SHA-256 cuando el navegador lo
 * ofrece; en páginas sin HTTPS (p. ej. la red local del aula por http) no existe
 * crypto.subtle y se usa FNV-1a de 64 bits. Ambas bastan para la protección "contra
 * curiosidad" que da el PIN; la marca "fnv:" evita confundir una con otra.
 */
export async function hashPin(pin: string, subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null): Promise<string> {
  const text = `simulador-crimen:${pin.trim()}`;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `fnv:${fnv1a64(text)}`;
}

function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

/** Largo a partir del cual algunos chats y aulas virtuales cortan los enlaces. */
export const LINK_WARN_LENGTH = 2000;

/** PIN válido: 4 a 8 dígitos. */
export function validPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin.trim());
}
