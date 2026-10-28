// Límite de error mínimo para recursos de render (HDRI). Un recurso que falla cae
// al fallback; nunca relanza hacia el ErrorBoundary raíz de R3F (que tumbaría la app).
import { Component, type ReactNode } from 'react';

interface Props { fallback: ReactNode; children: ReactNode; label?: string }
interface State { failed: boolean }

export class RenderErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[render] ${this.props.label ?? 'recurso'} no cargó; se usa el respaldo.`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
