#!/usr/bin/env node
// Harness determinista de evaluación visual (sección 7 del spec).
// Uso: node scripts/visual-eval.mjs [--url http://localhost:5199] [--out eval] [--label before|after]
//        [--headful] [--wait 2500] [--fps-ms 3000] [--only 0,2] [--gl gpu|swiftshader]
// Requiere el servidor de desarrollo corriendo y Chrome/Edge local (override: env CHROME_PATH).
// Escribe <out>/<label>/report.json y capturas en <out>/shots/<label>/. Sale con código 1 si algo falla.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import {
  THRESHOLDS, decodePng, luminanceStats, canvasCoveragePct, freeSceneRect, evaluateScenario, aggregate, fpsFromTimestamps,
} from './visual-eval-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1600, height: 900 };
// gpu: GPU real vía ANGLE (rápido, FPS representativo). swiftshader: GPU por software,
// portable a máquinas sin GPU (muy lento: ~1 FPS, una corrida tarda ~6 min).
const GL_ARGS = {
  gpu: ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])],
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

function parseArgs(argv) {
  const a = { url: 'http://localhost:5199', out: 'eval', label: 'before', headful: false, wait: 2500, fpsMs: 3000, only: null, gl: 'gpu' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--url') a.url = next();
    else if (k === '--out') a.out = next();
    else if (k === '--label') a.label = next();
    else if (k === '--headful') a.headful = true;
    else if (k === '--wait') a.wait = Number(next());
    else if (k === '--fps-ms') a.fpsMs = Number(next());
    else if (k === '--only') a.only = next().split(',').map(Number);
    else if (k === '--gl') a.gl = next();
  }
  return a;
}

function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const hit = candidates.find((p) => p && fs.existsSync(p));
  if (!hit) throw new Error('No se encontró Chrome/Edge. Defina CHROME_PATH.');
  return hit;
}

/** Títulos de escenario leídos de los datos (fuente de verdad para localizar el selector). */
function scenarioTitles() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/scenarios.ts'), 'utf8');
  return [...src.matchAll(/^\s*title:\s*'([^']+)'/gm)].map((m) => m[1]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cierra el modal "Manual" si está abierto: botón cuyo texto empieza con "Entendido". */
/**
 * Pantalla de bienvenida: espera a que "Entrar" se habilite (carga real terminada),
 * guarda la traza window.__splash (readyMs, items, errores) y entra. Las versiones
 * sin bienvenida (línea base) devuelven null sin esperar.
 */
async function passSplash(page) {
  if (!(await page.$('[data-splash-enter]'))) return null;
  await page.waitForSelector('[data-splash-enter]:not([disabled])', { timeout: 45000 });
  const trace = await page.evaluate(() => window.__splash ?? null);
  await page.click('[data-splash-enter]');
  await page.waitForFunction(() => !document.querySelector('[data-splash-enter]'), { timeout: 5000 });
  return trace;
}

async function closeManual(page) {
  return page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /^\s*entendido/i.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  });
}

/**
 * Selecciona el escenario por título. Estrategias, en orden:
 *  1) <select> cuyas opciones contienen al menos 2 títulos de escenario (elementHandle.select dispara change).
 *  2) Control con role=option/radio/tab/menuitem o <button> cuyo texto o aria-label contiene el título.
 * Devuelve la estrategia usada o null.
 */
