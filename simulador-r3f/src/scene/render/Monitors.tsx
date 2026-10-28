// Monitores del render: calidad automática y sonda de rendimiento.
import { memo, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, type PerformanceMonitorApi } from '@react-three/drei';
import type { QualityTier } from '../contracts';
import { initialMemory, stepQuality, type QualityMemory } from './quality';

/**
 * Calidad automática: drei PerformanceMonitor mide y stepQuality() decide.
 *
 * No se usa flipflops/onFallback: en drei 10.7 `flipped` cuenta CADA incline o
 * decline (PerformanceMonitor.js: `api.flipped++` en ambos), no solo los cambios de
 * sentido; una máquina sana a 60 fps encadena inclines cada 2.5 s y caería a 'baja'.
 * La anti-oscilación la hace stepQuality (histéresis + veto tras 2 bajadas).
 * Tampoco AdaptiveDpr: cada regress redimensiona el canvas y los render targets del
 * composer y de N8AO al empezar y terminar de orbitar (tirones). El DPR sale del nivel.
 */
export const QualityMonitor = memo(function QualityMonitor({ tier, onTier }: { tier: QualityTier; onTier: (t: QualityTier) => void }) {
  const mem = useRef<QualityMemory>(initialMemory(tier));
  // Si el nivel cambió desde fuera (p. ej. el usuario volvió a 'auto'), se resincroniza.
  useEffect(() => {
    if (mem.current.tier !== tier) mem.current = { ...mem.current, tier };
  }, [tier]);

  const decide = (api: PerformanceMonitorApi) => {
    const samples = api.averages.length ? api.averages : [api.fps];
    const next = stepQuality(mem.current, samples);
    mem.current = next;
    if (next.tier !== tier) onTier(next.tier);
  };
  return <PerformanceMonitor onIncline={decide} onDecline={decide} />;
});

declare global {
  interface Window {
    /** Métricas del render para ?perf y el harness visual-eval. */
    __scenePerf?: { tier: QualityTier; dpr: number; calls: number; triangles: number; programs: number; fps: number };
  }
}

/**
 * Sonda de rendimiento: draw calls y triángulos REALES del frame. El composer llama
 * a gl.render varias veces por frame y info.autoReset los pondría a cero en cada una,
 * así que se resetea a mano al inicio del frame (prioridad -10) y se lee al final
 * (prioridad 100, después del composer). Publica window.__scenePerf cada 30 frames
 * y, con ?perf, lo pinta en un rótulo fijo.
 */
export const PerfProbe = memo(function PerfProbe({ tier, show }: { tier: QualityTier; show: boolean }) {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  const t0 = useRef(performance.now());
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { el.current?.remove(); el.current = null; }, []);

  useFrame(() => {
    gl.info.autoReset = false;
    gl.info.reset();
  }, -10);

  useFrame(() => {
    if (++frame.current % 30) return;
    const now = performance.now();
    const fps = Math.round((30 / (now - t0.current)) * 1000);
    t0.current = now;
    const perf = {
      tier,
      dpr: gl.getPixelRatio(),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      programs: gl.info.programs?.length ?? 0,
      fps,
    };
    window.__scenePerf = perf;
    if (!show) return;
    if (!el.current) {
      el.current = document.createElement('div');
      el.current.setAttribute('data-scene-perf', '');
      Object.assign(el.current.style, {
        position: 'fixed', left: '8px', bottom: '8px', zIndex: '9999', pointerEvents: 'none',
        font: '11px/1.4 ui-monospace, monospace', color: '#f2c230', background: 'rgba(19,18,23,.85)',
        padding: '4px 8px', borderRadius: '6px', fontVariantNumeric: 'tabular-nums',
      });
      document.body.appendChild(el.current);
    }
    el.current.textContent = `${perf.fps} fps · ${perf.tier} · dpr ${perf.dpr.toFixed(2)} · ${perf.calls} draws · ${(perf.triangles / 1000).toFixed(0)}k tris · ${perf.programs} prog`;
  }, 100);

  return null;
});
