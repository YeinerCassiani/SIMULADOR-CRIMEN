import { useState, type Dispatch, type ReactNode } from 'react';
import type { Action, SimState } from '../simulator';
import type { AccessRecord, CustodyRecord, LabelRecord, PackagingId, SalvamentoRecord, Scenario } from '../types';
import { PACKAGING_LABELS, LAB_DESTINATIONS } from '../types';
import { roleLabel } from '../roles';
import { buildReport, downloadText, validateScenario } from '../report';

function ModalShell({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PackageModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const modal = state.modal!;
  const item = state.scenario.evidenceItems.find((e) => e.id === (modal as { evidenceId: string }).evidenceId)!;
  const [choice, setChoice] = useState('');
  return (
    <ModalShell title="Seleccionar embalaje" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="small">Seleccione el embalaje o contenedor que usted considere adecuado para el EMP/EF. El sistema no mostrará la opción correcta durante la actividad.</p>
      <label>EMP/EF seleccionado</label>
      <input readOnly value={`${item.id} - ${item.name}`} />
      <label>Tipo de embalaje</label>
      <select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Seleccione una opción</option>
        {Object.entries(PACKAGING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => {
          if (!choice) { alert('Seleccione un tipo de embalaje.'); return; }
          dispatch({ type: 'SAVE_PACKAGE', choice: choice as PackagingId });
        }}>Guardar embalaje</button>
      </div>
    </ModalShell>
  );
}

const EMPTY_LABEL: LabelRecord = { nunc: '', evidenceId: '', description: '', date: '', time: '', location: '', collectedBy: '', packaging: '', obs: '' };

function LabelModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [f, setF] = useState<LabelRecord>(EMPTY_LABEL);
  const upd = (k: keyof LabelRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <ModalShell title="Diligenciamiento de rótulo básico" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="small">Complete las casillas del rótulo. El puntaje dependerá del diligenciamiento. No se muestra la respuesta correcta durante la práctica.</p>
      <div className="form-grid">
        <div><label>NUNC / Caso</label><input value={f.nunc} onChange={upd('nunc')} /></div>
        <div><label>ID EMP/EF</label><input value={f.evidenceId} onChange={upd('evidenceId')} /></div>
        <div><label>Descripción breve</label><input value={f.description} onChange={upd('description')} /></div>
        <div><label>Fecha de recolección</label><input type="date" value={f.date} onChange={upd('date')} /></div>
        <div><label>Hora de recolección</label><input type="time" value={f.time} onChange={upd('time')} /></div>
        <div><label>Lugar de hallazgo</label><input value={f.location} onChange={upd('location')} /></div>
        <div><label>Recolectado por</label><input value={f.collectedBy} onChange={upd('collectedBy')} /></div>
        <div><label>Tipo de embalaje</label><input value={f.packaging} onChange={upd('packaging')} /></div>
        <div className="full"><label>Observaciones</label><textarea value={f.obs} onChange={upd('obs')} placeholder="Datos relevantes del estado del EMP/EF o del contenedor" /></div>
      </div>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => dispatch({ type: 'SAVE_LABEL', form: f })}>Guardar rótulo</button>
      </div>
    </ModalShell>
  );
}

const EMPTY_CUSTODY: CustodyRecord = { evidenceId: '', evidenceName: '', nunc: '', idText: '', date: '', time: '', from: '', to: '', purpose: '', container: '', description: '', obs: '' };

function CustodyModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const modal = state.modal!;
  const item = state.scenario.evidenceItems.find((e) => e.id === (modal as { evidenceId: string }).evidenceId)!;
  const [r, setR] = useState<CustodyRecord>({ ...EMPTY_CUSTODY, evidenceId: item.id, evidenceName: item.name });
  const upd = (k: keyof CustodyRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setR({ ...r, [k]: e.target.value });
  return (
    <ModalShell title="Registro básico de cadena de custodia" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="small">Complete las casillas mínimas del registro. El sistema califica si el diligenciamiento es suficiente y coherente con la actividad realizada.</p>
      <div className="form-grid">
        <div><label>NUNC / Caso</label><input value={r.nunc} onChange={upd('nunc')} /></div>
        <div><label>ID EMP/EF</label><input value={r.idText} onChange={upd('idText')} /></div>
        <div><label>Fecha</label><input type="date" value={r.date} onChange={upd('date')} /></div>
        <div><label>Hora</label><input type="time" value={r.time} onChange={upd('time')} /></div>
        <div><label>Quien entrega</label><input value={r.from} onChange={upd('from')} /></div>
        <div><label>Quien recibe</label><input value={r.to} onChange={upd('to')} /></div>
        <div><label>Destino o propósito</label><input value={r.purpose} onChange={upd('purpose')} /></div>
        <div><label>Estado del contenedor</label><input value={r.container} onChange={upd('container')} /></div>
        <div className="full"><label>Descripción del EMP/EF y embalaje</label><textarea value={r.description} onChange={upd('description')} /></div>
        <div className="full"><label>Observaciones</label><textarea value={r.obs} onChange={upd('obs')} /></div>
      </div>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => dispatch({ type: 'SAVE_CUSTODY', record: r })}>Guardar registro</button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const modal = state.modal!;
  if (modal.kind !== 'confirm') return null;
  const item = state.scenario.evidenceItems.find((e) => e.id === modal.evidenceId);
  return (
    <ModalShell title="Antes de continuar" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="small">Esta acción sobre <b>{item?.id} · {item?.name}</b> tiene consecuencias:</p>
      <ul className="warn-list">
        {modal.warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="bad" onClick={() => { dispatch({ type: 'CLOSE_MODAL' }); dispatch({ type: 'APPLY_TOOL', id: modal.evidenceId }); }}>Proceder de todos modos</button>
      </div>
    </ModalShell>
  );
}

function DeliverModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const modal = state.modal!;
  const item = state.scenario.evidenceItems.find((e) => e.id === (modal as { evidenceId: string }).evidenceId)!;
  const [choice, setChoice] = useState('');
  return (
    <ModalShell title="Entrega de EMP/EF a laboratorio" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="small">Seleccione el laboratorio o destino al que corresponde el EMP/EF según su naturaleza. El sistema no muestra la respuesta correcta durante la actividad.</p>
      <label>EMP/EF a entregar</label>
      <input readOnly value={`${item.id} - ${item.name} (${item.nature})`} />
      <label>Destino</label>
      <select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Seleccione un destino</option>
        {LAB_DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => {
          if (!choice) { alert('Seleccione un destino.'); return; }
          dispatch({ type: 'SAVE_DELIVER', destination: choice });
        }}>Entregar</button>
      </div>
    </ModalShell>
  );
}

function ClosureModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const items = state.scenario.evidenceItems;
  const total = items.length;
  const delivered = items.filter((e) => state.evidence[e.id].delivered).length;
  const pending = total - delivered;
  const contaminated = items.filter((e) => state.evidence[e.id].contaminated).length;
  return (
    <ModalShell title="Cierre y liberación de la escena" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="small">Revisión final, inventario y liberación formal del lugar (Sección 9, regla 10; cierre documentado de la inspección).</p>
      <ul className="warn-list" style={{ color: '#cdd8ec' }}>
        <li>EMP/EF totales: <b>{total}</b></li>
        <li>Entregados a laboratorio/almacén: <b>{delivered}</b></li>
        <li>Pendientes de entrega: <b>{pending}</b></li>
        <li>Con alteración/contaminación: <b>{contaminated}</b></li>
      </ul>
      {pending > 0 && <p className="legal-note">Aún hay EMP/EF sin entregar: el cierre quedará con observaciones y penalización.</p>}
      <p className="small">Al confirmar, se registra la revisión final, el estado de condiciones y la devolución/liberación del lugar al responsable.</p>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => dispatch({ type: 'FINALIZE' })}>Confirmar cierre y finalizar</button>
      </div>
    </ModalShell>
  );
}

function ManualsModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <ModalShell title="Marco normativo" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="small">Fuentes que fundamentan el procedimiento del simulador (consulta de referencia).</p>
      <div className="manual-section">
        <h3>Ley 906 de 2004 — Código de Procedimiento Penal</h3>
        <ul className="small">
          <li><b>Art. 216:</b> aseguramiento, embalaje y custodia para evitar alteración o suplantación del EMP/EF.</li>
          <li><b>Art. 254:</b> factores de la cadena de custodia (identidad, estado original, recolección, preservación, embalaje, envío, lugares/fechas y registro de cada custodio).</li>
          <li><b>Art. 255:</b> responsabilidad del servidor que entra en contacto con el EMP/EF.</li>
        </ul>
      </div>
      <div className="manual-section">
        <h3>Manuales institucionales</h3>
        <ul className="small">
          <li><b>MUPJ-3</b> — Manual Único de Policía Judicial, v3: alcance de la policía judicial, actos urgentes, inspección del lugar y de cadáver, dirección funcional del fiscal, roles y límites.</li>
          <li><b>MC-FGN</b> — Manual Integrado de Criminalística (FGN): criminalística de campo, lofoscopia, fotografía, balística, biología/genética, informática, explosivos, automotores.</li>
          <li><b>MSCC-2018</b> — Manual del Sistema de Cadena de Custodia, v4: hallazgo, recolección, embalaje, rotulado, transporte, análisis, almacenamiento, continuidad y registro.</li>
        </ul>
      </div>
      <p className="notice">Criterio de prevalencia: ante contradicción prevalece la regla vigente de superior jerarquía o el procedimiento institucional actualizado.</p>
      <div className="modal-actions">
        <button className="good" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
      </div>
    </ModalShell>
  );
}

const EMPTY_SALV: SalvamentoRecord = { moved: '', reason: '', deliveredTo: '' };

function SalvamentoModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [f, setF] = useState<SalvamentoRecord>(EMPTY_SALV);
  const upd = (k: keyof SalvamentoRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <ModalShell title="Excepción por salvamento de vida / control de riesgo" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="small">Cuando hay riesgo vital o de seguridad, se permite intervenir antes de asegurar/entregar el lugar, pero <b>debe documentarse</b> qué se movió, por qué y a quién se entregó (Sección 9, regla 5). Esto exime las penalizaciones de orden mientras dure la urgencia.</p>
      <label>¿Qué se movió o intervino?</label>
      <input value={f.moved} onChange={upd('moved')} placeholder="Ej.: se retiró una prenda para atender a la víctima" />
      <label>¿Por qué? (riesgo/urgencia)</label>
      <input value={f.reason} onChange={upd('reason')} placeholder="Ej.: víctima con hemorragia, riesgo vital" />
      <label>¿A quién se entregó / informó?</label>
      <input value={f.deliveredTo} onChange={upd('deliveredTo')} placeholder="Ej.: primer responsable / personal de salud" />
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button className="good" onClick={() => dispatch({ type: 'SAVE_SALVAMENTO', record: f })}>Registrar salvamento</button>
      </div>
    </ModalShell>
  );
}

function AccessModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const [r, setR] = useState<AccessRecord>({ person: '', role: roleLabel(state.role), time: '', motive: '', zone: 'Perímetro crítico', action: 'ingreso' });
  const upd = (k: keyof AccessRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setR({ ...r, [k]: e.target.value } as AccessRecord);
  return (
    <ModalShell title="Registro de ingreso/salida de personal" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="small">Control de acceso por persona, hora, motivo y zona (Sección 9, regla 3). Toda persona que entra o sale del lugar debe quedar registrada.</p>
      <div className="form-grid">
        <div><label>Persona</label><input value={r.person} onChange={upd('person')} /></div>
        <div><label>Rol</label><input value={r.role} onChange={upd('role')} /></div>
        <div><label>Hora</label><input type="time" value={r.time} onChange={upd('time')} /></div>
        <div><label>Movimiento</label>
          <select value={r.action} onChange={upd('action')}><option value="ingreso">Ingreso</option><option value="salida">Salida</option></select>
        </div>
        <div><label>Motivo</label><input value={r.motive} onChange={upd('motive')} /></div>
        <div><label>Zona autorizada</label><input value={r.zone} onChange={upd('zone')} /></div>
      </div>
      <div className="modal-actions">
        <button className="good" onClick={() => { if (r.person.trim()) { dispatch({ type: 'ADD_ACCESS', record: r }); setR({ ...r, person: '', motive: '' }); } }}>Agregar al registro</button>
      </div>
      <div className="section-title">Registro actual</div>
      <div className="log">
        {state.accessLog.length === 0 && <p className="hint">Sin registros todavía.</p>}
        {state.accessLog.map((a, i) => (
          <div key={i} className="log-item">
            <b>{a.time || 's/h'}</b> · {a.action} · {a.person} ({a.role}) — {a.zone}{a.motive ? ` · ${a.motive}` : ''}
            <button style={{ width: 'auto', marginLeft: 8, padding: '2px 8px' }} className="bad" onClick={() => dispatch({ type: 'REMOVE_ACCESS', index: i })}>Quitar</button>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
      </div>
    </ModalShell>
  );
}

function ReportModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const report = buildReport(state);
  return (
    <ModalShell title="Retroalimentación final" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <pre className="report-box">{report}</pre>
      <div className="modal-actions">
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
        <button className="good" onClick={() => downloadText('informe_simulador_cadena_custodia.txt', report)}>Descargar informe</button>
      </div>
    </ModalShell>
  );
}

function TeacherModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const [text, setText] = useState(JSON.stringify(state.scenario, null, 2));
  return (
    <ModalShell title="Editor docente de escenarios JSON" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="small">Pegue un escenario JSON compatible y pulse cargar. Así el docente agrega nuevos casos sin tocar el código principal.</p>
      <label>JSON del escenario</label>
      <textarea className="json-area" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="modal-actions">
        <button onClick={() => navigator.clipboard.writeText(text)}>Copiar JSON actual</button>
        <button onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
        <button className="good" onClick={() => {
          try {
            const scenario = JSON.parse(text) as Scenario;
            validateScenario(scenario);
            dispatch({ type: 'LOAD_TEACHER_JSON', scenario });
          } catch (err) {
            alert('JSON inválido o incompleto: ' + (err as Error).message);
          }
        }}>Cargar JSON</button>
      </div>
    </ModalShell>
  );
}

function ManualModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <ModalShell title="Manual instructivo del simulador" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <div className="banner">Este manual explica cómo realizar la práctica. El objetivo es aprender a intervenir una escena, preservar EMP/EF y diligenciar registros básicos sin recibir la respuesta correcta durante la actividad.</div>
      <div className="manual-section">
        <h3>Secuencia recomendada</h3>
        <ul className="small">
          <li>Use EPP antes de intervenir.</li>
          <li>Acordone la escena y controle el acceso.</li>
          <li>Defina ruta de ingreso/salida y método de búsqueda.</li>
          <li>Observe el EMP/EF, fotografíe y señalice antes de manipular.</li>
          <li>Recolecte, embale, rotule, diligencie la cadena de custodia y entregue.</li>
        </ul>
      </div>
      <div className="manual-section">
        <h3>Cómo interactuar</h3>
        <ul className="small">
          <li>Seleccione una herramienta en el panel izquierdo.</li>
          <li>Haga clic sobre el EMP/EF en la escena 3D (arrastre para orbitar, rueda para zoom).</li>
          <li>Los formularios se llenan manualmente; el sistema asigna puntaje según orden y calidad.</li>
        </ul>
      </div>
      <div className="modal-actions">
        <button className="good" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Entendido, iniciar práctica</button>
      </div>
    </ModalShell>
  );
}

export function Modals({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  if (!state.modal) return null;
  switch (state.modal.kind) {
    case 'package': return <PackageModal state={state} dispatch={dispatch} />;
    case 'label': return <LabelModal dispatch={dispatch} />;
    case 'custody': return <CustodyModal state={state} dispatch={dispatch} />;
    case 'deliver': return <DeliverModal state={state} dispatch={dispatch} />;
    case 'confirm': return <ConfirmModal state={state} dispatch={dispatch} />;
    case 'closure': return <ClosureModal state={state} dispatch={dispatch} />;
    case 'manuals': return <ManualsModal dispatch={dispatch} />;
    case 'salvamento': return <SalvamentoModal dispatch={dispatch} />;
    case 'access': return <AccessModal state={state} dispatch={dispatch} />;
    case 'report': return <ReportModal state={state} dispatch={dispatch} />;
    case 'teacher': return <TeacherModal state={state} dispatch={dispatch} />;
    case 'manual': return <ManualModal dispatch={dispatch} />;
    default: return null;
  }
}
