import { useCallback, useEffect, useReducer, useState } from 'react';
import { reducer, initState, type SimState } from './simulator';
import { SCENARIOS } from './data/scenarios';
import { loadState, saveState } from './persistence';
import { Scene } from './scene/Scene';
import { DEFAULT_VIEW, type QualityTier, type ViewSettings } from './scene/contracts';
import { Rail, type PanelId, type RailTarget } from './ui/Rail';
import { TopBar } from './ui/TopBar';
import { ToolTray } from './ui/ToolTray';
import { Inspector } from './ui/Inspector';
import { ProcedureStrip } from './ui/ProcedurePanel';
import { SceneBoundary, SceneFailure } from './ui/SceneBoundary';
import { Modals } from './ui/Modals';
import { sceneView, shortcutFor } from './ui/logic';
import './App.css';

function lazyInit(): SimState {
  const saved = loadState();
  if (saved) return saved;
  // Primer arranque: estado limpio con el manual abierto.
  return { ...initState(SCENARIOS, 0), modal: { kind: 'manual' } };
}

/** Escritorio (>= 1100px): inspector abierto por defecto; en hoja inferior arranca plegado. */
const isWide = () => typeof window === 'undefined' || window.matchMedia('(min-width: 1100px)').matches;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [tier, setTier] = useState<QualityTier | null>(null);
  const [panel, setPanel] = useState<PanelId>('escena');
  const [inspectorOpen, setInspectorOpen] = useState(isWide);
  const [logOpen, setLogOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Persistir en cada cambio relevante.
  useEffect(() => { saveState(state); }, [state]);

  // Reloj de la escena: TICK cada segundo. Es no-op (mismo estado) cuando no hay
  // temporizador, la práctica está finalizada o el tiempo llegó a cero.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  // La escena avisa por evento de ventana cuando el navegador pierde el contexto WebGL.
  useEffect(() => {
    const onLost = () => setContextLost(true);
    window.addEventListener('scene:contextlost', onLost);
    return () => window.removeEventListener('scene:contextlost', onLost);
  }, []);

  const toggleForensic = useCallback(() => setView((v) => ({ ...v, forensicLight: !v.forensicLight })), []);
  const overview = useCallback(() => setView((v) => ({ ...v, overview: v.overview + 1 })), []);

  // Un solo keydown global; la decisión vive en shortcutFor (pura y probada):
  // ignora campos de texto y teclas repetidas, y Esc cierra el modal antes que nada.
  const modalOpen = state.modal !== null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const sc = shortcutFor({
        key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
        targetTag: t?.tagName, editable: !!t?.closest?.('[contenteditable=""],[contenteditable="true"]'),
        modalOpen,
      });
      if (!sc) return;
      e.preventDefault();
      if (sc === 'close-modal') dispatch({ type: 'CLOSE_MODAL' });
      else if (sc === 'overview') overview();
      else toggleForensic();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, overview, toggleForensic]);

  const go = (t: RailTarget) => {
    if (t === 'normativo') dispatch({ type: 'OPEN_MODAL', modal: { kind: 'manuals' } });
    else if (t === 'docente') dispatch({ type: 'OPEN_MODAL', modal: { kind: 'teacher' } });
    else if (t === 'manual') dispatch({ type: 'OPEN_MODAL', modal: { kind: 'manual' } });
    else if (inspectorOpen && panel === t && !isWide()) setInspectorOpen(false); // en hoja inferior, tocar el activo la pliega
    else { setPanel(t); setInspectorOpen(true); }
  };

  return (
    <div className={`app${inspectorOpen ? ' has-inspector' : ''}`}>
      {/* Visor 3D a pantalla completa, en su propio contexto de apilamiento: las
          etiquetas Html de drei (z-index enorme) nunca quedan por encima de la UI. */}
      <main className="viewport" aria-label="Escena 3D">
        <SceneBoundary>
          <Scene state={state} dispatch={dispatch} view={sceneView(view, modalOpen)} onTierChange={setTier} />
        </SceneBoundary>
      </main>

      <Rail active={inspectorOpen ? panel : null} onGo={go} />
      <TopBar
        state={state}
        dispatch={dispatch}
        forensicLight={view.forensicLight}
        onToggleForensic={toggleForensic}
        onOverview={overview}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((o) => !o)}
      />

      <div className="dock">
        <ProcedureStrip state={state} onDetail={() => { setPanel('procedimiento'); setInspectorOpen(true); }} />
        <ToolTray state={state} dispatch={dispatch} />
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
    </div>
  );
}
