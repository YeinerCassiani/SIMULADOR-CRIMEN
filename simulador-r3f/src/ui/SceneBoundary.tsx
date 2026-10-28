import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MonitorX, RefreshCw } from 'lucide-react';

// Aviso cuando la vista 3D no puede seguir (error del Canvas o contexto WebGL perdido).
// La práctica sigue guardada en localStorage, así que recargar no pierde el progreso.
export function SceneFailure({ reason }: { reason: 'error' | 'contextlost' }) {
  return (
    <div className="scene-fail" role="alert">
      <MonitorX size={20} strokeWidth={1.5} aria-hidden="true" />
      <div>
        <p className="scene-fail-title">{reason === 'contextlost' ? 'La vista 3D se detuvo' : 'La vista 3D falló'}</p>
        <p className="meta">
          {reason === 'contextlost'
            ? 'El navegador liberó el contexto gráfico (WebGL). Su práctica está guardada: recargue para continuar.'
            : 'Ocurrió un error al dibujar la escena. Su práctica está guardada: recargue para continuar.'}
        </p>
      </div>
      <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
        <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" /> Recargar
      </button>
    </div>
  );
}

interface State { failed: boolean }

/** ErrorBoundary alrededor de <Scene>: un error del Canvas nunca deja la página en blanco. */
export class SceneBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SceneBoundary] la vista 3D falló:', error, info.componentStack);
  }

  render() {
    return this.state.failed ? <SceneFailure reason="error" /> : this.props.children;
  }
}
