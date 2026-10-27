import { useEffect, useReducer, useState } from 'react';
import { reducer, initState, type SimState } from './simulator';
import { SCENARIOS } from './data/scenarios';
import { loadState, saveState } from './persistence';
import { Scene } from './scene/Scene';
import { DEFAULT_VIEW, type ViewSettings } from './scene/contracts';
import { Hud } from './ui/Hud';
import { Modals } from './ui/Modals';
import './App.css';

function lazyInit(): SimState {
  const saved = loadState();
  if (saved) return saved;
  // Primer arranque: estado limpio con el manual abierto.
  return { ...initState(SCENARIOS, 0), modal: { kind: 'manual' } };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit);
  const [view] = useState<ViewSettings>(DEFAULT_VIEW);

  // Persistir en cada cambio relevante.
  useEffect(() => { saveState(state); }, [state]);

  // Reloj de la escena: TICK cada segundo. Es no-op (mismo estado) cuando no hay
  // temporizador, la práctica está finalizada o el tiempo llegó a cero.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Simulador 3D de Investigación Judicial y Cadena de Custodia</h1>
          <div className="subtitle">{state.scenario.title}</div>
        </div>
        <div className="badge">React Three Fiber</div>
      </header>

      <Hud state={state} dispatch={dispatch} />

      <main className="scene-wrap">
        <Scene state={state} dispatch={dispatch} view={view} />
        <div className="hud-top">
          <span className="hud-chip">Herramienta: {state.selectedTool ?? 'ninguna'}</span>
          <span className="hud-chip">EMP/EF: {state.selectedEvidenceId ?? 'ninguno'}</span>
        </div>
      </main>

      <Modals state={state} dispatch={dispatch} />
    </div>
  );
}
