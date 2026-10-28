/// <reference types="node" />
// Gate de las funciones puras del harness de evaluación visual
// (scripts/visual-eval-lib.mjs): decodificación PNG, luminancia, umbrales.
import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import {
  THRESHOLDS, aggregate, canvasCoveragePct, decodePng, freeSceneRect, evaluateScenario, fpsFromTimestamps, isNotBlack, luma, luminanceStats,
} from '../../scripts/visual-eval-lib.mjs';

/** Construye un PNG mínimo (sin CRC válido: el decodificador no lo verifica). */
function makePng(width: number, height: number, colorType: number, rows: number[][], filters?: number[]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  const raw = Buffer.concat(rows.map((r, y) => Buffer.from([filters?.[y] ?? 0, ...r])));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgba = (...px: number[][]) => new Uint8Array(px.flat());

describe('decodePng', () => {
  it('decodifica RGBA sin filtro', () => {
    const img = decodePng(makePng(2, 1, 6, [[255, 0, 0, 255, 0, 0, 255, 128]]));
    expect(img.width).toBe(2);
    expect([...img.data]).toEqual([255, 0, 0, 255, 0, 0, 255, 128]);
  });
  it('expande RGB a RGBA y aplica filtros Sub y Up', () => {
    // Fila 0 con Sub: deltas (10,20,30) + (5,5,5) -> píxel 2 = (15,25,35). Fila 1 con Up: +1 sobre fila 0.
    const img = decodePng(makePng(2, 2, 2, [[10, 20, 30, 5, 5, 5], [1, 1, 1, 1, 1, 1]], [1, 2]));
    expect([...img.data]).toEqual([10, 20, 30, 255, 15, 25, 35, 255, 11, 21, 31, 255, 16, 26, 36, 255]);
  });
  it('rechaza firmas inválidas', () => {
    expect(() => decodePng(Buffer.from('nope-not-a-png'))).toThrow(/firma/);
  });
});

describe('luminancia', () => {
  it('luma Rec.709: blanco 255, negro 0, verde pesa más que azul', () => {
    expect(luma(255, 255, 255)).toBeCloseTo(255, 6);
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(0, 0, 255));
  });
  it('imagen uniforme: std 0', () => {
    const s = luminanceStats(rgba([100, 100, 100, 255], [100, 100, 100, 255]));
    expect(s).toMatchObject({ mean: 100, std: 0, nearBlackFrac: 0, pixels: 2 });
  });
  it('mitad negro, mitad blanco: media 127.5, std 127.5, casi-negro 0.5', () => {
    const s = luminanceStats(rgba([0, 0, 0, 255], [255, 255, 255, 255]));
    expect(s.mean).toBeCloseTo(127.5, 1);
    expect(s.std).toBeCloseTo(127.5, 1);
    expect(s.nearBlackFrac).toBe(0.5);
  });
  it('casi-negro usa < 8/255', () => {
    const s = luminanceStats(rgba([7, 7, 7, 255], [8, 8, 8, 255]));
    expect(s.nearBlackFrac).toBe(0.5);
  });
  it('buffer vacío cuenta como negro', () => {
    expect(luminanceStats(new Uint8Array(0)).nearBlackFrac).toBe(1);
  });
});

