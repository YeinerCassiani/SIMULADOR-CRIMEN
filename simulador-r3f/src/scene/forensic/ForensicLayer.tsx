// Capa forense de escena (contrato: ForensicLayerProps): cinta de cordón con
// postes, ruta de ingreso/salida con placas de paso, trípodes de luz de trabajo
// y manchas latentes del modo luz forense. Todo procedural y offline.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SpotLight, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { ForensicLayerProps, QualityTier } from '../contracts';
import type { EnvironmentType, EvidenceItem } from '../../types';
import { cordonLayout, tapeOffset, TAPE_HEIGHT } from './cordon';
import { routePath, routeSteps } from './route';
import { latentStains, type LatentStain } from './latent';
import { workLightPlacements, WORK_LIGHT_HEIGHT, type WorkLightPlacement } from './workLights';
import { workLightSettings, ACCENT } from './presentation';
import { tapeTexture, stainTexture, TAPE_WIDTH, TAPE_PERIOD } from './textures';
import { useReducedMotion } from './motion';

// ---------------------------------------------------------------- Cordón

/** Un tramo de cinta: plano subdividido con comba y ondulación por viento. */
function TapeSpan({ a, b, length, height, wind, phase }: { a: [number, number]; b: [number, number]; length: number; height: number; wind: number; phase: number }) {
  const segs = Math.max(8, Math.ceil(length * 5));
  // La geometría se crea y se deforma a través de la malla (ref): los hooks de
  // React no deben mutar valores que devuelven (regla react-hooks/immutability).
  const mesh = useRef<THREE.Mesh>(null);
  const base = useRef<Float32Array | null>(null);

  const apply = (t: number) => {
    const g = mesh.current?.geometry;
    if (!g || !base.current) return;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const b0 = base.current;
    for (let i = 0; i < pos.count; i++) {
      const x = b0[i * 3], y = b0[i * 3 + 1];
      const { sag, sway } = tapeOffset(x / length + 0.5, length, t, wind, phase);
      pos.setXYZ(i, x, y + sag, sway);
    }
    pos.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const g = new THREE.PlaneGeometry(length, TAPE_WIDTH, segs, 1);
    // U en metros / período: el texto conserva su proporción en cualquier tramo.
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * length) / TAPE_PERIOD);
    base.current = Float32Array.from((g.attributes.position as THREE.BufferAttribute).array);
    const m = mesh.current!;
    const old = m.geometry;
    m.geometry = g;
    old.dispose();
    return () => g.dispose();
  }, [length, segs]);
  // Pose inicial (comba) aunque no haya viento.
  useLayoutEffect(() => apply(0), [length, segs, wind]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((s) => { if (wind > 0) apply(s.clock.elapsedTime); });

  const mid: [number, number, number] = [(a[0] + b[0]) / 2, height, (a[1] + b[1]) / 2];
  const rotY = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  return (
    <mesh ref={mesh} position={mid} rotation={[0, rotY, 0]} castShadow>
      {/* Leve emisión: la cinta reflectiva se lee amarilla aun en la penumbra */}
      <meshStandardMaterial map={tapeTexture()} emissive="#ffffff" emissiveMap={tapeTexture()} emissiveIntensity={0.28} side={THREE.DoubleSide} roughness={0.55} metalness={0} />
    </mesh>
  );
}

/** Poste retráctil con base pesada (escenas cerradas y abiertas). */
function Stanchion({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.04, 20]} />
        <meshStandardMaterial color="#1d1e22" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.96, 12]} />
        <meshStandardMaterial color="#a9adb4" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.034, 0.06, 14]} />
        <meshStandardMaterial color="#1d1e22" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Cono de tránsito (vía pública): la cinta pasa por su cabeza. */