async function selectScenario(page, title, titles) {
  const value = await page.evaluate((title, titles) => {
    for (const s of document.querySelectorAll('select')) {
      const opts = [...s.options];
      const hits = opts.filter((o) => titles.includes(o.textContent.trim())).length;
      if (hits >= 2) {
        const o = opts.find((o) => o.textContent.trim() === title);
        if (o) { s.setAttribute('data-eval-scenario', '1'); return o.value; }
      }
    }
    return null;
  }, title, titles);
  if (value !== null) {
    const handle = await page.$('select[data-eval-scenario="1"]');
    await handle.select(value);
    return 'select';
  }
  const clicked = await page.evaluate((title) => {
    const els = document.querySelectorAll('[role=option],[role=radio],[role=tab],[role=menuitem],[role=menuitemradio],button,a');
    for (const el of els) {
      const txt = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`;
      if (txt.includes(title)) { el.click(); return true; }
    }
    return false;
  }, title);
  return clicked ? 'click' : null;
}

/**
 * Espera a que la red quede quieta (modelos .glb, texturas y HDRI del escenario):
 * sin esto la captura puede caer en el respaldo procedural de Suspense mientras
 * carga. No falla si nunca se aquieta (se mide igual y queda el aviso en consola).
 */
async function settle(page, ms) {
  await sleep(ms);
  try { await page.waitForNetworkIdle({ idleTime: 800, timeout: 30000 }); }
  catch { console.warn('  aviso: la red no quedó inactiva en 30 s'); }
  await sleep(600); // un par de frames para compilar shaders de lo recién cargado
}

/** Rect del canvas WebGL más grande de la página. */
async function canvasRect(page) {
  return page.evaluate(() => {
    let best = null;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      const area = r.width * r.height;
      if (!best || area > best.area) best = { x: r.x, y: r.y, width: r.width, height: r.height, area };
    }
    return best;
  });
}

/**
 * Rect de escena libre (canvas menos riel, barra, inspector y bandeja de la UI).
 * Es lo que se captura y mide: ver freeSceneRect en visual-eval-lib.mjs.
 */
async function sceneRect(page, canvas) {
  const obstacles = await page.evaluate(() =>
    ['.rail', '.topbar', '.inspector', '.dock'].flatMap((sel) =>
      [...document.querySelectorAll(sel)].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })));
  const r = freeSceneRect(canvas, obstacles);
  return r.width > 50 && r.height > 50 ? r : canvas;
}

/** Captura recortada al canvas (no depende de preserveDrawingBuffer) y mide. */
async function shootAndMeasure(page, rect, file) {
  const clip = {
    x: Math.max(0, Math.floor(rect.x)), y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(Math.min(rect.width, VIEWPORT.width - rect.x))),
    height: Math.max(1, Math.floor(Math.min(rect.height, VIEWPORT.height - rect.y))),
  };
  const buf = await page.screenshot({ type: 'png', clip });
  fs.writeFileSync(file, buf);
  const img = decodePng(buf);
  return luminanceStats(img.data, { step: 2 });
}

/** Muestrea FPS con requestAnimationFrame durante `ms`. */
async function sampleFps(page, ms) {
  const ts = await page.evaluate((ms) => new Promise((resolve) => {
    const out = [];
    const t0 = performance.now();
    const tick = (t) => { out.push(t); if (t - t0 < ms) requestAnimationFrame(tick); else resolve(out); };
    requestAnimationFrame(tick);
  }), ms);
  return fpsFromTimestamps(ts);
}

/**
 * Modo luz forense: busca un control (button/switch/checkbox/label) con texto o aria-label
 * "luz forense"; si no existe, prueba la tecla L. Devuelve el método o null.
 */
async function toggleForensic(page) {
  const found = await page.evaluate(() => {
    const els = document.querySelectorAll('button,[role=switch],[role=checkbox],[role=button],input[type=checkbox],label');
    for (const el of els) {
      const txt = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.textContent || ''}`;
      if (/luz\s+forense/i.test(txt)) { el.click(); return 'control'; }
    }
    return null;
  });
  if (found) return found;
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.press('l');
  return 'tecla-L';
}

