import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { EvidenceProps } from './contracts';
import { EvidenceModel } from './EvidenceModel';
import { evidencePresentation, ACCENT, NEGATIVE, POSITIVE, LABEL_Z_RANGE } from './forensic/presentation';
import { plateNumber } from './forensic/plates';
import { plateTexture, rulerTexture } from './forensic/textures';
import { useReducedMotion } from './forensic/motion';

// Altura de apoyo de los props: por encima del piso (0.015) y del tapete (0.035).
const BASE_Y = 0.02;

/** Anillo fino de halo en el piso; el seleccionado respira suavemente. */
function HaloRing({ radius, color, pulse, opacity }: { radius: number; color: string; pulse: boolean; opacity: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((s) => {
    if (mat.current) mat.current.opacity = pulse ? opacity * (0.7 + 0.3 * Math.sin(s.clock.elapsedTime * 3)) : opacity;
  });
  return (
    <mesh position={[0, 0.058, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <ringGeometry args={[radius, radius + 0.028, 64]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
    </mesh>
  );
}

/** Placa numerada A-frame (tienda plegada) amarilla con el número en ambas caras. */
function NumberPlate({ num }: { num: string }) {
  const map = plateTexture(num);
  const W = 0.2, S = 0.18, half = 0.36; // ancho, largo inclinado, semiapertura (rad)
  const face = (rotY: number) => (
    <group rotation={[0, rotY, 0]}>
      <group position={[0, (Math.cos(half) * S) / 2, (Math.sin(half) * S) / 2]} rotation={[-half, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[W, S, 0.004]} />
          <meshStandardMaterial color={ACCENT} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.0025]}>
          <planeGeometry args={[W * 0.96, S * 0.96]} />
          <meshStandardMaterial map={map} roughness={0.45} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.12} />
        </mesh>
      </group>
    </group>
  );
  return (
    <group>
      {face(0)}
      {face(Math.PI)}
    </group>
  );
}

/** Testigo métrico en L (regla fotográfica) junto al objeto fijado. */
function PhotoScale() {
  const map = rulerTexture();
  const arm = (len: number, rotY: number, pos: [number, number, number]) => (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[len / 2, 0.004, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.008, 0.04]} />
        <meshStandardMaterial color="#efefea" roughness={0.6} />
      </mesh>
      <mesh position={[len / 2, 0.0085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len, 0.04]} />
        <meshStandardMaterial map={map} roughness={0.6} />
      </mesh>
    </group>
  );
  return (
    <group>
      {arm(0.3, 0, [0, 0, 0])}
      {arm(0.2, Math.PI / 2, [0, 0, 0])}
    </group>
  );
}

/** Contorno en el piso del objeto recolectado (y relleno tenue, que sigue siendo clicable). */
function Silhouette({ w, d, color }: { w: number; d: number; color: string }) {
  const geo = useMemo(() => {
    const rr = (sw: number, sd: number, r: number) => {
      const s = new THREE.Shape();
      const x = -sw / 2, y = -sd / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + sw - r, y); s.quadraticCurveTo(x + sw, y, x + sw, y + r);
      s.lineTo(x + sw, y + sd - r); s.quadraticCurveTo(x + sw, y + sd, x + sw - r, y + sd);
      s.lineTo(x + r, y + sd); s.quadraticCurveTo(x, y + sd, x, y + sd - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };
    const r = Math.min(w, d) * 0.25;
    const outer = rr(w, d, r);
    const inner = rr(w - 0.06, d - 0.06, Math.max(0.01, r - 0.03));
    outer.holes.push(new THREE.Path(inner.getPoints(8).reverse()));
    return new THREE.ShapeGeometry(outer, 8);
  }, [w, d]);
  return (
    <group position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geo}>
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </group>
  );
}

const labelStyle: CSSProperties = {
  background: '#131217', color: '#ffffff', border: `1px solid ${ACCENT}`, borderRadius: 6,
  padding: '3px 8px', fontSize: 12, lineHeight: 1.3, whiteSpace: 'nowrap',
  fontFamily: '"Public Sans Variable", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
};

export function Evidence({ item, state, selected, onSelect, view, tier }: EvidenceProps) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const p = evidencePresentation(state, view, selected, hovered);
  const radius = Math.max(item.w, item.d) * 0.62;
  const num = plateNumber(item.id);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); // evita que el clic atraviese al piso y deseleccione
    onSelect(item.id);
  };

  const haloColor = p.contaminated ? NEGATIVE : ACCENT;
  const plateX = item.w / 2 + 0.26, plateZ = item.d / 2 + 0.05;

  return (
    <group
      position={[item.x, 0, item.z]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      {/* Huella clicable invisible: el modelo puede ser menor que su huella y,
          tras recolectar, el objeto sigue seleccionable para embalar/rotular. */}
      <mesh position={[0, Math.max(item.h, 0.25) / 2, 0]}>
        <boxGeometry args={[item.w, Math.max(item.h, 0.25), item.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {/* Prop 3D del EMP/EF según su naturaleza; desaparece al recolectar */}
      <group position={[0, BASE_Y, 0]} visible={p.showModel}>
        <EvidenceModel item={item} selected={selected} hovered={hovered} contaminated={p.contaminated} tier={tier} />
      </group>

      {/* Halo en el piso (selección o hover), en acento; rojo si está contaminado */}
      {p.halo !== 'none' && <HaloRing radius={radius} color={haloColor} pulse={p.halo === 'selected' && !reduced} opacity={p.halo === 'selected' ? 0.95 : 0.5} />}
      {p.halo === 'none' && p.contaminated && <HaloRing radius={radius} color={NEGATIVE} pulse={false} opacity={0.45} />}

      {/* Placa numerada A-frame al señalizar (se queda tras recolectar) */}
      {p.showPlate && (
        <group position={[plateX, BASE_Y, plateZ]} rotation={[0, Math.PI / 4, 0]} scale={1.5}>
          <NumberPlate num={num} />
        </group>
      )}

      {/* Testigo métrico en L al fijar fotográficamente */}
      {p.showScale && (
        <group position={[-item.w / 2 - 0.06, BASE_Y + 0.02, item.d / 2 + 0.06]} rotation={[0, 0, 0]}>
          <PhotoScale />
        </group>
      )}

      {/* Silueta del objeto recolectado; verde al entregarse al laboratorio */}
      {p.showSilhouette && <Silhouette w={item.w * 0.9} d={item.d * 0.9} color={p.delivered ? POSITIVE : '#ece8dc'} />}

      {/* Etiqueta con id/nombre al seleccionar (solo si la vista permite etiquetas) */}
      {p.showLabel && (
        <Html position={[0, Math.max(item.h, 0.3) + 0.45, 0]} center pointerEvents="none" zIndexRange={LABEL_Z_RANGE}>
          <div style={labelStyle}><strong style={{ color: ACCENT }}>{item.id}</strong> · {item.name}</div>
        </Html>
      )}
    </group>
  );
}
