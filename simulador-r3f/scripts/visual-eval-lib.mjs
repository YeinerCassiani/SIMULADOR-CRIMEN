// Funciones puras del harness de evaluación visual (scripts/visual-eval.mjs).
// Sin dependencias nuevas: decodificación PNG con zlib de Node, estadística de
// luminancia y decisión de umbrales. Probadas en src/__tests__/visualEvalMath.test.ts.
import { inflateSync } from 'node:zlib';

/** Umbrales de aprobación (sección 1 y 7 del spec de la revolución gráfica). */
export const THRESHOLDS = {
  nearBlackLevel: 8, // luminancia < 8/255 cuenta como "casi negro"
  maxNearBlackFrac: 0.85, // por encima: canvas negro
  minStd: 12, // desviación mínima de luminancia: por debajo, imagen plana/negra
  maxConsoleErrors: 0,
  minCanvasPctBefore: 50, // % del viewport ocupado por el canvas (línea base)
  minCanvasPctAfter: 70, // meta del spec
  contrastGain: 1.3, // desv. "after" >= 1.3x la desv. "before" del mismo escenario
};

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decodifica un PNG de 8 bits por canal, no entrelazado (lo que produce Chrome
 * en page.screenshot). Tipos de color soportados: 0 (gris), 2 (RGB), 4 (gris+alfa), 6 (RGBA).
 * Devuelve { width, height, data } con data en RGBA (Uint8Array).
 */
export function decodePng(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) throw new Error('PNG: firma inválida');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const start = pos + 8;
    if (type === 'IHDR') {
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      bitDepth = bytes[start + 8];
      colorType = bytes[start + 9];
      interlace = bytes[start + 12];
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(start, start + len));
    } else if (type === 'IEND') {
      break;
    }
    pos = start + len + 4; // + CRC
  }
  if (bitDepth !== 8) throw new Error(`PNG: profundidad ${bitDepth} no soportada`);
  if (interlace !== 0) throw new Error('PNG: entrelazado no soportado');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`PNG: tipo de color ${colorType} no soportado`);

  const raw = inflateSync(Buffer.concat(idat.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))));
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) v += paeth(a, b, c);
      else if (f !== 0) throw new Error(`PNG: filtro ${f} inválido`);
      out[x] = v & 0xff;
    }
    prev = out;
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const o = i * 4;
    if (channels === 4) { data[o] = px[j]; data[o + 1] = px[j + 1]; data[o + 2] = px[j + 2]; data[o + 3] = px[j + 3]; }
    else if (channels === 3) { data[o] = px[j]; data[o + 1] = px[j + 1]; data[o + 2] = px[j + 2]; data[o + 3] = 255; }
    else if (channels === 2) { data[o] = data[o + 1] = data[o + 2] = px[j]; data[o + 3] = px[j + 1]; }
    else { data[o] = data[o + 1] = data[o + 2] = px[j]; data[o + 3] = 255; }
  }
  return { width, height, data };
}

/** Luma Rec.709 de un píxel sRGB en escala 0..255 (sin linealizar: mide lo que ve el ojo en pantalla). */
export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Estadística de luminancia sobre un buffer RGBA.
 * { mean, std, nearBlackFrac, pixels } con mean/std en escala 0..255.
 * `step` submuestrea píxeles (1 = todos).
 */
export function luminanceStats(rgba, { step = 1, nearBlackLevel = THRESHOLDS.nearBlackLevel } = {}) {
  let n = 0, sum = 0, sumSq = 0, dark = 0;
  const stride = 4 * Math.max(1, Math.floor(step));
  for (let o = 0; o + 3 < rgba.length; o += stride) {
    const l = luma(rgba[o], rgba[o + 1], rgba[o + 2]);
    sum += l;
    sumSq += l * l;
    if (l < nearBlackLevel) dark++;
    n++;
  }
  if (n === 0) return { mean: 0, std: 0, nearBlackFrac: 1, pixels: 0 };
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean: round(mean), std: round(Math.sqrt(variance)), nearBlackFrac: round(dark / n, 4), pixels: n };
}

/** % del viewport cubierto por un rect (recortado al viewport). */
export function canvasCoveragePct(rect, viewport) {
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(viewport.width, rect.x + rect.width), y1 = Math.min(viewport.height, rect.y + rect.height);
  const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return round((100 * area) / (viewport.width * viewport.height), 2);
}

