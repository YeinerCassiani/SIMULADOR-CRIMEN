import { useCallback, useEffect, useReducer, useState, type Dispatch } from 'react';
import { reducer, initState, type Action, type SimState } from './simulator';
import { loadState, saveState } from './persistence';
import { Scene } from './scene/Scene';
import { DEFAULT_VIEW, type CameraCmd, type QualityTier, type ViewSettings } from './scene/contracts';
import type { Scenario } from './types';
import type { NextStep } from './flow';
import { availableScenarios, configFromHash, loadTeacher, practiceOf, type TeacherConfig } from './practiceConfig';
import { Rail, type PanelId, type RailTarget } from './ui/Rail';
import { TopBar } from './ui/TopBar';
import { Inspector } from './ui/Inspector';
import { ProcedureStrip } from './ui/ProcedurePanel';
import { SceneBoundary, SceneFailure } from './ui/SceneBoundary';
import { Modals } from './ui/Modals';
import { sceneView, shortcutFor } from './ui/logic';
import { Splash } from './ui/Splash';
import { splashDisabled } from './ui/splashLogic';
import { ActionFeedback } from './ui/ActionFeedback';
import { CameraPad, NextStepBar } from './ui/PracticeAids';
import { StartScreen } from './ui/StartScreen';
import { TeacherSpace } from './ui/TeacherSpace';
import './App.css';

type Stage = 'inicio' | 'docente' | 'practica';

function lazyInit(): SimState {
  return loadState() ?? initState(availableScenarios(currentConfig()));
}

/** Configuración vigente: la del enlace del docente si existe; si no, la guardada en este equipo. */
function currentConfig(): TeacherConfig {
  return configFromHash(window.location.hash) ?? loadTeacher().config;
}

/** Escritorio (>= 1100px): panel abierto por defecto; en hoja inferior arranca plegado. */
const isWide = () => typeof window === 'undefined' || window.matchMedia('(min-width: 1100px)').matches;

/** Lleva el foco a un control del panel y lo resalta un momento ("Mostrarme dónde"). */
function highlight(selector: string) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 2400);
  }));
}

