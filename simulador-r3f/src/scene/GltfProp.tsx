import { Suspense, Component, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';

type Vec3 = [number, number, number];

// Si el modelo falla (404, red, formato), se cae al prop procedural en vez de
// tumbar la escena. Mismo patrón defensivo que SafeEnvironment.
class GltfBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* se usa el fallback procedural */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Model({ url, scale, position, rotation }: { url: string; scale: number | Vec3; position?: Vec3; rotation?: Vec3 }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone(true)} scale={scale} position={position} rotation={rotation} />;
}

interface Props {
  /** URL del .glb/.gltf en /public (ej. '/models/lantern.glb'). */
  url: string;
  /** Prop procedural que se muestra mientras carga o si el modelo falla. */
  fallback: ReactNode;
  scale?: number | Vec3;
  position?: Vec3;
  rotation?: Vec3;
}

/**
 * Carga un modelo GLTF con degradación segura: mientras carga (o si falla) muestra
 * el `fallback` procedural. Permite reemplazar primitivas por modelos CC0 sin
 * arriesgar la estabilidad (la escena nunca queda en negro por un modelo).
 */
export function GltfProp({ url, fallback, scale = 1, position, rotation }: Props) {
  return (
    <GltfBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model url={url} scale={scale} position={position} rotation={rotation} />
      </Suspense>
    </GltfBoundary>
  );
}
