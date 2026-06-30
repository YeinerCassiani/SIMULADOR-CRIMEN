import type { SimState } from '../simulator';
import { phaseLabel, progressPercent } from '../simulator';
import { STAGES, currentStage } from '../stages';

// Hoja de ruta del procedimiento siempre visible: preparación/aseguramiento +
// ciclo de las etapas del EMP/EF, con conteo y fundamento legal de la etapa en curso.
export function ProcedurePanel({ state }: { state: SimState }) {
  const items = state.scenario.evidenceItems;
  const total = items.length;
  const itemStages = STAGES.filter((s) => s.order > 0);
  const metCount = (order: number) => items.filter((e) => currentStage(state.evidence[e.id]).order >= order).length;

  const prep: { label: string; done: boolean }[] = [
    { label: 'EPP', done: state.globals.epp },
    { label: 'Acordonar', done: state.globals.cordon },
    { label: 'Ruta de ingreso/salida', done: state.globals.route },
    { label: 'Método de búsqueda', done: state.globals.searchMethod },
    { label: 'Entrega formal del lugar', done: state.globals.handover },
  ];

  // Etapa colectiva "en curso": la primera del ciclo no completada en todos los EMP/EF.
  const currentDef = itemStages.find((s) => metCount(s.order) < total) ?? itemStages[itemStages.length - 1];

  return (
    <>
      <div className="section-title">Procedimiento</div>
      <div className="progress" role="progressbar" aria-valuenow={progressPercent(state)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: progressPercent(state) + '%' }} />
      </div>
      <div className="small" style={{ marginBottom: 6 }}>{phaseLabel(state)}</div>

      <div className="roadmap">
        <div className="roadmap-group">Preparación / aseguramiento</div>
        {prep.map((p) => (
          <div key={p.label} className={`roadmap-row ${p.done ? 'done' : ''}`}>
            <span className="rm-mark">{p.done ? '✓' : '○'}</span>
            <span className="rm-label">{p.label}</span>
          </div>
        ))}
        <div className="roadmap-group">Ciclo del EMP/EF</div>
        {itemStages.map((s) => {
          const n = metCount(s.order);
          const isCurrent = s.id === currentDef.id && n < total;
          return (
            <div key={s.id} className={`roadmap-row ${n >= total ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
              <span className="rm-mark">{n >= total ? '✓' : isCurrent ? '→' : '○'}</span>
              <span className="rm-label">{s.label}</span>
              <span className="rm-count">{n}/{total}</span>
            </div>
          );
        })}
      </div>
      <p className="legal-note" style={{ marginTop: 8 }}><b>Fundamento:</b> {currentDef.legalBasis}</p>
    </>
  );
}
