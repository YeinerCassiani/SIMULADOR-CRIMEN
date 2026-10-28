import type { SimState } from './simulator';
import { DEFAULT_PRACTICE } from './types';
import { SCENARIOS } from './data/scenarios';

const KEY = 'simulador-crimen-r3f-v5';

// Persistencia de la práctica (corrige la ausencia de guardado del simulador original).
// Se guarda todo el estado serializable; los modales abiertos no se restauran.
export function loadState(): SimState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimState;
    if (!parsed.scenario || !Array.isArray(parsed.scenarios) || !parsed.witnesses) return null;
    // Refrescar los escenarios INTEGRADOS desde el código (no desde la caché), para
    // que los cambios de escenario surtan efecto sin depender del estado persistido.
    // Se reemplazan por scenarioId: la lista de la práctica puede ser un subconjunto
    // (casos ocultos por el docente) más casos propios del docente.
    const builtin = new Map(SCENARIOS.map((s) => [s.scenarioId, s]));
    const scenarios = parsed.scenarios.length ? parsed.scenarios.map((s) => builtin.get(s.scenarioId) ?? s) : [...SCENARIOS];
    const scenarioIndex = Math.min(Math.max(0, parsed.scenarioIndex ?? 0), scenarios.length - 1);
    const scenario = scenarios[scenarioIndex] ?? scenarios[0];
    // Prácticas guardadas antes del modo/cronómetro configurables: valores por defecto.
    const practice = parsed.practice ?? DEFAULT_PRACTICE;
    const started = parsed.started ?? parsed.log.length > 0;
    return { ...parsed, scenarios, scenarioIndex, scenario, practice, started, modal: null };
  } catch {
    return null;
  }
}

export function saveState(state: SimState): void {
  try {
    const { modal, ...rest } = state;
    void modal;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Cuota llena o almacenamiento no disponible: se ignora silenciosamente.
  }
}

export function clearState(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
