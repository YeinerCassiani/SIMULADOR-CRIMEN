import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { ContactShadows, Stats } from '@react-three/drei';
import { NoToneMapping } from 'three';
import { riskOfTool } from '../simulator';
import type { QualityTier, SceneProps } from './contracts';
import { SceneEnvironment } from './env/SceneEnvironment';
import { ForensicLayer } from './forensic/ForensicLayer';
import { Evidence } from './Evidence';
import { Witnesses } from './Witnesses';
import { initialTier, probeDevice, TIER_CONFIG } from './render/quality';
import { Atmosphere, SceneLighting } from './render/Lighting';
import { SceneHdri } from './render/SceneHdri';
import { PostFx } from './render/PostFx';
import { ViewportRig } from './render/CameraRig';
import { PerfProbe, QualityMonitor } from './render/Monitors';

// Medición de rendimiento opt-in: añadir ?perf a la URL muestra stats.js (drei <Stats>)
// y el rótulo de draw calls/triángulos/nivel. window.__scenePerf se publica siempre.
const SEARCH = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const SHOW_PERF = SEARCH.has('perf');
// ?quality=alta|media|baja fija el nivel cuando la UI está en 'auto' (medición y eval).
const URL_QUALITY = ((q) => (q === 'alta' || q === 'media' || q === 'baja' ? q : null))(SEARCH.get('quality'));

// Constantes de módulo: el Canvas se reconfigura en cada render (y Scene se
// re-renderiza cada segundo por TICK); objetos estables evitan trabajo inútil.
// Un solo tone mapping: el del EffectComposer (ACES Filmic). antialias lo hace SMAA.
const GL_PROPS = { toneMapping: NoToneMapping, antialias: false, powerPreference: 'high-performance' } as const;
// near >= 1: corrige el z-fighting de los planos casi coplanares (no volver a 0.1).
const CAMERA_PROPS = { position: [12, 11, 14] as [number, number, number], fov: 45, near: 1, far: 150 };

/** Pérdida de contexto WebGL: aviso en consola y evento para que la UI ofrezca recargar. */
function handleCreated({ gl }: RootState) {
  const canvas = gl.domElement;
  canvas.addEventListener('webglcontextlost', () => {
    console.warn('[render] Contexto WebGL perdido.');
    window.dispatchEvent(new CustomEvent('scene:contextlost'));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    window.dispatchEvent(new CustomEvent('scene:contextrestored'));
  });
}

export function Scene({ state, dispatch, view, onTierChange }: SceneProps) {
  const [autoTier, setAutoTier] = useState<QualityTier>(() => initialTier(probeDevice()));
  const quality = view.quality === 'auto' && URL_QUALITY ? URL_QUALITY : view.quality;
  const tier: QualityTier = quality === 'auto' ? autoTier : quality;
  const cfg = TIER_CONFIG[tier];
  const { scenario, evidence, selectedEvidenceId, selectedTool } = state;
  const closed = scenario.environmentType === 'cerrado';
  const selectedItem = scenario.evidenceItems.find((i) => i.id === selectedEvidenceId) ?? null;

  // onTierChange puede llegar como lambda nueva en cada render: se guarda en ref y
  // solo se notifica cuando el nivel efectivo cambia.
  const tierCb = useRef(onTierChange);
  useEffect(() => { tierCb.current = onTierChange; });
  useEffect(() => { tierCb.current?.(tier); }, [tier]);

  const onAutoTier = useCallback((t: QualityTier) => setAutoTier(t), []);

  const handleSelect = (id: string) => {
    if (selectedTool) {
      const warnings = riskOfTool(selectedTool, id, state);
      if (warnings.length) dispatch({ type: 'OPEN_MODAL', modal: { kind: 'confirm', evidenceId: id, tool: selectedTool, warnings } });
      else dispatch({ type: 'APPLY_TOOL', id });
    } else dispatch({ type: 'SELECT_EVIDENCE', id });
  };

  return (
    <Canvas
      // PCF (no PCFSoft: three 0.184 lo marca obsoleto y avisa en cada reconfiguración).
      shadows="percentage"
      dpr={cfg.dpr}
      gl={GL_PROPS}
      camera={CAMERA_PROPS}
      onCreated={handleCreated}
      onPointerMissed={() => dispatch({ type: 'SELECT_EVIDENCE', id: null })}
    >
      <Atmosphere env={scenario.environmentType} />

      {/* Luces de noche, focos de trabajo y modo luz forense (no usar drei <SoftShadows>:
          su parcheo global del shader dejaba la escena en negro al cambiar de escenario). */}
      <SceneLighting scenario={scenario} tier={tier} forensicLight={view.forensicLight} />

      {/* IBL local con respaldo de Lightformer (nunca `preset`: CDN → canvas negro). */}
      <SceneHdri closed={closed} />

      {/* key por escenario: remontaje limpio al cambiar de escenario. */}
      <group key={scenario.scenarioId}>
        <SceneEnvironment scenario={scenario} tier={tier} forensicLight={view.forensicLight} />
        <ForensicLayer state={state} view={view} tier={tier} />
        {/* Contacto barato donde no hay N8AO a resolución completa. */}
        {cfg.contactShadows && <ContactShadows position={[0, 0.02, 0]} opacity={0.45} scale={40} blur={2.5} far={6} resolution={256} />}

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

        <Witnesses state={state} dispatch={dispatch} view={view} tier={tier} />
      </group>

      {/* Cámara (CameraControls) y brújula; ambas respetan los paneles de la UI. */}
      <ViewportRig scenario={scenario} selected={selectedItem} overview={view.overview} />

      <PostFx tier={tier} />

      {quality === 'auto' && <QualityMonitor tier={autoTier} onTier={onAutoTier} />}
      <PerfProbe tier={tier} show={SHOW_PERF} />
      {SHOW_PERF && <Stats />}
    </Canvas>
  );
}
