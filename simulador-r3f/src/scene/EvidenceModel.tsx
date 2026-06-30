import { RoundedBox } from '@react-three/drei';
import type { EvidenceItem } from '../types';
import { colorForNature } from '../data/scenarios';

type Kind = 'shell' | 'phone' | 'camera' | 'garment' | 'document' | 'glass' | 'bag' | 'blunt' | 'generic';

// Resuelve la forma del prop a partir de la naturaleza/nombre del EMP/EF.
function resolveKind(item: EvidenceItem): Kind {
  const n = (item.nature || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  if (name.includes('video') || name.includes('cámara') || name.includes('camara')) return 'camera';
  if (name.includes('bolso') || n.includes('física/documental') || n.includes('fisica/documental')) return 'bag';
  if (n.includes('traza') || name.includes('vidrio')) return 'glass';
  if (n.includes('bal')) return 'shell';
  if (n.includes('biológ') || n.includes('biolog')) return 'garment';
  if (n.includes('digital')) return 'phone';
  if (n.includes('document')) return 'document';
  if (n.includes('física') || n.includes('fisica')) return 'blunt';
  return 'generic';
}

interface Props {
  item: EvidenceItem;
  selected: boolean;
  hovered: boolean;
  contaminated: boolean;
}

/**
 * Prop 3D del EMP/EF compuesto con primitivas (sin assets externos).
 * El resaltado de selección/hover se aplica vía emissive en el material principal.
 */
export function EvidenceModel({ item, selected, hovered, contaminated }: Props) {
  const kind = resolveKind(item);
  const base = contaminated ? '#ef4444' : colorForNature(item.nature);
  const emissive = selected ? '#4ec1ff' : hovered ? '#1d4ed8' : '#000000';
  const emissiveIntensity = selected ? 0.55 : hovered ? 0.3 : 0;
  const { w, d, h } = item;

  const mat = (color: string, metalness = 0.3, roughness = 0.55) => (
    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={emissive} emissiveIntensity={emissiveIntensity} />
  );

  switch (kind) {
    case 'shell': // vainilla: cilindro de latón acostado
      return (
        <mesh position={[0, h * 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[Math.min(w, d) * 0.45, Math.min(w, d) * 0.45, w * 0.95, 16]} />
          {mat('#c8a24a', 0.85, 0.3)}
        </mesh>
      );

    case 'phone': // celular: cuerpo oscuro con pantalla encendida
      return (
        <group>
          <RoundedBox args={[w, h, d]} radius={Math.min(w, d) * 0.12} smoothness={4} position={[0, h / 2, 0]} castShadow>
            {mat('#15181f', 0.5, 0.35)}
          </RoundedBox>
          <mesh position={[0, h + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.82, d * 0.82]} />
            <meshStandardMaterial color="#0a2540" emissive="#3b82f6" emissiveIntensity={0.9} roughness={0.2} />
          </mesh>
        </group>
      );

    case 'camera': // dispositivo de video en poste
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[w * 0.18, w * 0.22, h, 12]} />
            {mat('#5b6473', 0.4, 0.6)}
          </mesh>
          <RoundedBox args={[w * 0.9, w * 0.6, d * 1.6]} radius={0.04} smoothness={3} position={[0, h * 0.92, d * 0.3]} castShadow>
            {mat('#2b3340', 0.5, 0.4)}
          </RoundedBox>
          <mesh position={[0, h * 0.92, d * 1.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.18, w * 0.18, 0.08, 16]} />
            <meshStandardMaterial color="#0b1020" metalness={0.2} roughness={0.1} emissive="#101820" />
          </mesh>
        </group>
      );

    case 'garment': { // prenda textil plegada con mancha biológica
      const H = Math.max(h, 0.16);
      const rmin = Math.min(w, d);
      // Manchas: varios discos solapados para una forma irregular, elevados sobre
      // la tela y con polygonOffset para que nunca se pierdan por z-fighting.
      const blotch: [number, number, number][] = [
        [0, 0, rmin * 0.34], [rmin * 0.18, rmin * 0.07, rmin * 0.2],
        [-rmin * 0.14, rmin * 0.12, rmin * 0.17], [rmin * 0.06, -rmin * 0.16, rmin * 0.15],
      ];
      return (
        <group>
          {/* Bulto principal de tela plegada (su cara superior queda despejada) */}
          <RoundedBox args={[w, H, d]} radius={rmin * 0.3} smoothness={5} position={[0, H / 2, 0]} castShadow receiveShadow>
            {mat('#c9d2e0', 0.0, 1.0)}
          </RoundedBox>
          {/* Pliegues hacia atrás/lados para no cubrir el centro-frontal */}
          <RoundedBox args={[w * 0.55, H * 0.6, d * 0.5]} radius={rmin * 0.24} smoothness={5} position={[-w * 0.2, H * 0.7, -d * 0.22]} rotation={[0, 0.3, 0.1]} castShadow>
            {mat('#aab4c6', 0.0, 1.0)}
          </RoundedBox>
          <RoundedBox args={[w * 0.35, H * 0.5, d * 0.4]} radius={rmin * 0.2} smoothness={5} position={[w * 0.28, H * 0.62, -d * 0.26]} rotation={[0, -0.35, -0.1]} castShadow>
            {mat('#d7dee9', 0.0, 1.0)}
          </RoundedBox>
          {/* Mancha biológica asentada sobre la cara superior de la tela */}
          <group position={[w * 0.04, H + 0.02, d * 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
            {blotch.map(([sx, sy, r], i) => (
              <mesh key={i} position={[sx, sy, 0]}>
                <circleGeometry args={[r, 24]} />
                <meshStandardMaterial color={i % 2 ? '#4f120e' : '#6d1a12'} roughness={0.95} metalness={0} transparent opacity={0.96} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
              </mesh>
            ))}
          </group>
        </group>
      );
    }

    case 'document': // documento: papel delgado ligeramente girado
      return (
        <group rotation={[0, 0.2, 0]}>
          <mesh position={[0, Math.max(h, 0.02) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, Math.max(h, 0.02), d]} />
            {mat('#f3f0e7', 0.0, 0.85)}
          </mesh>
          <mesh position={[0, Math.max(h, 0.02) + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.7, d * 0.55]} />
            <meshBasicMaterial color="#c9c3b2" />
          </mesh>
        </group>
      );

    case 'glass': // fragmento de vidrio: cristal translúcido
      return (
        <mesh position={[0, h * 0.6, 0]} rotation={[0.3, 0.6, 0.2]} castShadow>
          <octahedronGeometry args={[Math.max(w, d) * 0.5, 0]} />
          <meshStandardMaterial color="#bfe6ff" metalness={0.1} roughness={0.05} transparent opacity={0.55} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      );

    case 'bag': // bolso: cuerpo con solapa y asa
      return (
        <group>
          <RoundedBox args={[w, h, d]} radius={Math.min(w, d) * 0.2} smoothness={4} position={[0, h / 2, 0]} castShadow>
            {mat('#6b4a2b', 0.1, 0.7)}
          </RoundedBox>
          <RoundedBox args={[w * 1.02, h * 0.35, d * 0.4]} radius={0.04} smoothness={3} position={[0, h * 0.78, d * 0.32]} castShadow>
            {mat('#553a22', 0.1, 0.7)}
          </RoundedBox>
          <mesh position={[0, h * 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[w * 0.28, 0.025, 8, 20, Math.PI]} />
            {mat('#3f2d1a', 0.2, 0.6)}
          </mesh>
        </group>
      );

    case 'blunt': // objeto contundente: barra rígida
      return (
        <RoundedBox args={[w, h, d]} radius={Math.min(h, d) * 0.4} smoothness={4} position={[0, h / 2, 0]} castShadow rotation={[0, 0.3, 0]}>
          {mat('#7c7f86', 0.5, 0.5)}
        </RoundedBox>
      );

    default:
      return (
        <RoundedBox args={[w, h, d]} radius={Math.min(w, d, h) * 0.2} smoothness={3} position={[0, h / 2, 0]} castShadow>
          {mat(base)}
        </RoundedBox>
      );
  }
}
