// Texturas generadas en runtime con CanvasTexture: sin red, sin fuentes externas.
// Se cachean por clave (una sola textura compartida por todas las instancias) y
// no se liberan al remontar el escenario: son pocas y pequeñas (< 1 MB en total).
import * as THREE from 'three';
import { mulberry32 } from './random';
import { ACCENT } from './presentation';

const cache = new Map<string, THREE.CanvasTexture>();
// Pila tipográfica del sistema (sin descarga). Public Sans puede no estar lista
// cuando se dibuja el canvas; la pila del sistema garantiza un resultado estable.
const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Texto impreso en la cinta (un período de la textura). */
export const TAPE_TEXT = 'NO PASE · CRIMINALÍSTICA · ';
/** Ancho de cinta (m) y largo de un período de la textura (m). */
export const TAPE_WIDTH = 0.075;
export const TAPE_PERIOD = TAPE_WIDTH * 16;

/** Cinta amarilla con texto negro repetido (se repite en U con RepeatWrapping). */
export function tapeTexture(): THREE.CanvasTexture {
  const t = make('tape', 1024, 64, (g) => {
    g.fillStyle = ACCENT; g.fillRect(0, 0, 1024, 64);
    g.fillStyle = '#111111'; g.fillRect(0, 0, 1024, 5); g.fillRect(0, 59, 1024, 5);
    g.font = `900 34px ${FONT}`;
    g.textBaseline = 'middle';
    // Ajusta el tracking para que el texto llene exactamente el período.
    const text = TAPE_TEXT;
    const natural = g.measureText(text).width;
    const scale = Math.min(1, 1000 / natural);
    g.save(); g.translate(12, 33); g.scale(scale, 1);
    g.fillText(text, 0, 0);
    g.restore();
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Cara de la placa A-frame: amarilla con el número en negro. */
export function plateTexture(num: string): THREE.CanvasTexture {
  return make(`plate:${num}`, 256, 256, (g) => {
    g.fillStyle = ACCENT; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#111111'; g.fillRect(0, 0, 256, 26); // franja superior impresa
    g.strokeStyle = '#111111'; g.lineWidth = 6; g.strokeRect(10, 36, 236, 210);
    const size = num.length <= 1 ? 170 : num.length === 2 ? 140 : num.length === 3 ? 100 : 78;
    g.font = `900 ${size}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(num, 128, 146);
  });
}

/** Regla fotográfica: bandas de 1 cm en blanco y negro con marcas. */
export function rulerTexture(): THREE.CanvasTexture {
  const t = make('ruler', 512, 32, (g) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 512, 32);
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) { g.fillStyle = '#111111'; g.fillRect(i * 25.6, 0, 25.6, 14); }
      g.fillStyle = '#111111';
      g.fillRect(i * 25.6, 0, 2, i % 5 === 0 ? 30 : 20);
    }
    g.fillStyle = ACCENT; g.fillRect(0, 26, 512, 6);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * Mancha procedural en escala de grises con alfa (blanco = fluorescencia).
 * Masa principal irregular + gotas satélite, con borde suave.
 */
export function stainTexture(seed: number): THREE.CanvasTexture {
  return make(`stain:${seed % 6}`, 256, 256, (g) => {
    const rnd = mulberry32(seed % 6 + 11);
    g.clearRect(0, 0, 256, 256);
    const blob = (cx: number, cy: number, r: number, a: number) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(0.6, `rgba(255,255,255,${a * 0.75})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    };
    for (let i = 0; i < 9; i++) blob(128 + (rnd() - 0.5) * 70, 128 + (rnd() - 0.5) * 70, 30 + rnd() * 40, 0.55 + rnd() * 0.4);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = 70 + rnd() * 45;
      blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 4 + rnd() * 9, 0.8);
    }
  }, false);
}

/** Hoja impresa: renglones de texto simulados (documentos, cuadernos). */
export function paperTexture(): THREE.CanvasTexture {
  return make('paper', 256, 256, (g) => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(7);
    g.fillStyle = '#5d5a53';
    for (let y = 30; y < 236; y += 14) {
      const len = 120 + rnd() * 90;
      g.fillRect(24, y, len, 3);
    }
    g.fillStyle = '#2c3e66'; g.fillRect(24, 14, 90, 6);
  });
}
