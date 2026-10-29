import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Copy, KeyRound, Link2, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import type { PracticeMode, Scenario } from '../types';
import { SCENARIOS } from '../data/scenarios';
import { ROLE_DEFS, type RoleId } from '../roles';
import {
  LINK_WARN_LENGTH, TIMER_CHOICES, hashPin, loadTeacher, saveTeacher, studentLink, validPin,
  type TeacherConfig, type TeacherStore,
} from '../practiceConfig';
import { MODE_LABEL, modeDescription } from './startLogic';
import { CaseEditor } from './CaseEditor';

// Espacio docente: PIN de acceso y la configuración de las prácticas (modo, tiempo,
// roles, casos visibles, casos propios) con el enlace para compartir con estudiantes.
export function TeacherSpace({ onBack, onTry }: { onBack: () => void; onTry: (c: TeacherConfig) => void }) {
  const [store, setStore] = useState<TeacherStore>(loadTeacher);
  const [unlocked, setUnlocked] = useState(false);

  const update = (config: TeacherConfig) => {
    const next = { ...store, config };
    setStore(next);
    saveTeacher(next);
  };

  return (
    <div className="start teacher" data-teacher-space>
      <div className="start-inner">
        {!unlocked && <button type="button" className="btn-text start-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> Volver al inicio</button>}
        {!unlocked
          ? <PinGate store={store} onStore={(s) => { setStore(s); saveTeacher(s); }} onOk={() => setUnlocked(true)} />
          : <Settings config={store.config} onChange={update} onTry={() => onTry(store.config)} onBack={onBack} />}
      </div>
    </div>
  );
}

function PinGate({ store, onStore, onOk }: { store: TeacherStore; onStore: (s: TeacherStore) => void; onOk: () => void }) {
  const creating = !store.pinHash;
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = async () => {
    if (!validPin(pin)) { setError('El PIN debe tener entre 4 y 8 números.'); return; }
    if (creating) {
      if (pin.trim() !== pin2.trim()) { setError('Los dos PIN no coinciden. Escríbalos de nuevo.'); return; }
      onStore({ ...store, pinHash: await hashPin(pin) });
      onOk();
      return;
    }
    if ((await hashPin(pin)) === store.pinHash) onOk();
    else setError('PIN incorrecto. Revise e intente de nuevo.');
  };

  if (forgot) {
    return (
      <section className="teacher-card" aria-labelledby="forgot-h">
        <h1 id="forgot-h" className="start-h1">¿Olvidó su PIN?</h1>
        <p className="start-lead">Puede crear uno nuevo. Para proteger las prácticas, se borran los ajustes y los casos propios guardados en este equipo. Los enlaces que ya compartió siguen funcionando.</p>
        <div className="start-actions">
          <button type="button" className="btn-outline start-btn" onClick={() => setForgot(false)}>No, volver</button>
          <button type="button" className="btn-outline neg start-btn" onClick={() => { onStore({ pinHash: null, config: { v: 1, mode: 'guiada', timerSeconds: 150, roles: [], hiddenCases: [], cases: [] } }); setForgot(false); setPin(''); setError(''); }}>
            Borrar y crear un PIN nuevo
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="teacher-card" aria-labelledby="pin-h" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <KeyRound size={28} strokeWidth={1.5} aria-hidden="true" />
      <h1 id="pin-h" className="start-h1">{creating ? 'Cree su PIN de docente' : 'Espacio docente'}</h1>
      <p className="start-lead">{creating
        ? 'Es la primera vez en este equipo. Elija un PIN de 4 a 8 números para que los estudiantes no cambien la configuración.'
        : 'Escriba su PIN para preparar las prácticas.'}</p>
      <label className="mfield"><span className="mfield-label">PIN</span>
        <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => { setPin(e.target.value); setError(''); }} autoFocus data-pin />
      </label>
      {creating && (
        <label className="mfield"><span className="mfield-label">Repita el PIN</span>
          <input type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => { setPin2(e.target.value); setError(''); }} data-pin2 />
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="start-actions">
        {!creating && <button type="button" className="btn-text" onClick={() => setForgot(true)}>Olvidé mi PIN</button>}
        <button type="submit" className="btn-primary start-btn" data-pin-go>{creating ? 'Crear PIN y entrar' : 'Entrar'}</button>
      </div>
    </form>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="teacher-card">
      <h2 className="start-h2">{title}</h2>
      {hint && <p className="start-meta">{hint}</p>}
      {children}
    </section>
  );
}

function Settings({ config, onChange, onTry, onBack }: { config: TeacherConfig; onChange: (c: TeacherConfig) => void; onTry: () => void; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const set = (patch: Partial<TeacherConfig>) => onChange({ ...config, ...patch });
  const link = studentLink(window.location.href, config);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt('Copie este enlace:', link); }
  };

  if (editing) {
    return (
      <CaseEditor
        initial={editing.index === null ? null : config.cases[editing.index]}
        onCancel={() => setEditing(null)}
        onSave={(sc: Scenario) => {
          const cases = [...config.cases];
          if (editing.index === null) cases.push(sc); else cases[editing.index] = sc;
          set({ cases });
          setEditing(null);
        }}
      />
    );
  }

  const roleOn = (id: RoleId) => config.roles.length === 0 || config.roles.includes(id);
  const toggleRole = (id: RoleId) => {
    const current = config.roles.length ? config.roles : ROLE_DEFS.map((r) => r.id);
    const next = current.includes(id) ? current.filter((r) => r !== id) : [...current, id];
    if (next.length === 0) return; // al menos un rol
    set({ roles: next.length === ROLE_DEFS.length ? [] : next });
  };
  const caseOn = (id: string) => !config.hiddenCases.includes(id);
  const toggleCase = (id: string) => set({ hiddenCases: caseOn(id) ? [...config.hiddenCases, id] : config.hiddenCases.filter((c) => c !== id) });

  return (
    <>
      <button type="button" className="btn-text start-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> Volver al inicio</button>
      <h1 className="start-h1">Preparar las prácticas</h1>
      <p className="start-lead">Los cambios se guardan solos en este equipo. Para usarlos en otros equipos, comparta el enlace del final.</p>

      <Block title="Modo de la práctica">
        <div className="start-grid two" role="radiogroup" aria-label="Modo de la práctica">
          {(['guiada', 'evaluacion'] as PracticeMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={config.mode === m} data-mode={m}
              className={`start-card${config.mode === m ? ' is-on' : ''}`} onClick={() => set({ mode: m })}>
              <span className="start-card-title">{MODE_LABEL[m]}</span>
              <span className="start-card-text">{modeDescription(m)}</span>
            </button>
          ))}
        </div>
      </Block>

      <Block title="Tiempo en lugares abiertos" hint="En el parque y la vía pública, al acabarse el tiempo los EMP/EF no recolectados se pierden. En lugares cerrados no hay límite.">
        <label className="mfield"><span className="mfield-label">Tiempo</span>
          <select className="control" value={config.timerSeconds ?? ''} onChange={(e) => set({ timerSeconds: e.target.value ? Number(e.target.value) : null })}>
            {TIMER_CHOICES.map((t) => <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>)}
          </select>
        </label>
      </Block>

      <Block title="Roles que pueden elegir los estudiantes" hint="Debe quedar al menos uno.">
        <ul className="check-list">
          {ROLE_DEFS.map((r) => (
            <li key={r.id}><label className="check"><input type="checkbox" checked={roleOn(r.id)} onChange={() => toggleRole(r.id)} /> <span>{r.label}</span></label></li>
          ))}
        </ul>
      </Block>

      <Block title="Casos">
        <ul className="check-list">
          {SCENARIOS.map((s) => (
            <li key={s.scenarioId}><label className="check"><input type="checkbox" checked={caseOn(s.scenarioId)} onChange={() => toggleCase(s.scenarioId)} /> <span>{s.title}</span></label></li>
          ))}
        </ul>
        <h3 className="group-h">Casos propios</h3>
        {config.cases.length === 0 && <p className="start-meta">Todavía no ha creado casos.</p>}
        <ul className="case-list">
          {config.cases.map((c, i) => (
            <li key={c.scenarioId + i} className="case-row">
              <span className="case-row-title">{c.title}</span>
              <span className="start-meta">{c.evidenceItems.length} EMP/EF · {c.witnesses.length} testigos</span>
              <button type="button" className="btn-outline" onClick={() => setEditing({ index: i })}><Pencil size={16} aria-hidden="true" /> Editar</button>
              <button type="button" className="btn-outline neg" onClick={() => { if (window.confirm(`¿Borrar el caso "${c.title}"?`)) set({ cases: config.cases.filter((_, j) => j !== i) }); }}>
                <Trash2 size={16} aria-hidden="true" /> Borrar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-outline start-btn" data-case-new onClick={() => setEditing({ index: null })}><Plus size={18} aria-hidden="true" /> Crear un caso</button>
      </Block>

      <Block title="Compartir con los estudiantes" hint="Envíe este enlace por correo o por el aula virtual. Al abrirlo, el estudiante ve exactamente esta configuración y no puede cambiarla.">
        <div className="link-row">
          <Link2 size={18} aria-hidden="true" />
          <input className="link-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace para estudiantes" />
          <button type="button" className="btn-primary" onClick={() => { void copy(); }}>
            {copied ? <><Check size={16} aria-hidden="true" /> Copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar enlace</>}
          </button>
        </div>
        {link.length > LINK_WARN_LENGTH && (
          <p className="form-error" role="status" data-link-long>
            El enlace es largo ({link.length} caracteres) porque incluye {config.cases.length} {config.cases.length === 1 ? 'caso propio' : 'casos propios'}. Algunos chats o aulas virtuales lo cortan: si a los estudiantes no les abre, comparta menos casos por enlace o envíelo por correo.
          </p>
        )}
      </Block>

      <div className="start-actions">
        <button type="button" className="btn-primary start-btn" onClick={onTry}><Play size={18} aria-hidden="true" /> Probar como estudiante</button>
      </div>
    </>
  );
}
