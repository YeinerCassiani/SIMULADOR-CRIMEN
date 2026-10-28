// Iluminación global de noche por ambiente + modo luz forense (spec §4.1).
// Reparto de luces (integración ola 3): los focos de trabajo en trípode (luz,
// haz y sombra) son de scene/forensic; las lámparas prácticas (colgantes, farol,
// lámpara de noche) son de scene/env; aquí solo lo global: ambiente, hemisférica,
// luna, clave direccional del interior, relleno cálido de muros y UV forense. Vive FUERA del <group key={scenarioId}> para que la transición del
// modo luz forense sobreviva al cambio de escenario.
//
// Presupuesto de sombras (cada mapa es un render de profundidad por frame): UNA
// direccional con sombra: 2048 en alta, 1024 en media, ninguna en baja
// (castShadow=false; ContactShadows da el contacto). Luz clave con sombra:
// direccional cálida casi cenital de la lámpara en interior; luna en exterior.
// El relleno de techo no proyecta sombra: ver NightPreset.lampShadow.
// Las luces con sombra llevan key={tier}: WebGLShadowMap solo reasigna el mapa si
// shadow.map === null, así que cambiar mapSize en caliente no tendría efecto.
import { memo, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, type Group, type Light } from 'three';
import type { Scenario } from '../../types';
import type { QualityTier } from '../contracts';
import { TIER_CONFIG } from './quality';
import { FORENSIC, damp, lerp, nightPreset } from './presets';

type Role = 'warm' | 'cool' | 'uv';

interface Props {
  scenario: Scenario;
  tier: QualityTier;
  forensicLight: boolean;
}

/** Fondo y niebla nocturnos del ambiente. */
export const Atmosphere = memo(function Atmosphere({ env }: { env: Scenario['environmentType'] }) {
  const p = nightPreset(env);
  return (
    <>
      <color attach="background" args={[p.background]} />
      <fog attach="fog" args={[p.background, p.fogNear, p.fogFar]} />
    </>
  );
});

export const SceneLighting = memo(function SceneLighting({ scenario, tier, forensicLight }: Props) {
  const p = nightPreset(scenario.environmentType);
  const cfg = TIER_CONFIG[tier];
  const { w, d } = scenario.dimensions;

  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const group = useRef<Group>(null);
  // Objetivos de los focos: deben estar en el grafo para que su matrixWorld se actualice.
  const ceilingTarget = useMemo(() => new Object3D(), []);

  // k: 0 = noche normal, 1 = luz forense. Amortiguado por frame, sin re-render React.
  const k = useRef(forensicLight ? 1 : 0);

  useFrame((_, dt) => {
    const kk = (k.current = damp(k.current, forensicLight ? 1 : 0, FORENSIC.tau, Math.min(dt, 0.1)));
    const g = group.current;
    if (g) {
      for (const child of g.children) {
        const light = child as Light;
        if (!light.isLight) continue;
        const role = light.userData.role as Role | undefined;
        const base = light.userData.base as number | undefined;
        if (role === undefined || base === undefined) continue;
        light.intensity = role === 'warm' ? base * lerp(1, FORENSIC.warm, kk)
          : role === 'cool' ? base * lerp(1, FORENSIC.cool, kk)
          : base * kk; // 'uv' nace de 0 (se mantiene montada: cambiar el número de luces recompila shaders)
      }
    }
    // Exposición del ToneMapping del composer (la toma de gl.toneMappingExposure) e IBL.
    gl.toneMappingExposure = p.exposure * lerp(1, FORENSIC.exposure, kk);
    scene.environmentIntensity = p.envIntensity * lerp(1, FORENSIC.env, kk);
  });

  const moonDist = 30;
  const half = Math.max(w, d) * 0.7;
  const moonPos: [number, number, number] = [p.moon.dir[0] * moonDist, p.moon.dir[1] * moonDist, p.moon.dir[2] * moonDist];
  const moonShadow = p.moon.castShadow && cfg.shadows;

  return (
    <group ref={group}>
      <ambientLight color={p.ambient.color} intensity={p.ambient.intensity} userData={{ role: 'cool', base: p.ambient.intensity }} />
      <hemisphereLight args={[p.hemisphere.sky, p.hemisphere.ground, p.hemisphere.intensity]} userData={{ role: 'cool', base: p.hemisphere.intensity }} />
      {/* Luz ambiental violeta-azul del modo forense (0 fuera de él). */}
      <ambientLight color={FORENSIC.uvColor} intensity={0} userData={{ role: 'uv', base: FORENSIC.uvIntensity }} />

      {/* Luna: clave con sombra en exterior, relleno débil sin sombra en interior (entra por la ventana). */}
      <directionalLight
        key={moonShadow ? `moon-${tier}` : 'moon'}
        position={moonPos}
        color={p.moon.color}
        intensity={p.moon.intensity}
        userData={{ role: 'cool', base: p.moon.intensity }}
        castShadow={moonShadow}
        shadow-mapSize={[cfg.shadowMapSize, cfg.shadowMapSize]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={moonDist * 2.2}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />

      {/* Clave con sombra del interior: luz cálida de la lámpara, casi cenital. */}
      {p.lampShadow && (
        <directionalLight
          key={`lamp-${tier}`}
          position={[p.lampShadow.dir[0] * moonDist, p.lampShadow.dir[1] * moonDist, p.lampShadow.dir[2] * moonDist]}
          color={p.lampShadow.color}
          intensity={p.lampShadow.intensity}
          userData={{ role: 'warm', base: p.lampShadow.intensity }}
          castShadow={cfg.shadows}
          shadow-mapSize={[cfg.shadowMapSize, cfg.shadowMapSize]}
          shadow-camera-left={-half}
          shadow-camera-right={half}
          shadow-camera-top={half}
          shadow-camera-bottom={-half}
          shadow-camera-near={1}
          shadow-camera-far={moonDist * 2}
          shadow-bias={-0.0003}
          shadow-normalBias={0.03}
          shadow-radius={4}
        />
      )}

      {/* Baño de muros del interior: sin sombra, desde el lado de la cámara. */}
      {p.wallWash && (
        <directionalLight
          position={[p.wallWash.dir[0] * moonDist, p.wallWash.dir[1] * moonDist, p.wallWash.dir[2] * moonDist]}
          color={p.wallWash.color}
          intensity={p.wallWash.intensity}
          userData={{ role: 'warm', base: p.wallWash.intensity }}
        />
      )}

      {/* Relleno cálido amplio del interior (no es una lámpara visible: las colgantes
          son de env). Baña piso y muros para que no se hundan en negro; sin sombra. */}
      {p.ceiling && (
        <>
          <primitive object={ceilingTarget} position={[p.ceiling.position[0], 0, p.ceiling.position[2]]} />
          <spotLight
            position={p.ceiling.position}
            target={ceilingTarget}
            color={p.ceiling.color}
            intensity={p.ceiling.intensity}
            userData={{ role: 'warm', base: p.ceiling.intensity }}
            angle={p.ceiling.angle}
            penumbra={p.ceiling.penumbra}
            decay={2}
            distance={16}
          />
        </>
      )}

    </group>
  );
});
