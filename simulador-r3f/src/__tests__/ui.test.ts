// Gate de la interfaz (consola forense): sin emoji, tokens presentes y con contraste,
// lógica pura de formato, conteos, permisos y atajos, y el aviso de fallo 3D.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EVIDENCE_STEPS, TOOLS, actionAriaLabel, fmtClock, fmtTime, isTypingTarget, nextIndex,
  permMark, sceneView, shortcutFor, stepsDone, toolLabel,
} from '../ui/logic';
import { buildRoadmap, shortStage } from '../ui/roadmap';
import { SceneBoundary, SceneFailure } from '../ui/SceneBoundary';
import { DEFAULT_VIEW } from '../scene/contracts';
import { initState, reducer } from '../simulator';
import type { EvidenceState } from '../types';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Pictogramas emoji y símbolos que el inspector cuenta como emoji (incluye ⚠ ⏱ ✓ ○ →).
const EMOJI = /[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}]|\u{FE0F}/u;

describe('sin emoji en la interfaz', () => {
  const files = [...walk(join(SRC, 'ui')), join(SRC, 'App.tsx')].filter((f) => /\.(tsx?|css)$/.test(f));

  it('recorre src/ui y App.tsx', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  for (const f of files) {
    it(`${f.slice(SRC.length + 1)} no contiene emoji ni pictogramas`, () => {
      const lines = readFileSync(f, 'utf8').split('\n');
      const hits = lines.map((l, i) => [i + 1, l] as const).filter(([, l]) => EMOJI.test(l));
      expect(hits.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([]);
    });
  }

  it('el regex detecta los glifos que antes usaba el HUD', () => {
    for (const g of ['🔒', '⚠', '⏱', '✓', '○', '→']) expect(EMOJI.test(g)).toBe(true);
    expect(EMOJI.test('Recolectar · EMP/EF ¿Qué? 3/8')).toBe(false);
  });
});

// --- Tokens y contraste ---

const css = readFileSync(join(SRC, 'index.css'), 'utf8') + readFileSync(join(SRC, 'App.css'), 'utf8');

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} no definido`);
  return m[1].toLowerCase();
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('tokens de la hoja data-terminal', () => {
  it('define todos los tokens requeridos con los valores del spec', () => {
    expect(token('ground')).toBe('#171719');
    expect(token('surface')).toBe('#131217');
    expect(token('raised')).toBe('#212023');
    expect(token('text')).toBe('#ffffff');
    expect(token('muted')).toBe('#8a8c92');
    expect(token('accent')).toBe('#f2c230');
    expect(token('positive')).toBe('#44a282');
    expect(token('negative')).toBe('#e5566f');
    expect(token('warning')).toBe('#d9a441');
    expect(token('accent-ink')).toBe('#131217');
    for (const n of ['border', 'rule', 'control']) expect(token(n)).toMatch(/^#/);
  });

  it('usa Public Sans autoalojada, sin CDN de fuentes', () => {
    expect(css).toContain("@import '@fontsource-variable/public-sans'");
    expect(css).toContain('Public Sans Variable');
    expect(css).not.toMatch(/fonts\.googleapis|https?:\/\//);
  });

  it('sin degradados, blur ni texto bajo 11px', () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/backdrop-filter/);
    const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('ningún color violeta o índigo (la hoja lo prohíbe), tampoco fuera de los tokens', () => {
    const hexes = [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1]);
    const violet = hexes.filter((h) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      return b - Math.max(r, g) > 12 && r >= g; // azul dominante con rojo >= verde: violeta/índigo
    });
    expect(violet).toEqual([]);
  });

  it('respeta prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('cada par texto/superficie pasa 4.5:1', () => {
    const pairs: [string, string][] = [
      ['text', 'surface'], ['text', 'raised'], ['text', 'ground'],
      ['muted', 'surface'], ['muted', 'raised'], ['muted', 'ground'],
      ['accent-ink', 'accent'],
      ['positive', 'surface'], ['negative', 'surface'], ['warning', 'surface'],
      ['negative', 'pill-negative-bg'], ['warning', 'pill-warning-bg'],
    ];
    for (const [fg, bg] of pairs) {
      const c = contrast(token(fg), token(bg));
      expect(c, `${fg} sobre ${bg} = ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
    // Recordatorio del hallazgo: blanco sobre el acento NO pasa (por eso --accent-ink).
    expect(contrast('#ffffff', token('accent'))).toBeLessThan(4.5);
  });
});

