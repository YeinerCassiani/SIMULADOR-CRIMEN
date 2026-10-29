#!/usr/bin/env node
// Recorrido de experiencia de uso: hace de estudiante (práctica guiada, relevo,
// cierre e informe) y de docente (PIN, ajustes, editor de casos) en un navegador
// real, captura cada pantalla y falla si un paso no está donde debe o hay errores
// de consola. Sirve para revisar a ojo el flujo y como prueba de humo.
//
// Uso: node scripts/ux-walkthrough.mjs [--url http://localhost:5199] [--out eval/shots/ux] [--headful]
// Requiere el servidor de desarrollo encendido (npm run dev).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = { url: 'http://localhost:5199', out: 'eval/shots/ux', headful: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--url') args.url = process.argv[++i];
  else if (k === '--out') args.out = process.argv[++i];
  else if (k === '--headful') args.headful = true;
}

function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const hit = candidates.find((p) => p && fs.existsSync(p));
  if (!hit) throw new Error('No se encontró Chrome/Edge. Defina CHROME_PATH.');
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.resolve(ROOT, args.out);
fs.mkdirSync(outDir, { recursive: true });

const steps = [];
const errors = [];
let page;

async function shot(name) {
  await sleep(350);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

/** Un paso del recorrido: si falla, se anota y se sigue con el siguiente bloque. */
async function step(name, fn) {
  try {
    await fn();
    steps.push({ name, ok: true });
    console.log(`[OK]   ${name}`);
  } catch (e) {
    steps.push({ name, ok: false, error: e.message });
    console.log(`[FAIL] ${name}: ${e.message}`);
    await shot(`FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}`).catch(() => {});
  }
}

async function click(sel) {
  await page.waitForSelector(sel, { visible: true, timeout: 15000 });
  await page.click(sel);
  await sleep(250);
}

async function text(sel) {
  return page.$eval(sel, (el) => el.textContent.trim());
}

async function expectText(sel, re) {
  await page.waitForSelector(sel, { timeout: 15000 });
  const t = await text(sel);
  if (!re.test(t)) throw new Error(`"${sel}" dice "${t.slice(0, 120)}", se esperaba ${re}`);
}

/** Botón por su texto visible (para los que no tienen atributo propio). */
async function clickText(re) {
  const ok = await page.evaluate((src) => {
    const r = new RegExp(src, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => r.test(x.textContent || '') && !x.disabled);
    if (b) { b.click(); return true; }
    return false;
  }, re.source);
  if (!ok) throw new Error(`no hay botón habilitado con texto ${re}`);
  await sleep(300);
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: !args.headful,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--hide-scrollbars'],
});
page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await step('bienvenida y carga', async () => {
  await page.goto(args.url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('[data-splash-enter]:not([disabled])', { timeout: 60000 });
  await shot('00-bienvenida');
  await click('[data-splash-enter]');
});

await step('inicio: quién usa el simulador', async () => {
  await page.waitForSelector('[data-start-student]', { timeout: 10000 });
  await shot('01-inicio');
});

await step('estudiante: caso, rol y resumen', async () => {
  await click('[data-start-student]');
  await shot('02-caso');
  await click('[data-start-next]');
  // Criminalística: no coordina, así que la ruta mostrará el relevo de rol.
  await click('[data-start-role="criminalistica"]');
  await shot('03-rol');
  await click('[data-start-next]');
  await shot('04-confirmar');
  await click('[data-start-go]');
});

await step('ayuda al empezar', async () => {
  await page.waitForSelector('[data-eval="manual-close"]', { timeout: 10000 });
  await shot('05-ayuda');
  await click('[data-eval="manual-close"]');
});

await step('práctica guiada: siguiente paso visible', async () => {
  await sleep(2500);
  await expectText('[data-next-step]', /equipo de protección/i);
  await shot('06-practica');
});

await step('mostrarme dónde resalta el control', async () => {
  await clickText(/Mostrarme dónde/);
  await sleep(500);
  const flashed = await page.$('[data-global="EPP"].flash');
  if (!flashed) throw new Error('el botón del EPP no quedó resaltado');
  await shot('07-mostrarme-donde');
});

await step('acción con aviso de resultado', async () => {
  await click('[data-global="EPP"]');
  await page.waitForSelector('.feedback', { timeout: 5000 });
  await expectText('.feedback', /EPP/);
  await shot('08-aviso-resultado');
  await click('[data-global="CORDON"]');
});

await step('relevo de rol en vez de bloqueo', async () => {
  await expectText('[data-next-step]', /ruta/i);
  await expectText('[data-next-step]', /Le corresponde a/);
  await click('[data-global="ROUTE"]');
  await page.waitForSelector('[data-relevo-go]', { timeout: 5000 });
  await shot('09-relevo');
  await click('[data-relevo-go]');
  await expectText('.role-chip', /Investigador líder/);
});

await step('pasos de un EMP/EF al tocarlo', async () => {
  await click('.ev-row');
  await page.waitForSelector('[data-step="OBSERVE"]', { timeout: 5000 });
  await shot('10-pasos-emp');
  await click('[data-step="OBSERVE"]');
  const done = await page.$('[data-step="OBSERVE"].is-done');
  if (!done) throw new Error('Observar no quedó marcado como hecho');
});

await step('botones de cámara', async () => {
  await click('.cam-pad .cam-btn');
  await clickText(/Vista general/);
});

await step('cierre e informe imprimible', async () => {
  await click('[data-open="closure"]');
  await clickText(/Confirmar cierre/);
  await page.waitForSelector('[data-report-print]', { timeout: 5000 });
  await expectText('.modal .report', /Errores y alertas/);
  await shot('11-informe');
  const printable = await page.$('body > .print-root .report');
  if (!printable) throw new Error('no está la copia imprimible del informe');
  await page.emulateMediaType('print');
  await shot('12-informe-impresion');
  await page.emulateMediaType('screen');
  await clickText(/^Cerrar$/);
});

await step('docente: crear PIN y ajustes', async () => {
  await click('[data-home]');
  await shot('13-inicio-con-practica');
  await click('[data-start-teacher]');
  await page.type('[data-pin]', '2468');
  await page.type('[data-pin2]', '2468');
  await shot('14-crear-pin');
  await click('[data-pin-go]');
  await page.waitForSelector('[data-mode="evaluacion"]', { timeout: 5000 });
  await shot('15-docente');
});

await step('docente: editor de casos explica lo que falta', async () => {
  await click('[data-case-new]');
  await shot('16-editor');
  await click('[data-case-save]');
  await expectText('.form-errors', /título/);
  await shot('17-editor-faltantes');
});

let studentUrl = '';
await step('docente: evaluación y enlace para estudiantes', async () => {
  await click('.case-editor .start-back');
  await click('[data-mode="evaluacion"]');
  studentUrl = await page.$eval('.link-input', (el) => el.value);
  if (!/#practica=/.test(studentUrl)) throw new Error('el enlace no trae la configuración');
  await shot('18-docente-evaluacion');
  await clickText(/Probar como estudiante/);
});

await step('evaluación: sin pistas ni puntaje, bloqueo explicado', async () => {
  await click('[data-start-student]');
  await click('[data-start-next]');
  await click('[data-start-role="primer_responsable"]');
  await click('[data-start-next]');
  await expectText('.start-summary', /Evaluación/);
  await click('[data-start-go]');
  await click('[data-eval="manual-close"]');
  await sleep(1500);
  if (await page.$('[data-next-step]')) throw new Error('en evaluación aparece el siguiente paso');
  if (/Puntaje/.test(await text('.topbar'))) throw new Error('en evaluación se ve el puntaje');
  await click('.ev-row');
  await click('[data-step="COLLECT"]');
  if (await page.$('[data-relevo-go]')) throw new Error('en evaluación se ofreció el relevo');
  await expectText('.feedback', /no corresponde a las funciones de su rol/);
  await shot('19-evaluacion');
});

await step('enlace del docente en otro equipo', async () => {
  const other = await browser.createBrowserContext();
  const p2 = await other.newPage();
  await p2.setViewport({ width: 1600, height: 900 });
  p2.on('pageerror', (e) => errors.push(e.message));
  const url = new URL(studentUrl);
  url.search = '?nosplash';
  await p2.goto(url.toString(), { waitUntil: 'load' });
  await p2.waitForSelector('[data-start-student]', { timeout: 15000 });
  const body = await p2.$eval('body', (b) => b.textContent);
  if (!/preparó su docente/.test(body)) throw new Error('no indica que la práctica la preparó el docente');
  if (await p2.$('[data-start-teacher]')) throw new Error('desde el enlace se ofrece el espacio docente');
  await p2.screenshot({ path: path.join(outDir, '20-enlace-estudiante.png') });
  await other.close();
});

await step('teléfono: inicio y práctica', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(args.url + '?nosplash', { waitUntil: 'load' });
  await page.waitForSelector('[data-start-student]', { timeout: 15000 });
  await shot('21-movil-inicio');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) throw new Error('hay desplazamiento horizontal en el inicio');
  await click('[data-start-student]');
  await click('[data-start-next]');
  await click('[data-start-next]');
  await click('[data-start-go]');
  await click('[data-eval="manual-close"]');
  await sleep(2000);
  await shot('22-movil-practica');
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.topbar *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className).slice(0, 5));
  if (overflow.length) throw new Error(`la barra superior se sale del ancho: ${overflow.join(', ')}`);
});

await browser.close();
const failed = steps.filter((s) => !s.ok);
const report = { url: args.url, date: new Date().toISOString(), steps, consoleErrors: errors };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${steps.length - failed.length}/${steps.length} pasos bien · errores de consola: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 10).map((e) => '  - ' + e).join('\n'));
console.log(`Capturas: ${outDir}`);
process.exit(failed.length || errors.length ? 1 : 0);
