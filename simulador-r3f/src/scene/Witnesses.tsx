import { useRef, useState, type CSSProperties } from 'react';
import { Html, Outlines } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { Witness, WitnessState } from '../types';
import { DEFAULT_VIEW, type WitnessesProps } from './contracts';
import { ACCENT, POSITIVE, LABEL_Z_RANGE, labelsVisible } from './forensic/presentation';
import { useReducedMotion } from './forensic/motion';

// Props: WitnessesProps en contracts.ts.

// Paletas apagadas: cada testigo viste distinto. El estado ya no se codifica
// con la camisa sino con el disco del piso y la etiqueta (texto + color).
const SKIN = ['#d9a382', '#a8714f', '#e8c1a0', '#8a5a3c'];
const HAIR = ['#2e241c', '#121010', '#5a4330', '#3b3631'];
const TOPS = ['#5d6857', '#6a5650', '#4d5a6b', '#7a6b52'];
const PANTS = ['#2e333d', '#3a332b', '#2a2e29', '#41454d'];
const SHOES = '#1a1a1c';
const WARN = '#d9a441';

function statusOf(ws: WitnessState) {
  if (ws.interviewed) return { text: 'Entrevistado', color: POSITIVE };
  if (ws.separated) return { text: 'Separado', color: WARN };
  return { text: 'Sin gestionar', color: '#8a8c92' };
}

const tagStyle: CSSProperties = {
  background: '#131217', color: '#ffffff', border: '1px solid #2c2b30', borderRadius: 6,
  padding: '3px 8px', fontSize: 11, lineHeight: 1.3, whiteSpace: 'nowrap', textAlign: 'center',
  fontFamily: '"Public Sans Variable", system-ui, sans-serif',
};

// Maniquí proporcionado (~1.72 m): pies, piernas en dos tramos, cadera, torso
// cónico, hombros, brazos en dos tramos con manos, cuello y cabeza con pelo.
function Person({ witness, ws, position, index, dispatch, showLabel, reduced }: {
  witness: Witness; ws: WitnessState; position: [number, number, number]; index: number;
  dispatch: WitnessesProps['dispatch']; showLabel: boolean; reduced: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const skin = SKIN[index % SKIN.length];
  const hair = HAIR[(index + 1) % HAIR.length];
  const top = TOPS[index % TOPS.length];
  const pants = PANTS[index % PANTS.length];
  const status = statusOf(ws);

  const onClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); dispatch({ type: 'WITNESS_ACTION', id: witness.id }); };

  // Idle procedural: balanceo leve y respiración (congelados con prefers-reduced-motion).
  const ref = useRef<Group>(null);
  const chest = useRef<Mesh>(null);
  useFrame((s) => {
    if (reduced) return;
    const t = s.clock.elapsedTime;
    if (ref.current) ref.current.rotation.z = Math.sin(t * 0.8 + index) * 0.02;
    if (chest.current) chest.current.scale.x = 1 + Math.sin(t * 1.6 + index) * 0.012;
  });

  const cloth = (color: string, roughness = 0.9) => <meshStandardMaterial color={color} roughness={roughness} metalness={0} />;
  const skinMat = <meshStandardMaterial color={skin} roughness={0.6} />;

  return (
    <group position={position}>
      {/* Disco de estado en el piso (no gira con el balanceo) */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.4, 48]} />
        <meshBasicMaterial color={hovered ? ACCENT : status.color} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>
      <group
        ref={ref}
        rotation={[0, Math.PI, 0]} /* de frente a la escena */
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.1, 0, 0]}>
            {/* Zapato */}
            <mesh position={[0, 0.035, 0.04]} castShadow>
              <boxGeometry args={[0.1, 0.07, 0.26]} />
              {cloth(SHOES, 0.5)}
            </mesh>
            {/* Pierna y muslo */}
            <mesh position={[0, 0.27, 0]} castShadow>
              <capsuleGeometry args={[0.058, 0.34, 4, 12]} />
              {cloth(pants)}
            </mesh>
            <mesh position={[0, 0.66, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.34, 4, 12]} />
              {cloth(pants)}
            </mesh>
          </group>
        ))}

        {/* Cadera */}
        <mesh position={[0, 0.92, 0]} scale={[1, 1, 0.62]} castShadow>
          <cylinderGeometry args={[0.17, 0.165, 0.18, 18]} />
          {cloth(pants)}
        </mesh>

        {/* Torso cónico (ropa por testigo); contorno de acento al pasar el cursor */}
        <mesh ref={chest} position={[0, 1.24, 0]} scale={[1, 1, 0.6]} castShadow>
          <cylinderGeometry args={[0.2, 0.165, 0.5, 20]} />
          {cloth(top, 0.85)}
          {hovered && <Outlines thickness={0.02} color={ACCENT} />}
        </mesh>
        <mesh position={[0, 1.47, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.7]} castShadow>
          <capsuleGeometry args={[0.075, 0.3, 4, 12]} />
          {cloth(top, 0.85)}
        </mesh>

        {/* Brazos: hombro → codo → mano */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.25, 0, 0]} rotation={[0, 0, sx * 0.06]}>
            <mesh position={[0, 1.3, 0]} castShadow>
              <capsuleGeometry args={[0.052, 0.24, 4, 10]} />
              {cloth(top, 0.85)}
            </mesh>
            <mesh position={[0, 1.02, 0.02]} rotation={[0.1, 0, 0]} castShadow>
              <capsuleGeometry args={[0.044, 0.24, 4, 10]} />
              {skinMat}
            </mesh>
            <mesh position={[0, 0.85, 0.035]} scale={[0.8, 1.2, 0.6]} castShadow>
              <sphereGeometry args={[0.05, 12, 12]} />
              {skinMat}
            </mesh>
          </group>
        ))}

        {/* Cuello, cabeza, nariz y pelo */}
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.05, 0.058, 0.1, 12]} />
          {skinMat}
        </mesh>
        <mesh position={[0, 1.67, 0]} scale={[1, 1.18, 1.05]} castShadow>
          <sphereGeometry args={[0.1, 24, 24]} />
          {skinMat}
        </mesh>
        <mesh position={[0, 1.66, 0.1]}>
          <coneGeometry args={[0.016, 0.04, 8]} />
          {skinMat}
        </mesh>
        <mesh position={[0, 1.7, -0.008]} scale={[1.06, 1.14, 1.08]}>
          <sphereGeometry args={[0.1, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={hair} roughness={0.95} />
        </mesh>
      </group>

      {showLabel && (
        <Html position={[0, 2.02, 0]} center pointerEvents="none" zIndexRange={LABEL_Z_RANGE}>
          <div style={tagStyle}>
            <strong>{witness.name}</strong><br />
            <span style={{ color: status.color }}>{status.text}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Witnesses({ state, dispatch, view = DEFAULT_VIEW }: WitnessesProps) {
  const reduced = useReducedMotion();
  const list = state.scenario.witnesses || [];
  const { d } = state.scenario.dimensions;
  const n = list.length;
  const showLabel = labelsVisible(view, !!state.modal);
  return (
    <group>
      {list.map((witness, i) => {
        // Distribuidos junto a un borde de la escena (zona de testigos).
        const x = (i - (n - 1) / 2) * 2.6;
        const z = d / 2 + 1.5;
        return (
          <Person key={witness.id} witness={witness} ws={state.witnesses[witness.id]} position={[x, 0, z]} index={i} dispatch={dispatch} showLabel={showLabel} reduced={reduced} />
        );
      })}
    </group>
  );
}
