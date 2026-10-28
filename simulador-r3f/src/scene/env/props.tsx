// Mobiliario y props: modelos CC0 de Poly Haven (GltfProp con fallback) y
// procedurales que no tienen modelo (encimera, vehículo siniestrado, conos).
import { RoundedBox } from '@react-three/drei';
import { MODELS } from '../../assets/manifest';
import { GltfProp, type EmissiveOverrides } from '../GltfProp';
import { anchorOffset, type Placement } from './layout';

type Vec3 = [number, number, number];

// Constantes de módulo: referencia estable para el useMemo de GltfProp.
const EMISSIVE: Partial<Record<string, EmissiveOverrides>> = {
  street_lamp_01: {
    street_lamp_01_bulb: { color: '#ffb35c', intensity: 12 },
    street_lamp_01_glass: { color: '#ff9f45', intensity: 1.6 },
  },
  modern_ceiling_lamp_01: {
    modern_ceiling_globe: { color: '#ffd9a8', intensity: 9 },
    modern_ceiling_lamp_01_glass: { color: '#ffe2b8', intensity: 0.5 },
  },
};

/** Caja neutra del tamaño del modelo: lo que se ve mientras carga o si falla. */
function BoxFallback({ size, anchor }: { size: readonly number[]; anchor: Placement['anchor'] }) {
  const y = anchor === 'ceiling' ? -size[1] / 2 : anchor === 'wall' ? 0 : size[1] / 2;
  const z = anchor === 'wall' ? size[2] / 2 : 0;
  return (
    <mesh position={[0, y, z]} castShadow receiveShadow>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <meshStandardMaterial color="#6a6258" roughness={0.85} />
    </mesh>
  );
}

/** Modelo del manifest apoyado según su bbox (piso, techo o muro). */
export function ModelProp({ pl, shadows = true }: { pl: Placement; shadows?: boolean }) {
  if (!pl.model) return null;
  const asset = MODELS[pl.model];
  const off = anchorOffset(asset.bbox, pl.anchor) as Vec3;
  const s = asset.scale;
  return (
    <group position={[pl.x, pl.y ?? 0, pl.z]} rotation={[0, pl.rotY, 0]}>
      <GltfProp
        url={asset.url}
        scale={s}
        position={[off[0] * s, off[1] * s, off[2] * s]}
        shadows={shadows}
        emissive={EMISSIVE[pl.model]}
        fallback={<BoxFallback size={asset.bbox.size} anchor={pl.anchor} />}
      />
    </group>
  );
}

// --- Procedurales ---

/** Encimera de cocina: mueble bajo con puertas y cubierta de piedra oscura. */
function Counter({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  return (
    <group>
      <mesh position={[0, (h - 0.04) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.04, d - 0.04]} />
        <meshStandardMaterial color="#d9d6cf" roughness={0.55} />
      </mesh>
      <mesh position={[0, h - 0.02, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.02, 0.04, d]} />
        <meshStandardMaterial color="#26282c" roughness={0.25} metalness={0.1} />
      </mesh>
      {[-w / 4, w / 4].map((x) => (
        <mesh key={x} position={[x, h * 0.62, d / 2 - 0.015]}>
          <boxGeometry args={[0.16, 0.018, 0.02]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* Ranura entre puertas */}
      <mesh position={[0, (h - 0.04) / 2, d / 2 - 0.018]}>
        <boxGeometry args={[0.008, h - 0.12, 0.004]} />
        <meshStandardMaterial color="#8d8a84" />
      </mesh>
    </group>
  );
}

/** Vehículo siniestrado: carrocería redondeada, cabina, frente hundido, luces. */
function CrashCar({ color = '#8e2622' }: { color?: string }) {
  const body = <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} envMapIntensity={1.2} />;
  const glass = <meshStandardMaterial color="#0f1720" metalness={0.6} roughness={0.08} envMapIntensity={1.5} />;
  return (
    <group>
      <RoundedBox args={[3.9, 0.62, 1.72]} radius={0.16} smoothness={4} position={[0, 0.58, 0]} castShadow receiveShadow>{body}</RoundedBox>
      <RoundedBox args={[2.0, 0.56, 1.56]} radius={0.2} smoothness={4} position={[-0.25, 1.12, 0]} castShadow>{body}</RoundedBox>
      <RoundedBox args={[1.86, 0.4, 1.6]} radius={0.12} smoothness={3} position={[-0.25, 1.14, 0]}>{glass}</RoundedBox>
      {/* Frente hundido por el impacto: capó inclinado y parachoques caído. */}
      <mesh position={[1.62, 0.9, 0.18]} rotation={[0.15, 0, -0.32]} castShadow>
        <boxGeometry args={[0.9, 0.05, 1.3]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[1.93, 0.32, -0.1]} rotation={[0, 0.18, 0.12]} castShadow>
        <boxGeometry args={[0.12, 0.18, 1.6]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.6} />
      </mesh>
      {/* Ruedas con rin */}
      {([[1.2, 0.83], [1.2, -0.83], [-1.25, 0.83], [-1.25, -0.83]] as [number, number][]).map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.36, z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.26, 20]} />
            <meshStandardMaterial color="#141518" roughness={0.85} />
          </mesh>
          <mesh position={[0, z > 0 ? 0.135 : -0.135, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 16]} />
            <meshStandardMaterial color="#9da3aa" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Faros (uno roto) y luces traseras: emisivos para el bloom. */}
      <mesh position={[1.96, 0.66, -0.58]}>
        <boxGeometry args={[0.04, 0.16, 0.34]} />
        <meshStandardMaterial color="#fff4d6" emissive="#ffe9b8" emissiveIntensity={4} />
      </mesh>
      <mesh position={[1.9, 0.62, 0.6]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.04, 0.14, 0.3]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.3} />
      </mesh>
      {[0.6, -0.6].map((z) => (
        <mesh key={z} position={[-1.96, 0.7, z]}>
          <boxGeometry args={[0.04, 0.14, 0.3]} />
          <meshStandardMaterial color="#5a0a0a" emissive="#ff2a1a" emissiveIntensity={2.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Radio del cono (base y=0.04, r=0.19; ápice y=0.62) a la altura y. */
const coneR = (y: number) => (0.19 * (0.62 - y)) / 0.58;

/** Cono de tránsito con banda reflectiva. */
function Cone() {
  return (
    <group>
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.05, 0.42]} />
        <meshStandardMaterial color="#d9531e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.33, 0]} castShadow>
        <coneGeometry args={[0.19, 0.58, 18]} />
        <meshStandardMaterial color="#e5602a" roughness={0.55} />
      </mesh>
      {[0.28, 0.42].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[coneR(y + 0.03) + 0.004, coneR(y - 0.03) + 0.004, 0.06, 18, 1, true]} />
          <meshStandardMaterial color="#f4f4f0" roughness={0.3} emissive="#ffffff" emissiveIntensity={0.08} />
        </mesh>
      ))}
    </group>
  );
}

/** Lámpara de mesa de noche: pie, pantalla de tela y bombilla emisiva. */
function BedsideLamp() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.07, 0.24, 14]} />
        <meshStandardMaterial color="#3d3328" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.08, 0.13, 0.18, 20, 1, true]} />
        <meshStandardMaterial color="#efe1c4" emissive="#ffcf8a" emissiveIntensity={0.9} roughness={0.9} side={2} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#fff2d6" emissive="#ffd9a0" emissiveIntensity={8} />
      </mesh>
    </group>
  );
}