describe('umbrales', () => {
  const lit = { mean: 90, std: 40, nearBlackFrac: 0.1, pixels: 10 };
  const black = { mean: 2, std: 3, nearBlackFrac: 0.97, pixels: 10 };

  it('isNotBlack exige fracción casi-negra < 0.85 y std > 12', () => {
    expect(isNotBlack(lit)).toBe(true);
    expect(isNotBlack(black)).toBe(false);
    expect(isNotBlack({ ...lit, std: 12 })).toBe(false);
    expect(isNotBlack({ ...lit, nearBlackFrac: 0.85 })).toBe(false);
  });

  it('before: canvas >= 50%, 0 errores, sin chequeo de contraste', () => {
    const checks = evaluateScenario({ stats: lit, consoleErrors: 0, canvasPct: 55 }, { label: 'before' });
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks.find((c) => c.id === 'contraste-vs-base')).toBeUndefined();
    const bad = evaluateScenario({ stats: lit, consoleErrors: 1, canvasPct: 40 }, { label: 'before' });
    expect(bad.filter((c) => !c.pass).map((c) => c.id).sort()).toEqual(['area-canvas', 'errores-consola']);
  });

  it('after con base: canvas >= 70% y std >= 1.3x la base', () => {
    const baseline = { stats: { ...lit, std: 20 } };
    const ok = evaluateScenario({ stats: { ...lit, std: 26 }, consoleErrors: 0, canvasPct: 72 }, { label: 'after', baseline });
    expect(ok.every((c) => c.pass)).toBe(true);
    const low = evaluateScenario({ stats: { ...lit, std: 25.9 }, consoleErrors: 0, canvasPct: 60 }, { label: 'after', baseline });
    expect(low.filter((c) => !c.pass).map((c) => c.id).sort()).toEqual(['area-canvas', 'contraste-vs-base']);
  });

  it('after sin base cae a los umbrales de before', () => {
    const checks = evaluateScenario({ stats: lit, consoleErrors: 0, canvasPct: 55 }, { label: 'after', baseline: null });
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it('pantalla negra al volver de otro escenario falla', () => {
    const checks = evaluateScenario({ stats: lit, switchBackStats: black, consoleErrors: 0, canvasPct: 60 });
    expect(checks.find((c) => c.id === 'no-negro-tras-cambio')?.pass).toBe(false);
  });

  it('constantes del spec', () => {
    expect(THRESHOLDS).toMatchObject({ maxNearBlackFrac: 0.85, minStd: 12, minCanvasPctBefore: 50, minCanvasPctAfter: 70, contrastGain: 1.3 });
  });
});

describe('utilidades', () => {
  it('canvasCoveragePct recorta al viewport', () => {
    const vp = { width: 1600, height: 900 };
    expect(canvasCoveragePct({ x: 0, y: 0, width: 800, height: 900 }, vp)).toBe(50);
    expect(canvasCoveragePct({ x: -100, y: 0, width: 1800, height: 900 }, vp)).toBe(100);
  });
  it('fpsFromTimestamps', () => {
    expect(fpsFromTimestamps([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])).toBe(10);
    expect(fpsFromTimestamps([5])).toBe(0);
  });
  it('aggregate: pasa solo si todos pasan y lista los checks fallidos', () => {
    const base = { stats: { mean: 50, std: 20, nearBlackFrac: 0.1 }, canvasPct: 55, fps: 30, consoleErrors: 0 };
    const a = aggregate([
      { ...base, index: 0, pass: true, checks: [{ id: 'x', pass: true }] },
      { ...base, index: 1, pass: false, consoleErrors: 2, checks: [{ id: 'errores-consola', pass: false }] },
    ]);
    expect(a.pass).toBe(false);
    expect(a.failedChecks).toEqual(['1:errores-consola']);
    expect(a.totalConsoleErrors).toBe(2);
    expect(a.meanStd).toBe(20);
  });
});

describe('freeSceneRect (recorte de escena sin paneles de la UI)', () => {
  const canvas = { x: 0, y: 0, width: 1600, height: 900 };
  // Composición real a 1600x900: riel 56, barra 58, inspector 360, bandeja 160.
  const rail = { x: 0, y: 0, width: 56, height: 900 };
  const top = { x: 56, y: 0, width: 1544, height: 58 };
  const insp = { x: 1240, y: 58, width: 360, height: 842 };
  const dock = { x: 56, y: 740, width: 1184, height: 160 };

  it('descuenta riel, barra superior, inspector y bandeja', () => {
    expect(freeSceneRect(canvas, [rail, top, insp, dock])).toEqual({ x: 56, y: 58, width: 1184, height: 682 });
  });

  it('sin obstáculos devuelve el canvas entero; los ocultos (área 0) no cuentan', () => {
    expect(freeSceneRect(canvas, [])).toEqual(canvas);
    expect(freeSceneRect(canvas, [{ x: 0, y: 0, width: 0, height: 0 }])).toEqual(canvas);
  });

  it('ignora piezas pequeñas que no cubren medio borde (tooltip, chip)', () => {
    expect(freeSceneRect(canvas, [{ x: 0, y: 0, width: 200, height: 40 }])).toEqual(canvas);
  });

  it('nunca da ancho/alto negativos', () => {
    const r = freeSceneRect(canvas, [{ x: 0, y: 0, width: 1600, height: 900 }]);
    expect(r.width).toBeGreaterThanOrEqual(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
  });
});