async function evalScenario(browser, args, index, titles, shotsDir) {
  const ctx = await browser.createBrowserContext(); // contexto aislado: localStorage limpio por escenario
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORT);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const r = { index, title: titles[index] };
  try {
    await page.goto(args.url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('canvas', { timeout: 30000 });
    await sleep(500);
    r.splash = await passSplash(page);
    r.manualClosed = await closeManual(page);
    r.selectStrategy = await selectScenario(page, titles[index], titles);
    if (!r.selectStrategy) throw new Error('no se pudo seleccionar el escenario');
    await settle(page, args.wait);

    const rect = await canvasRect(page);
    if (!rect) throw new Error('no hay <canvas>');
    r.canvasRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    r.canvasPct = canvasCoveragePct(rect, VIEWPORT);
    r.glRenderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    });
    const scene = await sceneRect(page, rect);
    r.sceneRect = { x: scene.x, y: scene.y, width: scene.width, height: scene.height };
    r.stats = await shootAndMeasure(page, scene, path.join(shotsDir, `s${index}.png`));
    r.fps = await sampleFps(page, args.fpsMs);
    // Nivel de calidad, draw calls y triángulos que publica la escena (PerfProbe).
    r.perf = await page.evaluate(() => window.__scenePerf ?? null);

    // Cambio a otro escenario y vuelta: detecta pantalla negra tras remontar la escena.
    const other = (index + 1) % titles.length;
    await selectScenario(page, titles[other], titles);
    await sleep(1200);
    await selectScenario(page, titles[index], titles);
    await settle(page, args.wait);
    const rect2 = await sceneRect(page, (await canvasRect(page)) || rect);
    r.switchBackStats = await shootAndMeasure(page, rect2, path.join(shotsDir, `s${index}-switchback.png`));

    // Luz forense (opcional, informativo).
    const method = await toggleForensic(page);
    await sleep(1200);
    const fStats = await shootAndMeasure(page, rect2, path.join(shotsDir, `s${index}-forense.png`));
    const changed = Math.abs(fStats.mean - r.switchBackStats.mean) > 2 || Math.abs(fStats.std - r.switchBackStats.std) > 2;
    r.forensic = { method, available: method === 'control' || changed, changed, stats: fStats };
  } catch (e) {
    r.error = String(e && e.message ? e.message : e);
  }
  r.consoleErrors = errors.length;
  r.consoleMessages = errors.slice(0, 20);
  await ctx.close();
  return r;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(ROOT, args.out);
  const labelDir = path.join(outDir, args.label);
  const shotsDir = path.join(outDir, 'shots', args.label);
  fs.mkdirSync(labelDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  const titles = scenarioTitles();
  const baselinePath = path.join(outDir, 'before', 'report.json');
  const baseline = args.label === 'after' && fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;

  if (baseline && (baseline.gl ?? 'swiftshader') !== args.gl) {
    console.warn(`AVISO: la base se midió con --gl ${baseline.gl ?? 'swiftshader'} y esta corrida usa --gl ${args.gl}; FPS no comparable.`);
  }
  if (!GL_ARGS[args.gl]) throw new Error(`--gl desconocido: ${args.gl} (use gpu o swiftshader)`);

  const executablePath = findBrowser();
  const browser = await puppeteer.launch({
    executablePath,
    headless: !args.headful,
    args: [...GL_ARGS[args.gl], '--no-first-run', '--hide-scrollbars'],
  });
  const results = [];
  try {
    const indices = args.only ?? titles.map((_, i) => i);
    for (const i of indices) {
      const r = await evalScenario(browser, args, i, titles, shotsDir);
      const base = baseline?.scenarios?.find((b) => b.title === r.title) ?? null;
      r.checks = r.stats ? evaluateScenario(r, { label: args.label, baseline: base }) : [{ id: 'ejecucion', pass: false, value: r.error, threshold: 'sin error' }];
      r.pass = !r.error && r.checks.every((c) => c.pass);
      results.push(r);
      const s = r.stats;
      console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${i} ${r.title}` + (s ? ` | lum ${s.mean} std ${s.std} negro ${s.nearBlackFrac} | canvas ${r.canvasPct}% | fps ${r.fps}${r.perf ? ` (${r.perf.tier}, ${r.perf.calls} draws, ${Math.round(r.perf.triangles / 1000)}k tris)` : ''} | errores ${r.consoleErrors} | forense ${r.forensic?.method}${r.forensic?.changed ? ' (cambia)' : ' (sin cambio)'}` : ` | ERROR ${r.error}`));
      for (const c of r.checks.filter((c) => !c.pass)) console.log(`    x ${c.id}: ${JSON.stringify(c.value)} (umbral ${c.threshold})`);
    }
  } finally {
    await browser.close();
  }

  const report = {
    label: args.label, url: args.url, date: new Date().toISOString(), browser: executablePath,
    gl: args.gl, glRenderer: results.find((r) => r.glRenderer)?.glRenderer ?? null,
    viewport: VIEWPORT, waitMs: args.wait, fpsSampleMs: args.fpsMs, thresholds: THRESHOLDS,
    baseline: baseline ? path.relative(ROOT, baselinePath) : null,
    note: 'FPS headless se reporta, no se usa como umbral (con --gl swiftshader es GPU por software).',
    aggregate: aggregate(results), scenarios: results,
  };
  fs.writeFileSync(path.join(labelDir, 'report.json'), JSON.stringify(report, null, 2));
  const a = report.aggregate;
  console.log(`\n${a.pass ? 'PASS' : 'FAIL'} [${args.label}] lum ${a.meanLuminance} std ${a.meanStd} canvas ${a.meanCanvasPct}% fps ${a.meanFps} errores ${a.totalConsoleErrors}`);
  console.log(`Reporte: ${path.join(labelDir, 'report.json')}\nCapturas: ${shotsDir}`);
  process.exitCode = a.pass ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
