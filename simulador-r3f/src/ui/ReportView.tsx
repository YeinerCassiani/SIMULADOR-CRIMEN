import { createPortal } from 'react-dom';
import type { ReportModel } from '../report';
import { roleLabel } from '../roles';
import { fmtClock } from './logic';
import { MODE_LABEL } from './startLogic';

// Informe de la práctica en formato legible: resultado, EMP/EF, errores con su
// explicación y datos de control. No contiene datos personales: el rol identifica
// la práctica. `ReportPrint` lo replica fuera de la app para imprimir o guardar PDF.
export function ReportView({ m }: { m: ReportModel }) {
  return (
    <article className="report">
      <header className="report-head">
        <p className="report-kicker">Informe de práctica · Simulador de Escena del Crimen</p>
        <h3 className="report-title">{m.caseTitle}</h3>
        <dl className="report-facts">
          <div><dt>Rol inicial</dt><dd>{roleLabel(m.initialRole)}</dd></div>
          <div><dt>Roles que actuaron</dt><dd>{m.roles.map(roleLabel).join(', ')}</dd></div>
          <div><dt>Modo</dt><dd>{MODE_LABEL[m.mode]}</dd></div>
          <div><dt>Inicio</dt><dd>{m.startedAt ? `${new Date(m.startedAt).toLocaleDateString('es-CO')} ${fmtClock(m.startedAt)}` : 'Sin acciones'}</dd></div>
          <div><dt>NUNC</dt><dd className="num">{m.nunc}</dd></div>
          <div><dt>Lugar</dt><dd>{m.location}</dd></div>
        </dl>
      </header>

      <section className="report-sec">
        <h4>Resultado</h4>
        <p className="report-score"><span className="num">{m.score}</span> puntos · {m.grade}{!m.finalized && ' · práctica sin cerrar'}</p>
        <p>{m.verdict}</p>
        <ul className="report-kpis">
          <li><b className="num">{m.delivered} de {m.total}</b> EMP/EF entregados</li>
          <li><b className="num">{m.contaminated}</b> contaminados</li>
          <li><b className="num">{m.offRole}</b> acciones fuera de rol</li>
          <li><b className="num">{m.custodyBreaks}</b> rupturas de cadena de custodia</li>
          <li><b className="num">{m.accessRecords}</b> registros de acceso</li>
        </ul>
      </section>

      <section className="report-sec">
        <h4>EMP/EF</h4>
        <table className="report-table">
          <thead><tr><th scope="col">EMP/EF</th><th scope="col">Pasos</th><th scope="col">Estado</th></tr></thead>
          <tbody>
            {m.evidence.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.id} · {e.name}</th>
                <td className="num">{e.done}/8</td>
                <td>
                  {e.contaminated && <span className="neg">Contaminado: {e.reason || 'causa no registrada'}. </span>}
                  {e.deliveredTo ? `Entregado a ${e.deliveredTo}.` : e.pending.length ? `Pendiente: ${e.pending.join(', ')}.` : 'Completo.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-sec">
        <h4>Errores y alertas</h4>
        {m.mistakes.length === 0
          ? <p>No se registraron errores.</p>
          : (
            <ol className="report-mistakes">
              {m.mistakes.map((x, i) => (
                <li key={i}><span className="num muted">{x.time} · {x.role}</span> {x.message} {x.points !== 0 && <b className="num neg">({x.points})</b>}</li>
              ))}
            </ol>
          )}
      </section>
      <p className="report-note">Informe académico: no reemplaza los formatos oficiales.</p>
    </article>
  );
}

/** Copia del informe fuera de #root: es lo único que se imprime (ver @media print). */
export function ReportPrint({ m }: { m: ReportModel }) {
  return createPortal(<div className="print-root"><ReportView m={m} /></div>, document.body);
}
