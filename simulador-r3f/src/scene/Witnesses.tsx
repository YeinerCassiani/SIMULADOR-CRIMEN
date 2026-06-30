import { useRef, useState, type Dispatch } from 'react';
import { Html, Outlines } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { Action, SimState } from '../simulator';
import type { Witness, WitnessState } from '../types';

const SKIN = ['#e8b48c', '#c98a5e', '#f1c9a5'];
const HAIR = ['#3a2c22', '#15110d', '#5c4326'];
const PANTS = ['#3a4252', '#4a3b2e', '#27313f'];

// Humanoide low-poly (cabeza con pelo, torso/camisa, brazos y piernas).
// El color de la CAMISA codifica el estado del testigo (gris→sin gestionar,
// verde→separado, azul→entrevistado) para conservar la señal pedagógica.
function Person({ witness, ws, position, index, dispatch }: { witness: Witness; ws: WitnessState; position: [number, number, number]; index: number; dispatch: Dispatch<Action> }) {
  const [hovered, setHovered] = useState(false);
  const shirt = ws.interviewed ? '#2563eb' : ws.separated ? '#16a34a' : '#94a0b4';
  const skin = SKIN[index % SKIN.length];
  const hair = HAIR[index % HAIR.length];
  const pants = PANTS[index % PANTS.length];
  const status = ws.interviewed ? 'Entrevistado' : ws.separated ? 'Separado' : 'Sin gestionar';
  const emissive = hovered ? '#1d4ed8' : '#000000';
  const emissiveIntensity = hovered ? 0.35 : 0;

  const onClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); dispatch({ type: 'WITNESS_ACTION', id: witness.id }); };

  // Idle procedural: leve balanceo (sin assets ni animación esqueletal).
  const ref = useRef<Group>(null);
  useFrame((s) => { if (ref.current) ref.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.8 + index) * 0.025; });

  return (
    <group
      ref={ref}
      position={position}
      onClick={onClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* Piernas */}
      <mesh position={[-0.12, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 12]} />
        <meshStandardMaterial color={pants} roughness={0.85} />
      </mesh>
      <mesh position={[0.12, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 12]} />
        <meshStandardMaterial color={pants} roughness={0.85} />
      </mesh>

      {/* Torso (camisa = estado) */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.4, 6, 14]} />
        <meshStandardMaterial color={shirt} roughness={0.7} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        {hovered && <Outlines thickness={0.02} color="#4ec1ff" />}
      </mesh>

      {/* Brazos */}
      <mesh position={[-0.29, 1.06, 0]} rotation={[0, 0, 0.22]} castShadow>
        <capsuleGeometry args={[0.07, 0.46, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.7} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh position={[0.29, 1.06, 0]} rotation={[0, 0, -0.22]} castShadow>
        <capsuleGeometry args={[0.07, 0.46, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.7} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>

      {/* Cuello */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>

      {/* Cabeza */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>

      {/* Pelo (casquete superior) */}
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.182, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={hair} roughness={0.95} />
      </mesh>

      <Html position={[0, 2.0, 0]} center distanceFactor={16} pointerEvents="none">
        <div className="witness-tag"><strong>{witness.name}</strong><br />{status}</div>
      </Html>
    </group>
  );
}

export function Witnesses({ state, dispatch }: { state: SimState; dispatch: Dispatch<Action> }) {
  const list = state.scenario.witnesses || [];
  const { d } = state.scenario.dimensions;
  const n = list.length;
  return (
    <group>
      {list.map((witness, i) => {
        // Distribuidos junto a un borde de la escena (zona de testigos).
        const x = (i - (n - 1) / 2) * 2.6;
        const z = d / 2 + 1.5;
        return (
          <Person key={witness.id} witness={witness} ws={state.witnesses[witness.id]} position={[x, 0, z]} index={i} dispatch={dispatch} />
        );
      })}
    </group>
  );
}
