import { useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Play, RotateCw, UserRound } from 'lucide-react';
import type { SimState } from '../simulator';
import { progressPercent } from '../simulator';
import type { Scenario } from '../types';
import { capabilitySummary, roleLabel, type RoleDef } from '../roles';
import { availableRoles, availableScenarios, type TeacherConfig } from '../practiceConfig';
import { AMBIENTE_LABEL } from './logic';
import { modeSummary, timerSummary } from './startLogic';
import { SplashLogo } from './SplashLogo';

type Step = 'quien' | 'caso' | 'rol' | 'confirmar';

interface Props {
  config: TeacherConfig;
  /** La configuración vino en el enlace del docente. */
  fromLink: boolean;
  /** Práctica guardada sin terminar, si existe. */
  saved: SimState | null;
  onContinue: () => void;
  onStart: (scenarios: Scenario[], index: number, role: string) => void;
  onTeacher: () => void;
}

const RECOMMENDED = 'investigador_lider';

// Pantalla de inicio: quién usa el simulador y, para el estudiante, caso, rol y
// resumen antes de empezar. Un paso por pantalla, con "Volver" siempre visible.
export function StartScreen({ config, fromLink, saved, onContinue, onStart, onTeacher }: Props) {
  const scenarios = availableScenarios(config);
  const roles = availableRoles(config);
  const [step, setStep] = useState<Step>('quien');
  const [caseIdx, setCaseIdx] = useState(0);
  const [role, setRole] = useState<string>(roles.some((r) => r.id === RECOMMENDED) ? RECOMMENDED : roles[0].id);
  const scenario = scenarios[caseIdx] ?? scenarios[0];
  const stepNo = step === 'caso' ? 1 : step === 'rol' ? 2 : step === 'confirmar' ? 3 : 0;

  return (
    <div className="start" data-start-screen>
      <div className="start-inner">
        {step === 'quien' && (
          <>
            <div className="start-brand">
              <SplashLogo size={96} />
              <div>
                <h1 className="start-title">Simulador de Escena del Crimen</h1>
                <p className="start-lead">Practique el procesamiento del lugar de los hechos y la cadena de custodia en una escena 3D.</p>
              </div>
            </div>

            {saved && (
              <section className="start-resume" aria-labelledby="resume-h">
                <div>
                  <h2 id="resume-h" className="start-h2">Hay una práctica sin terminar</h2>
                  <p className="start-meta">{saved.scenario.title} · {roleLabel(saved.role)} · {progressPercent(saved)} % del procedimiento</p>
                </div>
                <button type="button" className="btn-primary start-btn" data-start-continue onClick={onContinue}>
                  <Play size={18} aria-hidden="true" /> Continuar práctica
                </button>
              </section>
            )}

            <h2 className="start-h2">¿Quién va a usar el simulador?</h2>
            <div className="start-who">
              <button type="button" className="start-card start-card-big" data-start-student onClick={() => setStep('caso')}>
                <UserRound size={28} strokeWidth={1.5} aria-hidden="true" />
                <span className="start-card-title">Soy estudiante</span>
                <span className="start-card-text">{saved ? 'Empezar una práctica nueva: elegir caso y rol.' : 'Elegir un caso y un rol, y empezar la práctica.'}</span>
              </button>
              {!fromLink && (
                <button type="button" className="start-card start-card-big" data-start-teacher onClick={onTeacher}>
                  <GraduationCap size={28} strokeWidth={1.5} aria-hidden="true" />
                  <span className="start-card-title">Soy docente</span>
                  <span className="start-card-text">Preparar las prácticas: modo, tiempo, roles y casos propios. Pide su PIN.</span>
                </button>
              )}
            </div>
            {fromLink && <p className="start-note">Esta práctica la preparó su docente.</p>}
          </>
        )}

        {step !== 'quien' && (
          <p className="start-progress">Paso {stepNo} de 3</p>
        )}

        {step === 'caso' && (
          <>
            <h2 className="start-h1">Elija el caso</h2>
            <div className="start-grid" role="radiogroup" aria-label="Casos disponibles">
              {scenarios.map((s, i) => (
                <button key={s.scenarioId + i} type="button" role="radio" aria-checked={i === caseIdx} data-start-case={s.title}
                  className={`start-card${i === caseIdx ? ' is-on' : ''}`} onClick={() => setCaseIdx(i)}>
                  <span className="start-card-kicker">{AMBIENTE_LABEL[s.environmentType] ?? s.environmentType}</span>
                  <span className="start-card-title">{s.title}</span>
                  <span className="start-card-text">{s.initialNarrative}</span>
                  <span className="start-card-meta">{s.evidenceItems.length} EMP/EF · {s.witnesses.length} testigos</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'rol' && (
          <>
            <h2 className="start-h1">Elija su rol</h2>
            <p className="start-lead">El rol define qué puede hacer en la escena. Si un paso le corresponde a otro rol, el simulador le ofrecerá hacer el relevo.</p>
            <div className="start-grid" role="radiogroup" aria-label="Roles">
              {roles.map((r) => <RoleCard key={r.id} r={r} on={r.id === role} onPick={() => setRole(r.id)} />)}
            </div>
          </>
        )}

        {step === 'confirmar' && (
          <>
            <h2 className="start-h1">Todo listo</h2>
            <dl className="start-summary">
              <div><dt>Caso</dt><dd>{scenario.title}</dd></div>
              <div><dt>Rol</dt><dd>{roleLabel(role)}</dd></div>
              <div><dt>Modo</dt><dd>{modeSummary(config.mode)}</dd></div>
              <div><dt>Tiempo</dt><dd>{timerSummary(config.timerSeconds, scenario.environmentType)}</dd></div>
            </dl>
            {saved && <p className="start-note"><RotateCw size={16} aria-hidden="true" /> Al empezar se reemplaza la práctica sin terminar.</p>}
          </>
        )}

        {step !== 'quien' && (
          <div className="start-actions">
            <button type="button" className="btn-outline start-btn" onClick={() => setStep(step === 'caso' ? 'quien' : step === 'rol' ? 'caso' : 'rol')}>
              <ArrowLeft size={18} aria-hidden="true" /> Volver
            </button>
            {step === 'confirmar' ? (
              <button type="button" className="btn-primary start-btn" data-start-go onClick={() => onStart(scenarios, caseIdx, role)}>
                <Play size={18} aria-hidden="true" /> Empezar práctica
              </button>
            ) : (
              <button type="button" className="btn-primary start-btn" data-start-next onClick={() => setStep(step === 'caso' ? 'rol' : 'confirmar')}>
                Siguiente <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({ r, on, onPick }: { r: RoleDef; on: boolean; onPick: () => void }) {
  const caps = capabilitySummary(r.id);
  const can = caps.filter((c) => c.level !== 'deny').map((c) => c.label);
  const cannot = caps.filter((c) => c.level === 'deny').map((c) => c.label);
  return (
    <button type="button" role="radio" aria-checked={on} data-start-role={r.id} className={`start-card${on ? ' is-on' : ''}`} onClick={onPick}>
      {r.id === RECOMMENDED && <span className="start-card-kicker">Recomendado para empezar</span>}
      <span className="start-card-title">{r.label}</span>
      <span className="start-card-text">{r.description}</span>
      <span className="start-card-meta"><b>Puede:</b> {can.join(', ') || 'ninguna función técnica'}</span>
      {cannot.length > 0 && <span className="start-card-meta"><b>No puede:</b> {cannot.join(', ')}</span>}
    </button>
  );
}