// --- Lógica pura ---

const blank = (): EvidenceState => ({
  observed: false, photographed: false, marked: false, collected: false, packaged: false, labeled: false,
  custody: false, delivered: false, contaminated: false, contaminationReason: null, package: null,
  labelRecord: null, deliveredTo: null, analyzed: false, stored: false,
});

describe('formato y conteos', () => {
  it('fmtTime da m:ss con cifras fijas y recorta negativos', () => {
    expect(fmtTime(150)).toBe('2:30');
    expect(fmtTime(9)).toBe('0:09');
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(-5)).toBe('0:00');
    expect(fmtTime(61.9)).toBe('1:01');
    expect(fmtTime(3600)).toBe('60:00');
  });

  it('fmtClock tolera fechas inválidas', () => {
    expect(fmtClock('no-es-fecha')).toBe('--:--:--');
    expect(fmtClock('2026-10-27T15:04:05')).toMatch(/15:04:05/);
  });

  it('stepsDone cuenta solo las 8 marcas del ciclo (no laboratorio ni contaminación)', () => {
    expect(EVIDENCE_STEPS).toHaveLength(8);
    expect(stepsDone(blank())).toBe(0);
    expect(stepsDone({ ...blank(), observed: true, photographed: true, contaminated: true, analyzed: true })).toBe(2);
    const all = blank();
    for (const s of EVIDENCE_STEPS) (all[s.key] as boolean) = true;
    expect(stepsDone(all)).toBe(8);
  });

  it('las 10 herramientas conservan su nombre completo (lo usan eval y aria-label)', () => {
    expect(TOOLS.map((t) => t.label)).toEqual([
      'Observar', 'Fotografiar', 'Numerador', 'Recolectar', 'Embalar', 'Rotular',
      'Cadena custodia', 'Entregar', 'Analizar (lab)', 'Almacenar (lab)',
    ]);
    expect(toolLabel('CUSTODY')).toBe('Cadena custodia');
    expect(toolLabel(null)).toBe('ninguna');
  });

  it('permMark traduce el permiso del rol a candado/condición con texto accesible', () => {
    expect(permMark('fotografo', 'COLLECT')?.kind).toBe('deny');
    expect(permMark('criminalistica', 'COLLECT')).toBeNull();
    expect(permMark('primer_responsable', 'OBSERVE')).toBeNull(); // OBSERVE nunca se bloquea
    const m = permMark('fotografo', 'COLLECT');
    expect(actionAriaLabel('Recolectar', m)).toMatch(/^Recolectar\. No permitido para este rol: \[Fuera de rol\]/);
    expect(actionAriaLabel('Observar', null)).toBe('Observar');
  });

  it('nextIndex recorre la lista con flechas, Inicio y Fin', () => {
    expect(nextIndex(0, 4, 'ArrowDown')).toBe(1);
    expect(nextIndex(3, 4, 'ArrowDown')).toBe(0);
    expect(nextIndex(0, 4, 'ArrowUp')).toBe(3);
    expect(nextIndex(2, 4, 'Home')).toBe(0);
    expect(nextIndex(1, 4, 'End')).toBe(3);
    expect(nextIndex(1, 4, 'a')).toBe(1);
    expect(nextIndex(0, 0, 'ArrowDown')).toBe(-1);
  });
});

