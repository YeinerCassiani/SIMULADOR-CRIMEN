import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { EvidenceItem, EvidenceState } from '../types';
import { EvidenceModel } from './EvidenceModel';

interface Props {
  item: EvidenceItem;
  state: EvidenceState;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function Evidence({ item, state, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState(false);
  const radius = Math.max(item.w, item.d) * 0.85;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); // evita que el clic atraviese al piso y deseleccione
    onSelect(item.id);
  };

  return (
    <group
      position={[item.x, 0, item.z]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* Prop 3D del EMP/EF según su naturaleza */}
      <EvidenceModel item={item} selected={selected} hovered={hovered} contaminated={state.contaminated} />

      {/* Anillo de selección / hover sobre el piso */}
      {(selected || hovered) && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius * 1.18, 32]} />
          <meshBasicMaterial color={selected ? '#4ec1ff' : '#1d4ed8'} transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      )}

      {/* Anillo azul si fue fijado fotográficamente */}
      {state.photographed && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.25, radius * 1.38, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      )}

      {/* Numerador (testigo métrico) si fue señalizado */}
      {state.marked && (
        <Html position={[radius * 1.1, item.h + 0.25, 0]} center distanceFactor={12} pointerEvents="none">
          <div className="evidence-marker">{item.id.split('-').pop()}</div>
        </Html>
      )}

      {/* Indicador de entregado */}
      {state.delivered && (
        <mesh position={[0, item.h + 0.45, 0]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.6} />
        </mesh>
      )}

      {/* Etiqueta con id/nombre al seleccionar */}
      {selected && (
        <Html position={[0, item.h + 0.7, 0]} center distanceFactor={14} pointerEvents="none">
          <div className="evidence-label"><strong>{item.id}</strong> · {item.name}</div>
        </Html>
      )}
    </group>
  );
}