/** Planta de interior: maceta cónica, tierra y follaje de masas facetadas. */
function Plant() {
  const leaves: [number, number, number, number, string][] = [
    [0, 0.78, 0, 0.26, '#2f5a32'], [0.12, 0.98, 0.05, 0.2, '#3b6b3a'], [-0.1, 1.02, -0.06, 0.18, '#28502c'],
    [0.02, 1.12, -0.1, 0.15, '#447a40'], [-0.12, 0.84, 0.1, 0.17, '#335f34'],
  ];
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 18]} />
        <meshStandardMaterial color="#b36a45" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.185, 0.185, 0.02, 18]} />
        <meshStandardMaterial color="#2c2118" roughness={1} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.35, 6]} />
        <meshStandardMaterial color="#4b3a26" roughness={0.9} />
      </mesh>
      {leaves.map(([x, y, z, r, c], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.85, 1]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={c} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Barrera de concreto tipo New Jersey con franjas reflectivas. */
function Jersey({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  const concrete = <meshStandardMaterial color="#a8a49b" roughness={0.9} />;
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.32, d]} />
        {concrete}
      </mesh>
      <mesh position={[0, 0.32 + (h - 0.32) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.32, d * 0.42]} />
        {concrete}
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0, 0.36, sd * d * 0.33]} rotation={[sd * 0.62, 0, 0]} castShadow>
          <boxGeometry args={[w, 0.16, 0.06]} />
          {concrete}
        </mesh>
      ))}
      {[-w / 4, w / 4].map((x) => (
        <mesh key={x} position={[x, h - 0.16, d * 0.215]}>
          <boxGeometry args={[0.3, 0.1, 0.005]} />
          <meshStandardMaterial color="#f2c230" emissive="#f2a530" emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function ProcProp({ pl }: { pl: Placement }) {
  if (!pl.proc) return null;
  return (
    <group position={[pl.x, pl.y ?? 0, pl.z]} rotation={[0, pl.rotY, 0]}>
      {pl.proc === 'counter' && <Counter size={pl.size} />}
      {pl.proc === 'carCrash' && <CrashCar />}
      {pl.proc === 'cone' && <Cone />}
      {pl.proc === 'bedsideLamp' && <BedsideLamp />}
      {pl.proc === 'plant' && <Plant />}
      {pl.proc === 'jersey' && <Jersey size={pl.size} />}
    </group>
  );
}

/** Dibuja un layout completo (modelos + procedurales). */
export function Furniture({ placements, shadows = true }: { placements: readonly Placement[]; shadows?: boolean }) {
  return (
    <>
      {placements.map((pl) => (pl.model ? <ModelProp key={pl.key} pl={pl} shadows={shadows} /> : <ProcProp key={pl.key} pl={pl} />))}
    </>
  );
}