function TrafficCone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.03, 0.36]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.37, 0]} castShadow>
        <coneGeometry args={[0.14, 0.7, 20, 1, true]} />
        <meshStandardMaterial color="#e2571e" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.064, 0.085, 0.12, 20, 1, true]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.35} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cordon({ dims, env, animated }: { dims: { w: number; d: number }; env: EnvironmentType; animated: boolean }) {
  const layout = useMemo(() => cordonLayout(dims), [dims]);
  const cones = env === 'vial';
  const height = cones ? 0.66 : TAPE_HEIGHT;
  // Viento solo en exterior y sin prefers-reduced-motion.
  const wind = animated && env !== 'cerrado' ? 0.035 : 0;
  return (
    <group>
      {layout.posts.map(([x, z], i) => (cones ? <TrafficCone key={i} x={x} z={z} /> : <Stanchion key={i} x={x} z={z} />))}
      {layout.spans.map((s, i) => (
        <TapeSpan key={i} a={s.a} b={s.b} length={s.length} height={height} wind={wind} phase={i * 1.3} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- Ruta

const PLATE_W = 0.44, PLATE_D = 0.34, PLATE_T = 0.022, PLATE_Y = 0.07;

/** Placas de paso de protección (aluminio sobre patas) instanciadas. */
function RouteSteps({ env, items }: { env: EnvironmentType; items: EvidenceItem[] }) {
  const steps = useMemo(() => routeSteps(routePath(env), items), [env, items]);
  const plates = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const stripes = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    const local = new THREE.Vector3();
    steps.forEach((s, i) => {
      q.setFromEuler(e.set(0, s.rotY, 0));
      plates.current?.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, PLATE_Y, s.z), q, one));
      // Franja amarilla en el borde de avance (indica el sentido de la ruta).
      local.set(PLATE_W / 2 - 0.05, PLATE_Y + PLATE_T / 2 + 0.001, 0).applyQuaternion(q);
      stripes.current?.setMatrixAt(i, m.compose(new THREE.Vector3(s.x + local.x, local.y, s.z + local.z), q, one));
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], k) => {
        local.set(sx * (PLATE_W / 2 - 0.04), PLATE_Y / 2, sz * (PLATE_D / 2 - 0.04)).applyQuaternion(q);
        legs.current?.setMatrixAt(i * 4 + k, m.compose(new THREE.Vector3(s.x + local.x, PLATE_Y / 2, s.z + local.z), q, one));
      });
    });
    // Esfera envolvente desde las matrices: sin esto el frustum culling usa una
    // esfera obsoleta y las placas desaparecen en ciertos ángulos de cámara.
    for (const r of [plates, legs, stripes]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); }
  }, [steps]);

  if (!steps.length) return null;
  return (
    <group>
      <instancedMesh ref={plates} args={[undefined, undefined, steps.length]} castShadow receiveShadow>
        <boxGeometry args={[PLATE_W, PLATE_T, PLATE_D]} />
        <meshStandardMaterial color="#b9bcc0" metalness={0.85} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={stripes} args={[undefined, undefined, steps.length]}>
        <boxGeometry args={[0.06, 0.002, PLATE_D * 0.92]} />
        <meshStandardMaterial color={ACCENT} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, steps.length * 4]} castShadow>
        <cylinderGeometry args={[0.012, 0.016, PLATE_Y, 8]} />
        <meshStandardMaterial color="#2a2b2f" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------- Luces de trabajo

