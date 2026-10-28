import { Scale, TriangleAlert } from 'lucide-react';
import type { EvidenceItem, EvidenceState, Scenario } from '../types';
import { PACKAGING_LABELS } from '../types';
import { currentStage, nextStage } from '../stages';
import { EVIDENCE_STEPS, stepsDone } from './logic';

// Ficha del EMP/EF seleccionado con el aspecto de un rótulo de cadena de custodia:
// placa numerada, campos en tabla, fila de las 8 marcas y fundamento legal.
export function EvidenceLabelCard({ item, st, scenario }: { item: EvidenceItem; st: EvidenceState; scenario: Scenario }) {
  const done = stepsDone(st);
  const stage = currentStage(st);
  const next = nextStage(st);
  const plate = item.id.split('-').pop();
  const lab = !st.delivered ? null
    : `${st.analyzed ? 'Analizado' : 'Pendiente de análisis'}${st.stored ? ' · almacenado' : st.analyzed ? ' · pendiente de almacenar' : ''}`;

  return (
    <article className="label-card" aria-labelledby="label-card-h" aria-live="polite">
      <header className="label-head">
        <span className="plate num" aria-hidden="true">{plate}</span>
        <div>
          <h3 id="label-card-h" className="label-title">{item.name}</h3>
          <p className="meta">Rótulo de cadena de custodia · <span className="num">{item.id}</span></p>
        </div>
      </header>

      {st.contaminated && (
        <p className="alert-neg"><TriangleAlert size={14} strokeWidth={1.5} aria-hidden="true" />
          <span><b>Contaminado.</b>{st.contaminationReason ? ` ${st.contaminationReason}` : ''}</span></p>
      )}

      <table className="label-table">
        <tbody>
          <tr><th scope="row">NUNC / caso</th><td className="num">{scenario.nunc}</td></tr>
          <tr><th scope="row">Descripción</th><td>{item.description}</td></tr>
          <tr><th scope="row">Naturaleza</th><td>{item.nature}</td></tr>
          <tr><th scope="row">Lugar</th><td>{scenario.sceneLocation}</td></tr>
          <tr><th scope="row">Embalaje</th><td>{st.package ? PACKAGING_LABELS[st.package] : <span className="dash">Sin embalar</span>}</td></tr>
          <tr><th scope="row">Entregado a</th><td>{st.deliveredTo ?? <span className="dash">Sin entregar</span>}</td></tr>
          {lab && <tr><th scope="row">Laboratorio</th><td>{lab}</td></tr>}
          <tr><th scope="row">Etapa actual</th><td>{stage.label}</td></tr>
          {next && <tr><th scope="row">Siguiente</th><td>{next.label}</td></tr>}
        </tbody>
      </table>

      <div className="steps-head">
        <span>Marcas del ciclo</span>
        <span className="num">{done} de 8</span>
      </div>
      <ol className="steps" aria-label={`Marcas del ciclo: ${done} de 8 cumplidas`}>
        {EVIDENCE_STEPS.map((p) => (
          <li key={p.key} className={`step${st[p.key] ? ' is-done' : ''}`} title={`${p.label}: ${st[p.key] ? 'hecho' : 'pendiente'}`}>
            <span className="step-bar" aria-hidden="true" />
            <span className="step-label">{p.label}<span className="sr-only">: {st[p.key] ? 'hecho' : 'pendiente'}</span></span>
          </li>
        ))}
      </ol>

      <p className="legal"><Scale size={14} strokeWidth={1.5} aria-hidden="true" /><span><b>Fundamento:</b> {stage.legalBasis}</span></p>
    </article>
  );
}
