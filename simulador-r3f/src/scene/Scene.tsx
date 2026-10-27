import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, ContactShadows, Stats, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { riskOfTool } from '../simulator';
import type { SceneProps } from './contracts';
import { SceneEnvironment } from './env/SceneEnvironment';
import { ForensicLayer } from './forensic/ForensicLayer';
import { Evidence } from './Evidence';
import { Witnesses } from './Witnesses';

// Medición de rendimiento opt-in: añadir ?perf a la URL muestra el panel de FPS
// (stats.js vía drei <Stats>). Desactivado por defecto para no consumir frame budget.
const SHOW_PERF = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');

export function Scene({ state, dispatch, view }: SceneProps) {
  const tier = 'alta' as const;
  const { scenario, evidence, selectedEvidenceId, selectedTool } = state;
  const closed = scenario.environmentType === 'cerrado';

  const handleSelect = (id: string) => {
    if (selectedTool) {
      const warnings = riskOfTool(selectedTool, id, state);
      if (warnings.length) dispatch({ type: 'OPEN_MODAL', modal: { kind: 'confirm', evidenceId: id, tool: selectedTool, warnings } });
      else dispatch({ type: 'APPLY_TOOL', id });
    } else dispatch({ type: 'SELECT_EVIDENCE', id });
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [12, 11, 14], fov: 45, near: 1, far: 150 }}
      onPointerMissed={() => dispatch({ type: 'SELECT_EVIDENCE', id: null })}
    >
      <color attach="background" args={[closed ? '#070d17' : '#0a1626']} />
      <fog attach="fog" args={[closed ? '#070d17' : '#0a1626', 30, 65]} />

      {/* Iluminación: ambiente + clave direccional con sombras + relleno frío.
          (Se evita drei <SoftShadows>: su parcheo global del shader dejaba la
          escena en negro al cambiar de escenario; las sombras PCF por defecto
          del renderer son fiables ante actualizaciones.) */}
      <ambientLight intensity={closed ? 0.45 : 0.6} />
      <hemisphereLight args={[closed ? '#cdd6e6' : '#bfe0ff', '#1a2230', 0.5]} />
      <directionalLight
        position={[10, 16, 8]}
        intensity={closed ? 1.5 : 2.0}
        color={closed ? '#fff4e6' : '#fff'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} color="#9db4ff" />

      {/* Entorno para reflejos PBR generado localmente (sin HDRI externo).
          No depende de internet ni suspende: cambiar de escenario nunca deja el
          canvas en negro, y los materiales metálicos reciben reflejos. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={closed ? 1.4 : 1.8} color={closed ? '#fff3e0' : '#dbeeff'} scale={[12, 12, 1]} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color="#aac4ff" scale={[8, 6, 1]} position={[-9, 4, -7]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="circle" intensity={0.9} color="#ffffff" scale={6} position={[9, 5, 7]} rotation={[0, -Math.PI / 4, 0]} />
      </Environment>

      {/* key por escenario: remontaje limpio al cambiar de escenario. */}
      <group key={scenario.scenarioId}>
        <SceneEnvironment scenario={scenario} tier={tier} forensicLight={view.forensicLight} />
        <ForensicLayer state={state} view={view} tier={tier} />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={40} blur={2.5} far={6} />

        {scenario.evidenceItems.map((item) => (
          <Evidence
            key={item.id}
            item={item}
            state={evidence[item.id]}
            selected={selectedEvidenceId === item.id}
            onSelect={handleSelect}
            view={view}
            tier={tier}
          />
        ))}

        <Witnesses state={state} dispatch={dispatch} />
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.5, 0]}
      />

      {/* Brújula de orientación 3D */}
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#4ec1ff']} labelColor="#0b1220" />
      </GizmoHelper>

      {/* Postproceso: bloom solo sobre lo realmente luminoso (pantalla del celular,
          farol, marcadores) + viñeta sutil. Umbral alto para no lavar la escena. */}
      <EffectComposer>
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.9} luminanceSmoothing={0.25} />
        <Vignette eskil={false} offset={0.28} darkness={0.5} />
      </EffectComposer>

      {/* Panel de FPS opt-in (?perf en la URL). Sin dependencia nueva: drei ya trae Stats. */}
      {SHOW_PERF && <Stats />}
    </Canvas>
  );
}