/**
 * Rectángulo de escena libre: el canvas menos las superficies de la UI ancladas a
 * sus bordes (riel, barra superior, inspector, bandeja). Con el visor a pantalla
 * completa, medir el contraste sobre todo el canvas mediría también los paneles
 * opacos; la base (`before`) ya era un canvas sin UI encima, así que la
 * comparación justa es contra este recorte. Un obstáculo cuenta como borde si
 * cubre >= 50 % del lado y toca ese borde (tolerancia 4 px); los ocultos (área 0)
 * se ignoran.
 */
export function freeSceneRect(canvas, obstacles = []) {
  let x0 = canvas.x, y0 = canvas.y, x1 = canvas.x + canvas.width, y1 = canvas.y + canvas.height;
  const tol = 4;
  for (const o of obstacles) {
    if (!o || o.width <= 0 || o.height <= 0) continue;
    const ox1 = o.x + o.width, oy1 = o.y + o.height;
    const tall = o.height >= 0.5 * canvas.height, wide = o.width >= 0.5 * canvas.width;
    if (tall && o.x <= x0 + tol) x0 = Math.max(x0, ox1);
    else if (tall && ox1 >= x1 - tol) x1 = Math.min(x1, o.x);
    else if (wide && o.y <= y0 + tol) y0 = Math.max(y0, oy1);
    else if (wide && oy1 >= y1 - tol) y1 = Math.min(y1, o.y);
  }
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

/** true si la imagen cuenta como "no negra" según los umbrales. */
export function isNotBlack(stats, t = THRESHOLDS) {
  return stats.nearBlackFrac < t.maxNearBlackFrac && stats.std > t.minStd;
}

/**
 * Evalúa un escenario medido contra los umbrales.
 * m: { stats, switchBackStats?, consoleErrors, canvasPct }
 * opts: { label, baseline? } baseline = entrada del mismo escenario en eval/before/report.json.
 * Devuelve una lista de checks { id, pass, value, threshold }.
 */
export function evaluateScenario(m, { label = 'before', baseline = null } = {}, t = THRESHOLDS) {
  const checks = [];
  checks.push({ id: 'no-negro', pass: isNotBlack(m.stats, t), value: { nearBlackFrac: m.stats.nearBlackFrac, std: m.stats.std }, threshold: `nearBlackFrac < ${t.maxNearBlackFrac} y std > ${t.minStd}` });
  if (m.switchBackStats) {
    checks.push({ id: 'no-negro-tras-cambio', pass: isNotBlack(m.switchBackStats, t), value: { nearBlackFrac: m.switchBackStats.nearBlackFrac, std: m.switchBackStats.std }, threshold: `nearBlackFrac < ${t.maxNearBlackFrac} y std > ${t.minStd}` });
  }
  checks.push({ id: 'errores-consola', pass: m.consoleErrors <= t.maxConsoleErrors, value: m.consoleErrors, threshold: `<= ${t.maxConsoleErrors}` });
  const useAfter = label === 'after' && baseline;
  const minPct = useAfter ? t.minCanvasPctAfter : t.minCanvasPctBefore;
  checks.push({ id: 'area-canvas', pass: m.canvasPct >= minPct, value: m.canvasPct, threshold: `>= ${minPct}%` });
  if (useAfter && baseline.stats) {
    const need = round(baseline.stats.std * t.contrastGain);
    checks.push({ id: 'contraste-vs-base', pass: m.stats.std >= need, value: m.stats.std, threshold: `>= ${need} (${t.contrastGain}x base ${baseline.stats.std})` });
  }
  return checks;
}

/** Agregado de varios escenarios: medias y aprobado global. */
export function aggregate(results) {
  const ok = results.filter((r) => r.stats);
  const avg = (f) => (ok.length ? round(ok.reduce((s, r) => s + f(r), 0) / ok.length) : null);
  return {
    scenarios: results.length,
    pass: results.length > 0 && results.every((r) => r.pass),
    failedChecks: results.flatMap((r) => (r.checks || []).filter((c) => !c.pass).map((c) => `${r.index}:${c.id}`)),
    meanLuminance: avg((r) => r.stats.mean),
    meanStd: avg((r) => r.stats.std),
    meanNearBlackFrac: avg((r) => r.stats.nearBlackFrac),
    meanCanvasPct: avg((r) => r.canvasPct),
    meanFps: avg((r) => r.fps ?? 0),
    totalConsoleErrors: results.reduce((s, r) => s + (r.consoleErrors || 0), 0),
  };
}

/** Mide FPS desde una lista de marcas de tiempo de requestAnimationFrame (ms). */
export function fpsFromTimestamps(ts) {
  if (ts.length < 2) return 0;
  return round(((ts.length - 1) * 1000) / (ts[ts.length - 1] - ts[0]), 1);
}

export function round(v, d = 2) {
  const k = 10 ** d;
  return Math.round(v * k) / k;
}