/** Trípode con foco LED. El foco (spotLight + haz volumétrico) es de esta capa. */
function WorkLight({ p, tier, forensicLight, reduced }: { p: WorkLightPlacement; tier: QualityTier; forensicLight: boolean; reduced: boolean }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const cfg = workLightSettings(tier, forensicLight);
  const head = useMemo(() => new THREE.Vector3(p.x, WORK_LIGHT_HEIGHT, p.z), [p.x, p.z]);
  const aim = useMemo(() => new THREE.Vector3(p.target[0], 0, p.target[1]), [p.target]);
  const dist = head.distanceTo(aim);
  // Orientación de la cabeza del foco hacia el centroide.
  const headRot = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(head);
    o.lookAt(aim);
    return o.rotation.clone();
  }, [head, aim]);
  const mid = head.clone().lerp(aim, 0.55);
  const legAngle = 0.32;

  return (
    <group>
      <primitive object={target} position={[p.target[0], 0, p.target[1]]} />
      {/* Trípode: tres patas abiertas, columna y cruceta */}
      <group position={[p.x, 0, p.z]}>
        {[0, 1, 2].map((k) => {
          const a = (k / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={k} position={[Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22]} rotation={[-Math.sin(a) * legAngle, 0, Math.cos(a) * legAngle]} castShadow>
              <cylinderGeometry args={[0.014, 0.018, 1.26, 8]} />
              <meshStandardMaterial color="#26272b" metalness={0.7} roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, (WORK_LIGHT_HEIGHT - 1.15) / 2 + 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.024, WORK_LIGHT_HEIGHT - 1.05, 10]} />
          <meshStandardMaterial color="#9ea2a8" metalness={1} roughness={0.32} />
        </mesh>
      </group>
      {/* Cabeza del foco: carcasa con panel LED emisivo (dispara el bloom) */}
      <group position={head} rotation={headRot}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.26, 0.12]} />
          <meshStandardMaterial color="#202125" metalness={0.5} roughness={0.45} />
        </mesh>
        {/* lookAt orienta +Z hacia el objetivo: el panel mira a +Z */}
        <mesh position={[0, 0, 0.062]}>
          <planeGeometry args={[0.28, 0.2]} />
          <meshStandardMaterial color="#fff6e0" emissive="#fff1d0" emissiveIntensity={forensicLight ? 0.3 : 3.2} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.16, 0.02]}>
          <boxGeometry args={[0.05, 0.08, 0.05]} />
          <meshStandardMaterial color="#26272b" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
      <SpotLight
        position={head}
        target={target}
        color="#fff1d6"
        intensity={cfg.intensity}
        angle={0.62}
        penumbra={0.65}
        distance={dist * 1.6}
        decay={1.6}
        castShadow={cfg.castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        volumetric
        attenuation={dist * 0.9}
        anglePower={5}
        radiusTop={0.1}
        opacity={cfg.beamOpacity}
      />
      {cfg.dust && (
        <Sparkles position={mid} count={36} scale={[1.6, 1.4, 1.6]} size={1.6} speed={reduced ? 0 : 0.18} opacity={0.45} color="#ffe7b8" noise={0.6} />
      )}
    </group>
  );
}

// ---------------------------------------------------------------- Manchas latentes

// Azul luminol con luminancia > 1 (supera el umbral 0.9 del Bloom en lineal).
const LATENT_COLOR = new THREE.Color(0.55, 1.6, 3.2);

function LatentStainMesh({ s, on }: { s: LatentStain; on: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  // Variación de intensidad por mancha (reales y señuelos comparten rango).
  const peak = 0.55 + ((s.seed % 1000) / 1000) * 0.4;
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m || !mesh.current) return;
    const goal = on ? peak : 0;
    m.opacity += (goal - m.opacity) * Math.min(1, dt * 3.5); // fundido suave ~0.6 s
    if (Math.abs(goal - m.opacity) < 0.002) m.opacity = goal;
    mesh.current.visible = m.opacity > 0.003; // no se dibuja en modo normal
  });
  return (
    <mesh ref={mesh} position={[s.x, 0.048, s.z]} rotation={[-Math.PI / 2, 0, s.rot]} visible={false} renderOrder={2}>
      <planeGeometry args={[s.r * 2, s.r * 2]} />
      <meshBasicMaterial
        ref={mat}
        map={stainTexture(s.seed)}
        color={LATENT_COLOR}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-6}
        polygonOffsetUnits={-6}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------- Capa

export function ForensicLayer({ state, view, tier }: ForensicLayerProps) {
  const { scenario, globals } = state;
  const reduced = useReducedMotion();
  const items = scenario.evidenceItems;
  const dims = scenario.dimensions;
  const stains = useMemo(() => latentStains(items, scenario.scenarioId, dims), [items, scenario.scenarioId, dims]);
  const lights = useMemo(() => workLightPlacements(items, dims), [items, dims]);

  return (
    <>
      {globals.cordon && <Cordon dims={dims} env={scenario.environmentType} animated={!reduced} />}
      {globals.route && <RouteSteps env={scenario.environmentType} items={items} />}
      {/* Cantidad de luces fija: siempre montadas, sin depender de la calidad. */}
      {lights.map((p, i) => <WorkLight key={i} p={p} tier={tier} forensicLight={view.forensicLight} reduced={reduced} />)}
      {stains.map((s, i) => <LatentStainMesh key={i} s={s} on={view.forensicLight} />)}
    </>
  );
}