export default function App() {
  const [state, rawDispatch] = useReducer(reducer, undefined, lazyInit);
  const [fromLink] = useState(() => configFromHash(window.location.hash) !== null);
  const [config, setConfig] = useState<TeacherConfig>(currentConfig);
  const [stage, setStage] = useState<Stage>('inicio');
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [tier, setTier] = useState<QualityTier | null>(null);
  const [panel, setPanel] = useState<PanelId>('escena');
  const [inspectorOpen, setInspectorOpen] = useState(isWide);
  const [logOpen, setLogOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [splash, setSplash] = useState(() => typeof window === 'undefined' || !splashDisabled(window.location.search));

  const openPanel = useCallback((p: PanelId) => { setPanel(p); setInspectorOpen(true); }, []);

  // Tocar un EMP/EF (en la escena o la lista) abre el panel con sus pasos.
  const dispatch: Dispatch<Action> = useCallback((a: Action) => {
    if (a.type === 'SELECT_EVIDENCE' && a.id) openPanel('escena');
    rawDispatch(a);
  }, [openPanel]);

  useEffect(() => { saveState(state); }, [state]);

  // Reloj de la escena: solo corre con la práctica a la vista. TICK es no-op sin
  // temporizador, con la práctica finalizada o con el tiempo en cero.
  const practicing = stage === 'practica' && !splash;
  useEffect(() => {
    if (!practicing) return;
    const id = setInterval(() => rawDispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [practicing]);

  useEffect(() => {
    const onLost = () => setContextLost(true);
    window.addEventListener('scene:contextlost', onLost);
    return () => window.removeEventListener('scene:contextlost', onLost);
  }, []);

  const toggleForensic = useCallback(() => setView((v) => ({ ...v, forensicLight: !v.forensicLight })), []);
  const overview = useCallback(() => setView((v) => ({ ...v, overview: v.overview + 1 })), []);
  const camera = useCallback((cmd: CameraCmd) => setView((v) => ({ ...v, camera: { seq: v.camera.seq + 1, cmd } })), []);

  // Con la bienvenida o la pantalla de inicio delante, los atajos de la escena no
  // aplican y las etiquetas Html se ocultan (no atraviesan esas pantallas).
  const modalOpen = state.modal !== null || splash || stage !== 'practica';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const sc = shortcutFor({
        key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
        targetTag: t?.tagName, editable: !!t?.closest?.('[contenteditable=""],[contenteditable="true"]'),
        modalOpen,
      });
      if (!sc || stage !== 'practica') return;
      e.preventDefault();
      if (sc === 'close-modal') rawDispatch({ type: 'CLOSE_MODAL' });
      else if (sc === 'overview') overview();
      else toggleForensic();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, stage, overview, toggleForensic]);

  const go = (t: RailTarget) => {
    if (t === 'normativo') rawDispatch({ type: 'OPEN_MODAL', modal: { kind: 'manuals' } });
    else if (t === 'manual') rawDispatch({ type: 'OPEN_MODAL', modal: { kind: 'manual' } });
    else if (inspectorOpen && panel === t && !isWide()) setInspectorOpen(false); // en hoja inferior, tocar el activo la pliega
    else openPanel(t);
  };

  const showStep = (s: NextStep) => {
    const t = s.target;
    if (t.kind === 'evidence') {
      dispatch({ type: 'SELECT_EVIDENCE', id: t.id });
      highlight(`[data-step="${t.tool}"]`);
      return;
    }
    openPanel('escena');
    if (t.kind === 'global') highlight(`[data-global="${t.action}"]`);
    else if (t.kind === 'witness') highlight(`[data-witness="${t.id}"]`);
    else if (t.kind === 'access') highlight('[data-open="access"]');
    else highlight('[data-open="closure"]');
  };

  const startPractice = (scenarios: Scenario[], index: number, role: string) => {
    rawDispatch({ type: 'START_PRACTICE', scenarios, index, role, practice: practiceOf(config) });
    setView((v) => ({ ...v, forensicLight: false, overview: v.overview + 1 }));
    setPanel('escena');
    setInspectorOpen(isWide());
    setStage('practica');
  };

  const saved = state.started && !state.finalized ? state : null;
  const evaluation = state.practice.mode === 'evaluacion';

  return (
    <div className={`app${inspectorOpen ? ' has-inspector' : ''}`}>
      {/* Visor 3D a pantalla completa, en su propio contexto de apilamiento: las
          etiquetas Html de drei (z-index enorme) nunca quedan por encima de la UI.
          Se monta desde el inicio para que la bienvenida cargue sus recursos. */}
      <main className="viewport" aria-label="Escena 3D" aria-hidden={stage !== 'practica'}>
        <SceneBoundary>
          <Scene state={state} dispatch={dispatch} view={sceneView(view, modalOpen)} onTierChange={setTier} />
        </SceneBoundary>
      </main>

      {stage === 'practica' && (
        <>
          <Rail active={inspectorOpen ? panel : null} onGo={go} />
          <TopBar
            state={state}
            forensicLight={view.forensicLight}
            onToggleForensic={toggleForensic}
            inspectorOpen={inspectorOpen}
            onToggleInspector={() => setInspectorOpen((o) => !o)}
            onHome={() => { rawDispatch({ type: 'CLOSE_MODAL' }); setStage('inicio'); }}
            onRole={() => openPanel('ajustes')}
          />

          <div className="scene-aids">
            <NextStepBar state={state} onShow={showStep} />
          </div>
          <CameraPad onCmd={camera} onOverview={overview} />

          <div className="dock">
            <ActionFeedback log={state.log} neutral={evaluation} />
            <ProcedureStrip state={state} onDetail={() => openPanel('procedimiento')} />
          </div>

          <Inspector
            state={state}
            dispatch={dispatch}
            open={inspectorOpen}
            panel={panel}
            onPanel={setPanel}
            onClose={() => setInspectorOpen(false)}
            logOpen={logOpen}
            onToggleLog={() => setLogOpen((o) => !o)}
            view={view}
            onQuality={(quality) => setView((v) => ({ ...v, quality }))}
            tier={tier}
          />

          {contextLost && <div className="scene-fail-wrap"><SceneFailure reason="contextlost" /></div>}

          <Modals state={state} dispatch={dispatch} />
        </>
      )}

      {stage === 'inicio' && (
        <StartScreen
          config={config}
          fromLink={fromLink}
          saved={saved}
          onContinue={() => { setStage('practica'); setInspectorOpen(isWide()); }}
          onStart={startPractice}
          onTeacher={() => setStage('docente')}
        />
      )}

      {stage === 'docente' && (
        <TeacherSpace
          onBack={() => { setConfig(currentConfig()); setStage('inicio'); }}
          onTry={(c) => { setConfig(c); setStage('inicio'); }}
        />
      )}

      {splash && <Splash onEnter={() => setSplash(false)} />}
    </div>
  );
}
