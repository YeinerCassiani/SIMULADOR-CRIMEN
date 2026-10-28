import { useState, type MouseEvent } from 'react';
import { ArrowLeft, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import type { Scenario } from '../types';
import { LAB_DESTINATIONS, PACKAGING_LABELS, SEARCH_METHODS } from '../types';
import {
  ENVIRONMENTS, NATURES, clampToArea, draftToScenario, emptyDraft, emptyItem, envOf, scenarioToDraft, validateDraft,
  type CaseDraft, type ItemDraft, type WitnessDraft,
} from './caseLogic';

// Editor de casos por formulario: datos del caso, testigos y EMP/EF. Cada EMP/EF se
// ubica tocando el plano del ambiente (vista desde arriba). Las respuestas correctas
// (embalaje, laboratorio, testigos que deben separarse) solo las ve el docente.
export function CaseEditor({ initial, onSave, onCancel }: { initial: Scenario | null; onSave: (s: Scenario) => void; onCancel: () => void }) {
  const [d, setD] = useState<CaseDraft>(() => (initial ? scenarioToDraft(initial) : emptyDraft()));
  const [placing, setPlacing] = useState<number>(0);
  const [errors, setErrors] = useState<string[]>([]);
  const env = envOf(d.env);
  const set = (patch: Partial<CaseDraft>) => { setD((x) => ({ ...x, ...patch })); setErrors([]); };
  const setItem = (i: number, patch: Partial<ItemDraft>) => set({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const setWitness = (i: number, patch: Partial<WitnessDraft>) => set({ witnesses: d.witnesses.map((w, j) => (j === i ? { ...w, ...patch } : w)) });

  const save = () => {
    const errs = validateDraft(d);
    if (errs.length) { setErrors(errs); return; }
    onSave(draftToScenario(d, initial?.scenarioId ?? `DOC-${Date.now().toString(36)}`));
  };

  // Plano: 1 m = 30 px. Clic: ubica el EMP/EF activo (centro del plano = 0,0).
  const S = 30;
  const W = env.dims.w * S, H = env.dims.d * S;
  const onMap = (e: MouseEvent<SVGSVGElement>) => {
    if (!d.items[placing]) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * env.dims.w - env.dims.w / 2;
    const z = ((e.clientY - r.top) / r.height) * env.dims.d - env.dims.d / 2;
    setItem(placing, clampToArea(x, z, env.dims));
  };

  return (
    <div className="case-editor">
      <button type="button" className="btn-text start-back" onClick={onCancel}><ArrowLeft size={18} aria-hidden="true" /> Volver sin guardar</button>
      <h1 className="start-h1">{initial ? 'Editar caso' : 'Crear un caso'}</h1>

      <section className="teacher-card">
        <h2 className="start-h2">1. Datos del caso</h2>
        <div className="form-grid">
          <label className="mfield full"><span className="mfield-label">Título</span><input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Hurto en local comercial" /></label>
          <label className="mfield"><span className="mfield-label">Lugar</span>
            <select className="control" value={d.env} onChange={(e) => {
              const next = envOf(e.target.value);
              // Al cambiar de ambiente, los EMP/EF fuera del área nueva se recolocan dentro.
              set({ env: next.key, items: d.items.map((it) => (it.x === null || it.z === null ? it : { ...it, ...clampToArea(it.x, it.z, next.dims) })) });
            }}>
              {ENVIRONMENTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>
          <label className="mfield"><span className="mfield-label">Método de búsqueda adecuado</span>
            <select className="control" value={d.searchMethod} onChange={(e) => set({ searchMethod: e.target.value })}>
              {SEARCH_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="mfield full"><span className="mfield-label">Relato inicial (lo que lee el estudiante al empezar)</span>
            <textarea value={d.narrative} onChange={(e) => set({ narrative: e.target.value })} placeholder="Ej.: Se reporta un posible hurto en un local. El participante debe asegurar el lugar y procesar los EMP/EF." />
          </label>
          <label className="mfield"><span className="mfield-label">NUNC (opcional)</span><input value={d.nunc} onChange={(e) => set({ nunc: e.target.value })} inputMode="numeric" /></label>
          <label className="mfield"><span className="mfield-label">Referencia penal (opcional)</span><input value={d.penalReference} onChange={(e) => set({ penalReference: e.target.value })} /></label>
        </div>
      </section>

      <section className="teacher-card">
        <h2 className="start-h2">2. Testigos</h2>
        <ul className="case-list">
          {d.witnesses.map((w, i) => (
            <li key={i} className="witness-row">
              <label className="mfield"><span className="mfield-label">Nombre o descripción</span><input value={w.name} onChange={(e) => setWitness(i, { name: e.target.value })} placeholder="Ej.: Vigilante del edificio" /></label>
              <label className="check"><input type="checkbox" checked={w.mustBeSeparated} onChange={(e) => setWitness(i, { mustBeSeparated: e.target.checked })} /> <span>Debe separarse</span></label>
              <label className="check"><input type="checkbox" checked={w.hasRelevantInfo} onChange={(e) => setWitness(i, { hasRelevantInfo: e.target.checked })} /> <span>Tiene información relevante</span></label>
              <button type="button" className="btn-outline neg" onClick={() => set({ witnesses: d.witnesses.filter((_, j) => j !== i) })}><Trash2 size={16} aria-hidden="true" /> Quitar</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-outline" onClick={() => set({ witnesses: [...d.witnesses, { name: '', mustBeSeparated: true, hasRelevantInfo: false }] })}><Plus size={16} aria-hidden="true" /> Agregar testigo</button>
      </section>

      <section className="teacher-card">
        <h2 className="start-h2">3. EMP/EF y su ubicación</h2>
        <p className="start-meta">Elija un EMP/EF con "Ubicar en el plano" y toque el plano para ponerlo. La parte de arriba del plano es el fondo de la escena.</p>
        <div className="case-map-wrap">
          <svg className="case-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Plano de ${env.label}, ${env.dims.w} por ${env.dims.d} metros`} onClick={onMap}>
            <rect x="0" y="0" width={W} height={H} className="map-floor" />
            {Array.from({ length: env.dims.w - 1 }, (_, i) => <line key={'v' + i} x1={(i + 1) * S} y1={0} x2={(i + 1) * S} y2={H} className="map-grid" />)}
            {Array.from({ length: env.dims.d - 1 }, (_, i) => <line key={'h' + i} x1={0} y1={(i + 1) * S} x2={W} y2={(i + 1) * S} className="map-grid" />)}
            {d.items.map((it, i) => (it.x === null || it.z === null ? null : (
              <g key={i} transform={`translate(${(it.x + env.dims.w / 2) * S} ${(it.z + env.dims.d / 2) * S})`} className={i === placing ? 'map-pin is-on' : 'map-pin'}>
                <circle r="11" />
                <text y="4.5" textAnchor="middle">{i + 1}</text>
              </g>
            )))}
          </svg>
          <p className="start-meta">{d.items[placing] ? <>Ubicando: <b>EMP/EF {placing + 1}{d.items[placing].name ? ` · ${d.items[placing].name}` : ''}</b>. Toque el plano.</> : 'Agregue un EMP/EF para ubicarlo.'}</p>
        </div>

        <ol className="item-list">
          {d.items.map((it, i) => (
            <li key={i} className={`item-card${i === placing ? ' is-on' : ''}`}>
              <div className="item-head">
                <span className="item-n num">{i + 1}</span>
                <button type="button" className={`btn-outline${i === placing ? ' is-on' : ''}`} onClick={() => setPlacing(i)}>
                  <MapPin size={16} aria-hidden="true" /> {it.x === null ? 'Ubicar en el plano' : 'Cambiar ubicación'}
                </button>
                <button type="button" className="btn-outline neg" onClick={() => { set({ items: d.items.filter((_, j) => j !== i) }); setPlacing(0); }}><Trash2 size={16} aria-hidden="true" /> Quitar</button>
              </div>
              <div className="form-grid">
                <label className="mfield"><span className="mfield-label">Nombre</span><input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Ej.: Navaja con mancha" /></label>
                <label className="mfield"><span className="mfield-label">Naturaleza</span>
                  <select className="control" value={it.nature} onChange={(e) => setItem(i, { nature: e.target.value })}>
                    {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </label>
                <label className="mfield"><span className="mfield-label">Embalaje correcto</span>
                  <select className="control" value={it.correctPackaging} onChange={(e) => setItem(i, { correctPackaging: e.target.value as ItemDraft['correctPackaging'] })}>
                    <option value="">Elija...</option>
                    {Object.entries(PACKAGING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="mfield"><span className="mfield-label">Laboratorio de destino correcto</span>
                  <select className="control" value={it.labDestination} onChange={(e) => setItem(i, { labDestination: e.target.value })}>
                    <option value="">Elija...</option>
                    {LAB_DESTINATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label className="mfield full"><span className="mfield-label">Descripción (lo que ve el estudiante)</span><input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Ej.: Objeto metálico junto a la puerta" /></label>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-outline" onClick={() => { set({ items: [...d.items, emptyItem()] }); setPlacing(d.items.length); }}><Plus size={16} aria-hidden="true" /> Agregar EMP/EF</button>
      </section>

      {errors.length > 0 && (
        <section className="teacher-card form-errors" role="alert" aria-labelledby="err-h">
          <h2 id="err-h" className="start-h2">Falta completar</h2>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </section>
      )}

      <div className="start-actions">
        <button type="button" className="btn-outline start-btn" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn-primary start-btn" data-case-save onClick={save}><Save size={18} aria-hidden="true" /> Guardar caso</button>
      </div>
    </div>
  );
}
