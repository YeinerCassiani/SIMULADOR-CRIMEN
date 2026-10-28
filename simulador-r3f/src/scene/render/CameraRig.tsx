// Cámara (spec §4.1): drei CameraControls (makeDefault: GizmoHelper la necesita en
// state.controls), vuelo de entrada al montar y al cambiar de escenario, encuadre
// del EMP/EF seleccionado y regreso a la vista general cuando view.overview cambia.
//
// - prefers-reduced-motion → cortes (enableTransition=false), se consulta en cada movimiento.
// - Nunca roba el control: si el usuario está arrastrando (currentAction ≠ NONE) el
//   movimiento automático se descarta.
// - Paneles de la UI: el centro óptico se desplaza (camera.setViewOffset) al centro
//   del área libre. Márgenes: --scene-inset-* si la UI los publica; si no, se deducen
//   de --rail-w/--top-h/--insp/--tray-h y del rectángulo del lienzo (parseInsets).
//   Así el EMP/EF encuadrado no queda bajo el inspector y el raycasting sigue exacto.
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { CameraControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Vector3, type PerspectiveCamera } from 'three';
import type { EvidenceItem, Scenario } from '../../types';
import { CAMERA_LIMITS, NO_INSETS, entryPose, framingPose, overviewPose, parseInsets, viewOffsetFor, type CameraPose, type SceneInsets } from './presets';

/** Tiempo de amortiguación de los vuelos: con 0.45 s el vuelo asienta en ~1.6 s. */
const FLIGHT_SMOOTH_TIME = 0.45;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function readInsets(el: HTMLElement | null): SceneInsets {
  if (typeof document === 'undefined' || !el) return NO_INSETS;
  // Estilo calculado del propio lienzo: hereda las variables puestas en .app o :root.
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return parseInsets((n) => cs.getPropertyValue(n), rect, { width: window.innerWidth, height: window.innerHeight });
}

const sameInsets = (a: SceneInsets, b: SceneInsets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

/**
 * Márgenes de los paneles de la UI sobre el lienzo. Se releen al redimensionar, con
 * window 'scene:insets' y cada 500 ms (plegar el inspector cambia una clase, no el
 * tamaño de la ventana); getComputedStyle cada 500 ms es despreciable.
 */
function useSceneInsets(): SceneInsets {
  const el = useThree((s) => s.gl.domElement);
  const [insets, setInsets] = useState<SceneInsets>(NO_INSETS);
  useEffect(() => {
    const update = () => setInsets((prev) => {
      const next = readInsets(el);
      return sameInsets(prev, next) ? prev : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('scene:insets', update);
    const id = window.setInterval(update, 500);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scene:insets', update);
      window.clearInterval(id);
    };
  }, [el]);
  return insets;
}

/** Cámara + brújula, que comparten los márgenes de la UI (debe ir dentro del Canvas). */
export function ViewportRig(props: Omit<Props, 'insets'>) {
  const insets = useSceneInsets();
  return (
    <>
      <CameraRig {...props} insets={insets} />
      <OrientationGizmo insets={insets} />
    </>
  );
}

interface Props {
  scenario: Scenario;
  selected: EvidenceItem | null;
  overview: number;
  insets: SceneInsets;
}

export const CameraRig = memo(function CameraRig({ scenario, selected, overview, insets }: Props) {
  const controls = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const go = (pose: CameraPose, transition: boolean) => {
    const c = controls.current;
    if (!c) return;
    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;
    void c.setLookAt(px, py, pz, tx, ty, tz, transition && !reducedMotion());
  };
  const userDragging = () => (controls.current?.currentAction ?? 0) !== 0;

  // Centro óptico desplazado al área libre. Se reaplica al cambiar tamaño o paneles
  // (R3F actualiza aspect al redimensionar pero no conoce el view offset).
  useLayoutEffect(() => {
    const off = viewOffsetFor(insets, size.width, size.height);
    if (off) camera.setViewOffset(size.width, size.height, off.x, off.y, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, insets, size.width, size.height]);
  useEffect(() => () => { camera.clearViewOffset(); camera.updateProjectionMatrix(); }, [camera]);

  // Vuelo de entrada: al montar y en cada cambio de escenario.
  const dims = scenario.dimensions;
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.smoothTime = FLIGHT_SMOOTH_TIME;
    if (reducedMotion()) {
      go(overviewPose(dims), false);
      return;
    }
    go(entryPose(dims), false);
    // Un frame después, para que el salto inicial no se mezcle con el vuelo.
    const id = requestAnimationFrame(() => go(overviewPose(dims), true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.scenarioId]);

  // Encuadre del EMP/EF seleccionado.
  useEffect(() => {
    if (!selected || userDragging()) return;
    const c = controls.current;
    if (!c) return;
    const p = c.getPosition(new Vector3());
    go(framingPose(selected, [p.x, p.y, p.z]), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Vista general bajo demanda (Esc / botón): cada incremento del contador.
  const firstOverview = useRef(overview);
  useEffect(() => {
    if (overview === firstOverview.current || userDragging()) return;
    go(overviewPose(dims), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
      smoothTime={FLIGHT_SMOOTH_TIME}
      draggingSmoothTime={0.12}
    />
  );
});

/**
 * Brújula de orientación. Con la UI a pantalla completa, abajo-derecha caía bajo la
 * bitácora/inspector: va arriba-derecha, por debajo de la barra superior y a la
 * izquierda del inspector (según los insets), y se oculta en < 1100 px, donde el
 * inspector pasa a hoja inferior y no queda sitio.
 */
export const OrientationGizmo = memo(function OrientationGizmo({ insets }: { insets: SceneInsets }) {
  const width = useThree((s) => s.size.width);
  if (width < 1100) return null;
  return (
    // renderPriority 2: después del EffectComposer (1); si no, el composer la tapa.
    <GizmoHelper alignment="top-right" margin={[insets.right + 56, insets.top + 56]} renderPriority={2}>
      <GizmoViewport axisColors={['#e5566f', '#44a282', '#6d9eff']} labelColor="#131217" />
    </GizmoHelper>
  );
});