describe('atajos de teclado (filtro del keydown global)', () => {
  const base = { modalOpen: false, targetTag: 'BODY' };

  it('L alterna la luz forense fuera de campos', () => {
    expect(shortcutFor({ ...base, key: 'l' })).toBe('toggle-forensic');
    expect(shortcutFor({ ...base, key: 'L' })).toBe('toggle-forensic');
    expect(shortcutFor({ ...base, key: 'l', targetTag: 'BUTTON' })).toBe('toggle-forensic');
  });

  it('L no dispara al escribir (input, textarea, select, contenteditable) ni con modal', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) expect(shortcutFor({ ...base, key: 'l', targetTag: tag })).toBeNull();
    expect(shortcutFor({ ...base, key: 'l', targetTag: 'DIV', editable: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'l', modalOpen: true })).toBeNull();
  });

  it('ignora repeticiones y combinaciones con modificadores', () => {
    expect(shortcutFor({ ...base, key: 'l', repeat: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'l', ctrlKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'l', metaKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'Escape', altKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'Escape', repeat: true, modalOpen: true })).toBeNull();
  });

  it('Esc cierra primero el modal (también desde un campo) y sin modal pide vista general', () => {
    expect(shortcutFor({ ...base, key: 'Escape', modalOpen: true })).toBe('close-modal');
    expect(shortcutFor({ ...base, key: 'Escape', modalOpen: true, targetTag: 'TEXTAREA' })).toBe('close-modal');
    expect(shortcutFor({ ...base, key: 'Escape' })).toBe('overview');
    expect(shortcutFor({ ...base, key: 'Escape', targetTag: 'SELECT' })).toBeNull();
  });

  it('otras teclas no hacen nada', () => {
    expect(shortcutFor({ ...base, key: 'k' })).toBeNull();
    expect(shortcutFor({ ...base, key: 'Enter' })).toBeNull();
  });

  it('isTypingTarget reconoce campos', () => {
    expect(isTypingTarget('INPUT')).toBe(true);
    expect(isTypingTarget('BUTTON')).toBe(false);
    expect(isTypingTarget(undefined, true)).toBe(true);
    expect(isTypingTarget(undefined)).toBe(false);
  });
});

describe('vista de escena', () => {
  it('apaga las etiquetas Html mientras hay modal y conserva el resto', () => {
    const v = { ...DEFAULT_VIEW, forensicLight: true, overview: 3 };
    expect(sceneView(v, true)).toEqual({ ...v, labels: false });
    expect(sceneView(v, false)).toBe(v); // misma referencia: no re-renderiza la escena
  });
});

describe('hoja de ruta', () => {
  it('shortStage quita el paréntesis aclaratorio para la tira compacta', () => {
    expect(shortStage('Fijación (observación, fotografía y señalización)')).toBe('Fijación');
    expect(shortStage('Embalaje')).toBe('Embalaje');
  });

  it('cuenta etapas por EMP/EF y marca la primera pendiente como en curso', () => {
    let s = initState();
    const r0 = buildRoadmap(s);
    expect(r0.prep).toHaveLength(5);
    expect(r0.cycle).toHaveLength(6);
    expect(r0.prep[0]).toMatchObject({ label: 'EPP', done: false, current: true });
    expect(r0.cycle[0].current).toBe(true);
    expect(r0.cycle[0].count).toBe(`0/${s.scenario.evidenceItems.length}`);

    s = reducer(s, { type: 'APPLY_GLOBAL', action: 'EPP' });
    const r1 = buildRoadmap(s);
    expect(r1.prep[0].done).toBe(true);
    expect(r1.prep[1].current).toBe(true);
  });
});

describe('fallo de la vista 3D', () => {
  it('getDerivedStateFromError pasa el boundary a fallo', () => {
    expect(SceneBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it('en fallo renderiza el aviso con botón Recargar; sin fallo, los hijos', () => {
    // El render de servidor de React 19 no invoca boundaries de clase: se prueba render() directamente.
    const child = createElement('p', null, 'escena');
    const b = new SceneBoundary({ children: child });
    expect(renderToStaticMarkup(b.render() as ReactNode as never)).toBe('<p>escena</p>');
    b.state = { failed: true };
    const out = b.render();
    expect(isValidElement(out)).toBe(true);
    const html = renderToStaticMarkup(out as never);
    expect(html).toContain('role="alert"');
    expect(html).toContain('La vista 3D falló');
    expect(html).toContain('Recargar');
  });

  it('el aviso de contexto perdido explica que la práctica está guardada', () => {
    const html = renderToStaticMarkup(createElement(SceneFailure, { reason: 'contextlost' }));
    expect(html).toContain('La vista 3D se detuvo');
    expect(html).toContain('guardada');
  });
});

describe('ganchos estables para la evaluación', () => {
  const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
  it('conserva textos y data-eval que localizan los agentes', () => {
    expect(read('ui/TopBar.tsx')).toMatch(/aria-label="Escenario"[\s\S]*data-eval="scenario"/);
    expect(read('ui/TopBar.tsx')).toContain('data-eval="forensic-toggle"');
    expect(read('ui/TopBar.tsx')).toContain('>Luz forense<');
    expect(read('ui/Modals.tsx')).toMatch(/data-eval="manual-close"[\s\S]{0,160}>Entendido, iniciar práctica</);
  });
});
