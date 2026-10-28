import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import type { Action, SimState } from '../simulator';
import type { AccessRecord, CustodyRecord, LabelRecord, PackagingId, SalvamentoRecord, Scenario } from '../types';
import { PACKAGING_LABELS, LAB_DESTINATIONS } from '../types';
import { roleLabel } from '../roles';
import { buildReport, downloadText, validateScenario } from '../report';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Superficie común de los diálogos: scrim 60% negro, role=dialog con título, foco
// atrapado (Tab y Mayús+Tab ciclan dentro) y foco devuelto al cerrar. Esc lo maneja el
// atajo global de App (shortcutFor), que cierra el modal antes que cualquier otra cosa.
function ModalShell({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // Primer campo editable si existe; si no, el primer botón de acción del pie.
    const first = el?.querySelector<HTMLElement>('input:not([readonly]), select, textarea')
      ?? el?.querySelector<HTMLElement>('.modal-actions button')
      ?? el;
    first?.focus();
    return () => { if (prev && document.contains(prev)) prev.focus(); };
  }, []);

  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trap}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn-icon" aria-label="Cerrar diálogo" onClick={onClose}><X size={18} strokeWidth={1.5} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Campo con etiqueta asociada (la etiqueta envuelve al control). */
function F({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`mfield${full ? ' full' : ''}`}><span className="mfield-label">{label}</span>{children}</label>;
}

function PackageModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const modal = state.modal!;
  const item = state.scenario.evidenceItems.find((e) => e.id === (modal as { evidenceId: string }).evidenceId)!;
  const [choice, setChoice] = useState('');
  return (
    <ModalShell title="Seleccionar embalaje" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="lead">Seleccione el embalaje o contenedor que usted considere adecuado para el EMP/EF. El sistema no mostrará la opción correcta durante la actividad.</p>
      <F label="EMP/EF seleccionado"><input readOnly value={`${item.id} - ${item.name}`} /></F>
      <F label="Tipo de embalaje">
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Seleccione una opción</option>
          {Object.entries(PACKAGING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </F>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => {
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
      <p className="lead">Complete las casillas del rótulo. El puntaje dependerá del diligenciamiento. No se muestra la respuesta correcta durante la práctica.</p>
      <div className="form-grid">
        <F label="NUNC / Caso"><input value={f.nunc} onChange={upd('nunc')} /></F>
        <F label="ID EMP/EF"><input value={f.evidenceId} onChange={upd('evidenceId')} /></F>
        <F label="Descripción breve"><input value={f.description} onChange={upd('description')} /></F>
        <F label="Fecha de recolección"><input type="date" value={f.date} onChange={upd('date')} /></F>
        <F label="Hora de recolección"><input type="time" value={f.time} onChange={upd('time')} /></F>
        <F label="Lugar de hallazgo"><input value={f.location} onChange={upd('location')} /></F>
        <F label="Recolectado por"><input value={f.collectedBy} onChange={upd('collectedBy')} /></F>
        <F label="Tipo de embalaje"><input value={f.packaging} onChange={upd('packaging')} /></F>
        <F label="Observaciones" full><textarea value={f.obs} onChange={upd('obs')} placeholder="Datos relevantes del estado del EMP/EF o del contenedor" /></F>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'SAVE_LABEL', form: f })}>Guardar rótulo</button>
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
      <p className="lead">Complete las casillas mínimas del registro. El sistema califica si el diligenciamiento es suficiente y coherente con la actividad realizada.</p>
      <div className="form-grid">
        <F label="NUNC / Caso"><input value={r.nunc} onChange={upd('nunc')} /></F>
        <F label="ID EMP/EF"><input value={r.idText} onChange={upd('idText')} /></F>
        <F label="Fecha"><input type="date" value={r.date} onChange={upd('date')} /></F>
        <F label="Hora"><input type="time" value={r.time} onChange={upd('time')} /></F>
        <F label="Quien entrega"><input value={r.from} onChange={upd('from')} /></F>
        <F label="Quien recibe"><input value={r.to} onChange={upd('to')} /></F>
        <F label="Destino o propósito"><input value={r.purpose} onChange={upd('purpose')} /></F>
        <F label="Estado del contenedor"><input value={r.container} onChange={upd('container')} /></F>
        <F label="Descripción del EMP/EF y embalaje" full><textarea value={r.description} onChange={upd('description')} /></F>
        <F label="Observaciones" full><textarea value={r.obs} onChange={upd('obs')} /></F>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'SAVE_CUSTODY', record: r })}>Guardar registro</button>
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
      <p className="lead">Esta acción sobre <b>{item?.id} · {item?.name}</b> tiene consecuencias:</p>
      <ul className="warn-list">
        {modal.warnings.map((w, i) => <li key={i}><TriangleAlert size={14} strokeWidth={1.5} aria-hidden="true" /><span>{w}</span></li>)}
      </ul>
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-outline neg" onClick={() => { dispatch({ type: 'CLOSE_MODAL' }); dispatch({ type: 'APPLY_TOOL', id: modal.evidenceId }); }}>Proceder de todos modos</button>
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
      <p className="lead">Seleccione el laboratorio o destino al que corresponde el EMP/EF según su naturaleza. El sistema no muestra la respuesta correcta durante la actividad.</p>
      <F label="EMP/EF a entregar"><input readOnly value={`${item.id} - ${item.name} (${item.nature})`} /></F>
      <F label="Destino">
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Seleccione un destino</option>
          {LAB_DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </F>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => {
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
      <p className="lead">Revisión final, inventario y liberación formal del lugar (Sección 9, regla 10; cierre documentado de la inspección).</p>
      <dl className="facts">
        <div><dt>EMP/EF totales</dt><dd className="num">{total}</dd></div>
        <div><dt>Entregados a laboratorio/almacén</dt><dd className="num">{delivered}</dd></div>
        <div><dt>Pendientes de entrega</dt><dd className={`num${pending > 0 ? ' warn' : ''}`}>{pending}</dd></div>
        <div><dt>Con alteración/contaminación</dt><dd className={`num${contaminated > 0 ? ' neg' : ''}`}>{contaminated}</dd></div>
      </dl>
      {pending > 0 && <p className="notice-warn"><TriangleAlert size={14} strokeWidth={1.5} aria-hidden="true" /><span>Aún hay EMP/EF sin entregar: el cierre quedará con observaciones y penalización.</span></p>}
      <p className="lead">Al confirmar, se registra la revisión final, el estado de condiciones y la devolución/liberación del lugar al responsable.</p>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'FINALIZE' })}>Confirmar cierre y finalizar</button>
      </div>
    </ModalShell>
  );
}

function ManualsModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  return (
    <ModalShell title="Marco normativo" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="lead">Fuentes que fundamentan el procedimiento del simulador (consulta de referencia).</p>
      <div className="manual-section">
        <h3>Ley 906 de 2004, Código de Procedimiento Penal</h3>
        <ul>
          <li><b>Art. 216:</b> aseguramiento, embalaje y custodia para evitar alteración o suplantación del EMP/EF.</li>
          <li><b>Art. 254:</b> factores de la cadena de custodia (identidad, estado original, recolección, preservación, embalaje, envío, lugares/fechas y registro de cada custodio).</li>
          <li><b>Art. 255:</b> responsabilidad del servidor que entra en contacto con el EMP/EF.</li>
        </ul>
      </div>
      <div className="manual-section">
        <h3>Manuales institucionales</h3>
        <ul>
          <li><b>MUPJ-3</b>, Manual Único de Policía Judicial, v3: alcance de la policía judicial, actos urgentes, inspección del lugar y de cadáver, dirección funcional del fiscal, roles y límites.</li>
          <li><b>MC-FGN</b>, Manual Integrado de Criminalística (FGN): criminalística de campo, lofoscopia, fotografía, balística, biología/genética, informática, explosivos, automotores.</li>
          <li><b>MSCC-2018</b>, Manual del Sistema de Cadena de Custodia, v4: hallazgo, recolección, embalaje, rotulado, transporte, análisis, almacenamiento, continuidad y registro.</li>
        </ul>
      </div>
      <p className="meta">Criterio de prevalencia: ante contradicción prevalece la regla vigente de superior jerarquía o el procedimiento institucional actualizado.</p>
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
      </div>
    </ModalShell>
  );
}

const EMPTY_SALV: SalvamentoRecord = { moved: '', reason: '', deliveredTo: '' };

function SalvamentoModal({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [f, setF] = useState<SalvamentoRecord>(EMPTY_SALV);
  const upd = (k: keyof SalvamentoRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <ModalShell title="Excepción por salvamento de vida o control de riesgo" onClose={() => dispatch({ type: 'CLOSE_MODAL' })}>
      <p className="lead">Cuando hay riesgo vital o de seguridad, se permite intervenir antes de asegurar/entregar el lugar, pero <b>debe documentarse</b> qué se movió, por qué y a quién se entregó (Sección 9, regla 5). Esto exime las penalizaciones de orden mientras dure la urgencia.</p>
      <F label="¿Qué se movió o intervino?"><input value={f.moved} onChange={upd('moved')} placeholder="Ej.: se retiró una prenda para atender a la víctima" /></F>
      <F label="¿Por qué? (riesgo/urgencia)"><input value={f.reason} onChange={upd('reason')} placeholder="Ej.: víctima con hemorragia, riesgo vital" /></F>
      <F label="¿A quién se entregó o informó?"><input value={f.deliveredTo} onChange={upd('deliveredTo')} placeholder="Ej.: primer responsable / personal de salud" /></F>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'SAVE_SALVAMENTO', record: f })}>Registrar salvamento</button>
      </div>
    </ModalShell>
  );
}

function AccessModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const [r, setR] = useState<AccessRecord>({ person: '', role: roleLabel(state.role), time: '', motive: '', zone: 'Perímetro crítico', action: 'ingreso' });
  const upd = (k: keyof AccessRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setR({ ...r, [k]: e.target.value } as AccessRecord);
  return (
    <ModalShell title="Registro de ingreso y salida de personal" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="lead">Control de acceso por persona, hora, motivo y zona (Sección 9, regla 3). Toda persona que entra o sale del lugar debe quedar registrada.</p>
      <div className="form-grid">
        <F label="Persona"><input value={r.person} onChange={upd('person')} /></F>
        <F label="Rol"><input value={r.role} onChange={upd('role')} /></F>
        <F label="Hora"><input type="time" value={r.time} onChange={upd('time')} /></F>
        <F label="Movimiento">
          <select value={r.action} onChange={upd('action')}><option value="ingreso">Ingreso</option><option value="salida">Salida</option></select>
        </F>
        <F label="Motivo"><input value={r.motive} onChange={upd('motive')} /></F>
        <F label="Zona autorizada"><input value={r.zone} onChange={upd('zone')} /></F>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-primary" onClick={() => { if (r.person.trim()) { dispatch({ type: 'ADD_ACCESS', record: r }); setR({ ...r, person: '', motive: '' }); } }}>Agregar al registro</button>
      </div>
      <h3 className="section-h">Registro actual <span className="num muted">{state.accessLog.length}</span></h3>
      {state.accessLog.length === 0
        ? <p className="empty">Sin registros todavía.</p>
        : (
          <ul className="rows">
            {state.accessLog.map((a, i) => (
              <li key={i} className="row">
                <span className="row-main">
                  <span className="row-title"><span className="num">{a.time || 's/h'}</span> · {a.action} · {a.person} ({a.role})</span>
                  <span className="meta">{a.zone}{a.motive ? ` · ${a.motive}` : ''}</span>
                </span>
                <button type="button" className="btn-outline neg" aria-label={`Quitar registro de ${a.person}`} onClick={() => dispatch({ type: 'REMOVE_ACCESS', index: i })}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
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
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
        <button type="button" className="btn-primary" onClick={() => downloadText('informe_simulador_cadena_custodia.txt', report)}>Descargar informe</button>
      </div>
    </ModalShell>
  );
}

function TeacherModal({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const [text, setText] = useState(JSON.stringify(state.scenario, null, 2));
  return (
    <ModalShell title="Editor docente de escenarios JSON" onClose={() => dispatch({ type: 'CLOSE_MODAL' })} wide>
      <p className="lead">Pegue un escenario JSON compatible y pulse cargar. Así el docente agrega nuevos casos sin tocar el código principal.</p>
      <F label="JSON del escenario" full><textarea className="json-area" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} /></F>
      <div className="modal-actions">
        <button type="button" className="btn-outline" onClick={() => navigator.clipboard.writeText(text)}>Copiar JSON actual</button>
        <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Cerrar</button>
        <button type="button" className="btn-primary" onClick={() => {
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
      <p className="lead">Este manual explica cómo realizar la práctica. El objetivo es aprender a intervenir una escena, preservar EMP/EF y diligenciar registros básicos sin recibir la respuesta correcta durante la actividad.</p>
      <div className="manual-grid">
        <div className="manual-section">
          <h3>Secuencia recomendada</h3>
          <ol>
            <li>Use EPP antes de intervenir.</li>
            <li>Acordone la escena y controle el acceso.</li>
            <li>Defina ruta de ingreso/salida y método de búsqueda.</li>
            <li>Observe el EMP/EF, fotografíe y señalice antes de manipular.</li>
            <li>Recolecte, embale, rotule, diligencie la cadena de custodia y entregue.</li>
          </ol>
        </div>
        <div className="manual-section">
          <h3>Cómo interactuar</h3>
          <ul>
            <li>Elija una herramienta en la bandeja inferior.</li>
            <li>Haga clic sobre el EMP/EF en la escena 3D (arrastre para orbitar, rueda para acercar) o en la lista del inspector.</li>
            <li>Las acciones globales, los testigos y el cierre están en el inspector de la derecha.</li>
            <li>Tecla L: luz forense. Esc: vista general.</li>
            <li>Los formularios se llenan manualmente; el sistema asigna puntaje según orden y calidad.</li>
          </ul>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-primary" data-eval="manual-close" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Entendido, iniciar práctica</button>
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
