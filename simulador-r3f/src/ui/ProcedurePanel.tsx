import { Check, ChevronRight, Circle, Scale } from 'lucide-react';
import type { SimState } from '../simulator';
import { buildRoadmap, shortStage, type RoadmapStep } from './roadmap';

// Hoja de ruta del procedimiento: preparación/aseguramiento + ciclo de las etapas
// del EMP/EF, con conteo y fundamento legal de la etapa en curso. Dos vistas del
// mismo cálculo: tira compacta sobre la bandeja y detalle en el inspector.

function StepMark({ s }: { s: RoadmapStep }) {
  if (s.done) return <Check size={14} strokeWidth={2} aria-hidden="true" />;
  if (s.current) return <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />;
  return <Circle size={10} strokeWidth={1.5} aria-hidden="true" />;
}

function stepState(s: RoadmapStep): string {
  return s.done ? 'completa' : s.current ? 'en curso' : 'pendiente';
}

/** Tira compacta: 5 marcas de preparación + 6 del ciclo, etapa en curso y botón de detalle. */
export function ProcedureStrip({ state, onDetail }: { state: SimState; onDetail: () => void }) {
  const r = buildRoadmap(state);
  const seg = (s: RoadmapStep) => (
    <li key={s.id} className={`seg${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`} title={`${s.label}${s.count ? ' ' + s.count : ''}: ${stepState(s)}`}>
      <span className="sr-only">{s.label}{s.count ? ` ${s.count}` : ''}: {stepState(s)}</span>
    </li>
  );
  const prepDone = r.prep.filter((p) => p.done).length;
  const cur = r.cycle.find((c) => c.current);
  return (
    <div className="strip">
      <div className="strip-group">
        <span className="strip-label">Preparación <span className="num">{prepDone}/5</span></span>
        <ol className="segs" aria-label="Preparación y aseguramiento">{r.prep.map(seg)}</ol>
      </div>
      <div className="strip-group">
        <span className="strip-label">Ciclo EMP/EF</span>
        <ol className="segs" aria-label="Ciclo del EMP/EF">{r.cycle.map(seg)}</ol>
      </div>
      <span className="strip-current" title={cur?.label}>{cur ? <>{shortStage(cur.label)} <span className="num muted">{cur.count}</span></> : 'Ciclo completo'}</span>
      <button type="button" className="btn-text strip-more" onClick={onDetail}>Detalle</button>
    </div>
  );
}

/** Detalle completo de la hoja de ruta (inspector, destino "Procedimiento"). */
export function ProcedurePanel({ state }: { state: SimState }) {
  const r = buildRoadmap(state);
  const row = (s: RoadmapStep) => (
    <li key={s.id} className={`rm-row${s.done ? ' is-done' : ''}${s.current ? ' is-current' : ''}`}>
      <span className="rm-mark"><StepMark s={s} /></span>
      <span className="rm-label">{s.label}<span className="sr-only">: {stepState(s)}</span></span>
      {s.count && <span className="rm-count num">{s.count}</span>}
    </li>
  );
  return (
    <section className="section" aria-labelledby="proc-h">
      <h2 id="proc-h" className="section-h">Procedimiento</h2>
      <div className="progress" role="progressbar" aria-label="Avance del procedimiento" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: r.percent + '%' }} />
      </div>
      <p className="meta"><span className="num">{r.percent}%</span> · {r.phase}</p>

      <h3 className="group-h">Preparación y aseguramiento</h3>
      <ol className="roadmap">{r.prep.map(row)}</ol>
      <h3 className="group-h">Ciclo del EMP/EF</h3>
      <ol className="roadmap">{r.cycle.map(row)}</ol>
      <p className="legal"><Scale size={14} strokeWidth={1.5} aria-hidden="true" /><span><b>Fundamento:</b> {r.current.legalBasis}</span></p>
    </section>
  );
}
