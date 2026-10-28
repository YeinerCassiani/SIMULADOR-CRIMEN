import { Suspense, Component, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';

type Vec3 = [number, number, number];

/**
 * Frontera de error para cualquier asset que suspende (GLTF, texturas): si la
 * carga falla (404, red, formato) se muestra el `fallback` en vez de tumbar el
 * árbol R3F. Suspense solo cubre "cargando"; el fallo lo atrapa esta frontera.
 */
export class AssetBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* se usa el fallback procedural */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Materiales del GLB (por nombre) que deben brillar: bombillas para el bloom. */
export type EmissiveOverrides = Record<string, { color: string; intensity: number }>;

interface ModelProps {
  url: string;
  scale: number | Vec3;
  position?: Vec3;
  rotation?: Vec3;
  shadows: boolean;
  emissive?: EmissiveOverrides;
}

function Model({ url, scale, position, rotation, shadows, emissive }: ModelProps) {
  const { scene } = useGLTF(url);
  // Clon memoizado: Scene se re-renderiza en cada TICK; clonar en el cuerpo del
  // render creaba un Object3D nuevo por render y R3F cambiaba el primitive.
  // clone(true) comparte geometrías y materiales (un modelo repetido no duplica GPU).
  const { obj, owned } = useMemo(() => {
    const c = scene.clone(true);
    const replaced = new Map<Material, Material>();
    c.traverse((o: Object3D) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      if (!emissive) return;
      const mat = mesh.material as MeshStandardMaterial;
      const ov = mat && !Array.isArray(mat) ? emissive[mat.name] : undefined;
      if (!ov) return;
      // Material propio del clon: no tocar el compartido de la caché de useGLTF.
      let m = replaced.get(mat) as MeshStandardMaterial | undefined;
      if (!m) {
        m = mat.clone();
        m.emissive = new Color(ov.color);
        m.emissiveIntensity = ov.intensity;
        m.toneMapped = true;
        replaced.set(mat, m);
      }
      mesh.material = m;
    });
    return { obj: c, owned: [...replaced.values()] };
  }, [scene, shadows, emissive]);
  // Los materiales emisivos clonados son de este montaje: se liberan al desmontar.
  useEffect(() => () => owned.forEach((m) => m.dispose()), [owned]);
  return <primitive object={obj} scale={scale} position={position} rotation={rotation} />;
}

interface Props {
  /** URL del .glb en /public (ej. '/assets/models/Sofa_01.glb'). Sin Draco: useGLTF(url) sin decoder. */
  url: string;
  /** Prop procedural que se muestra si el modelo falla (mientras carga no se dibuja nada). */
  fallback: ReactNode;
  scale?: number | Vec3;
  position?: Vec3;
  rotation?: Vec3;
  /** Las mallas del modelo proyectan sombra (siempre la reciben). */
  shadows?: boolean;
  /** Materiales a volver emisivos por nombre (referencia estable: constante de módulo). */
  emissive?: EmissiveOverrides;
}

/**
 * Carga un modelo GLTF con degradación segura: si falla muestra el `fallback`
 * procedural. Mientras carga no dibuja nada (integración: las cajas de respaldo
 * de 1-4 m aparecían iluminadas por los focos durante la carga y eran el peor
 * cuadro de la experiencia); la escena se completa en su sitio al llegar el .glb. Permite reemplazar primitivas por modelos CC0 sin
 * arriesgar la estabilidad (la escena nunca queda en negro por un modelo).
 */
export function GltfProp({ url, fallback, scale = 1, position, rotation, shadows = true, emissive }: Props) {
  return (
    <AssetBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <Model url={url} scale={scale} position={position} rotation={rotation} shadows={shadows} emissive={emissive} />
      </Suspense>
    </AssetBoundary>
  );
}
