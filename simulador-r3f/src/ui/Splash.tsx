// Pantalla de bienvenida: marca del simulador y barra de carga real. Cubre la app
// mientras la escena 3D (montada detrás) descarga modelos, texturas y HDRI; el
// progreso sale del gestor de carga de three (drei useProgress) y la decisión de
// "lista" de splashLogic.ts (pura y probada). Entrar con el botón o con Enter.
import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { ArrowRight } from 'lucide-react';
import { SplashLogo } from './SplashLogo';
import { nextPct, splashStatus, statusText, type SplashStatus } from './splashLogic';

const TAPE = 'NO PASE · CRIMINALÍSTICA · ';

export function Splash({ onEnter }: { onEnter: () => void }) {
  const active = useProgress((s) => s.active);
  const loaded = useProgress((s) => s.loaded);
  const total = useProgress((s) => s.total);
  const item = useProgress((s) => s.item);
  const errors = useProgress((s) => s.errors.length);

  const [status, setStatus] = useState<SplashStatus>('loading');
  const [pct, setPct] = useState(0);
  const [fontsReady, setFontsReady] = useState(() => typeof document === 'undefined' || !document.fonts);
  const [leaving, setLeaving] = useState(false);
  const t0 = useRef(0);
  const idleSince = useRef<number | null>(null);
  const live = useRef({ active, loaded, total, fontsReady });
  useEffect(() => { live.current = { active, loaded, total, fontsReady }; });
  const enterBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setFontsReady(true); };
    document.fonts?.ready.then(done, done);
    return () => { alive = false; };
  }, []);

  // Reloj de 100 ms: el tiempo sin cargas activas no genera eventos propios.
  useEffect(() => {
    t0.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const { active: a, loaded: l, total: t, fontsReady: f } = live.current;
      if (a) idleSince.current = null;
      else if (idleSince.current === null) idleSince.current = now;
      const snap = { active: a, loaded: l, total: t, fontsReady: f, elapsedMs: now - t0.current, idleMs: idleSince.current === null ? 0 : now - idleSince.current };
      const st = splashStatus(snap);
      setStatus(st);
      setPct((p) => nextPct(p, snap, st));
      if (st !== 'loading') {
        // Traza para la eval visual y para medir tiempos de carga reales.
        (window as unknown as { __splash?: object }).__splash ??= { status: st, readyMs: Math.round(snap.elapsedMs), items: t, errors: useProgress.getState().errors.length };
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const canEnter = status !== 'loading';
  useEffect(() => { if (canEnter) enterBtn.current?.focus(); }, [canEnter]);

  const enter = () => {
    if (!canEnter || leaving) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { onEnter(); return; }
    setLeaving(true);
    setTimeout(onEnter, 280);
  };

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="splash-title"
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) enter(); }} tabIndex={-1}>
      <div className="splash-body">
        <SplashLogo size={184} />
        <h1 id="splash-title" className="splash-title">Simulador de Escena del Crimen</h1>
        <p className="splash-sub">Procesamiento del lugar de los hechos y cadena de custodia</p>
        <p className="splash-meta">Ley 906 de 2004 · Manual Único de Policía Judicial</p>

        <div className="splash-load">
          <div className="splash-bar" role="progressbar" aria-label="Carga de la escena" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="splash-bar-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className="splash-status" aria-live="polite">
            <span>{statusText(status, item, { loaded, total })}</span>
            <span className="splash-pct">{pct}%</span>
          </div>
          {errors > 0 && (
            <p className="splash-note">{errors === 1 ? '1 recurso no cargó' : `${errors} recursos no cargaron`}; se usan modelos de respaldo.</p>
          )}
        </div>

        <button ref={enterBtn} type="button" className="btn-primary splash-enter" data-splash-enter disabled={!canEnter} onClick={enter}>
          Entrar a la escena <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="splash-tape" aria-hidden="true">
        <div className="splash-tape-track">{TAPE.repeat(12)}</div>
      </div>
      <p className="splash-credit">Modelos, texturas e iluminación CC0 de Poly Haven</p>
    </div>
  );
}
