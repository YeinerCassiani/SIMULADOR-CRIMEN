import { RoundedBox, MeshReflectorMaterial } from '@react-three/drei';
import type { Scenario } from '../types';
import { GltfProp } from './GltfProp';

interface Props { scenario: Scenario; }

type Vec3 = [number, number, number];

function Box({ position, size, color, metalness = 0.05, roughness = 0.85, radius = 0.03 }: { position: Vec3; size: [number, number, number]; color: string; metalness?: number; roughness?: number; radius?: number }) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={3} position={position} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </RoundedBox>
  );
}

// --- Mobiliario interior compuesto ---
function Sofa({ x, z }: { x: number; z: number }) {
  // Sofá procedural (fallback del modelo CC0 low-poly).
  const procedural = (
    <>
      <Box position={[0, 0.25, 0]} size={[2.8, 0.4, 1.2]} color="#3b4456" radius={0.08} />
      <Box position={[0, 0.6, -0.5]} size={[2.8, 0.7, 0.25]} color="#454f63" radius={0.08} />
      <Box position={[-1.45, 0.5, 0]} size={[0.25, 0.55, 1.2]} color="#454f63" radius={0.08} />
      <Box position={[1.45, 0.5, 0]} size={[0.25, 0.55, 1.2]} color="#454f63" radius={0.08} />
      <Box position={[-0.7, 0.5, 0.05]} size={[1.2, 0.22, 1.0]} color="#56677e" radius={0.1} />
      <Box position={[0.7, 0.5, 0.05]} size={[1.2, 0.22, 1.0]} color="#56677e" radius={0.1} />
    </>
  );
  return (
    <group position={[x, 0, z]}>
      {/* Modelo CC0 low-poly (Polygonal Mind, CC0); cae al sofá procedural si falla. */}
      <GltfProp url="/models/Sofa.glb" fallback={procedural} scale={1} position={[0, 0, 0]} rotation={[0, 0, 0]} />
    </group>
  );
}

function Table({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.55, 0]} size={[1.6, 0.1, 1.0]} color="#8b5a2b" metalness={0.1} roughness={0.5} radius={0.03} />
      {([[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.27, lz]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.55, 10]} />
          <meshStandardMaterial color="#623d18" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Kitchen({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.45, 0]} size={[2.7, 0.9, 1.2]} color="#7b8799" radius={0.04} />
      <Box position={[0, 0.93, 0]} size={[2.8, 0.06, 1.25]} color="#2b3340" metalness={0.3} roughness={0.3} radius={0.02} />
    </group>
  );
}

// --- Elementos del parque (procedurales; combinan con el estilo flat low-poly) ---
function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 2.0, 10]} />
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color="#1e6f41" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

function Bench({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.45, 0]} size={[1.8, 0.1, 0.5]} color="#7a4a1e" radius={0.03} />
      <Box position={[0, 0.7, -0.2]} size={[1.8, 0.4, 0.08]} color="#7a4a1e" radius={0.03} />
      {([[-0.8, 0], [0.8, 0]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.22, lz]} castShadow>
          <boxGeometry args={[0.1, 0.45, 0.45]} />
          <meshStandardMaterial color="#52525b" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Lamp({ x, z }: { x: number; z: number }) {
  // Farol procedural (fallback mientras carga el modelo o si éste falla).
  const procedural = (
    <>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 3.2, 10]} />
        <meshStandardMaterial color="#3b4150" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fff7c2" emissive="#ffe27a" emissiveIntensity={1.4} />
      </mesh>
    </>
  );
  return (
    <group position={[x, 0, z]}>
      {/* Farol CC0 low-poly (Polygonal Mind); cae al farol procedural si falla. */}
      <GltfProp url="/models/Lamp_Stand.glb" fallback={procedural} scale={2.4} position={[0, 0, 0]} />
      <pointLight position={[0, 3.2, 0]} intensity={6} distance={9} color="#ffe9b0" castShadow />
    </group>
  );
}

// --- Mobiliario de dormitorio (interior 'vivienda') ---
function Bed({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box position={[0, 0.2, 0]} size={[2.2, 0.4, 3.0]} color="#6b4a2e" radius={0.05} />
      <Box position={[0, 0.5, 0.1]} size={[2.0, 0.25, 2.7]} color="#e7e2d6" radius={0.08} />
      <Box position={[0, 0.52, 0.55]} size={[2.05, 0.22, 1.7]} color="#3b5a74" radius={0.06} />
      <Box position={[0, 0.66, -1.05]} size={[1.6, 0.18, 0.5]} color="#f5f2ea" radius={0.1} />
      <Box position={[0, 0.75, -1.45]} size={[2.2, 1.0, 0.15]} color="#5a3d24" radius={0.04} />
    </group>
  );
}

function Wardrobe({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box position={[0, 1.1, 0]} size={[1.6, 2.2, 0.6]} color="#7a5a3a" radius={0.03} />
      <Box position={[0, 1.1, 0.31]} size={[0.04, 2.0, 0.02]} color="#4a3019" radius={0.01} />
      {[-0.18, 0.18].map((hx) => (
        <mesh key={hx} position={[hx, 1.05, 0.33]}><boxGeometry args={[0.05, 0.22, 0.05]} /><meshStandardMaterial color="#2b2b2b" metalness={0.4} /></mesh>
      ))}
    </group>
  );
}

function Nightstand({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.35, 0]} size={[0.7, 0.7, 0.6]} color="#6b4a2e" radius={0.03} />
      <mesh position={[0, 0.45, 0.31]}><boxGeometry args={[0.14, 0.05, 0.04]} /><meshStandardMaterial color="#2b2b2b" metalness={0.4} /></mesh>
    </group>
  );
}

function Dresser({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box position={[0, 0.55, 0]} size={[1.8, 1.1, 0.6]} color="#6b4a2e" radius={0.03} />
      {[0.3, 0.55, 0.8].map((yy, i) => (
        <mesh key={i} position={[0, yy, 0.31]}><boxGeometry args={[1.5, 0.05, 0.03]} /><meshStandardMaterial color="#4a3019" /></mesh>
      ))}
    </group>
  );
}

function PotPlant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <GltfProp url="/models/Pot_Plant.glb" fallback={<mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.22, 0.28, 0.9, 8]} /><meshStandardMaterial color="#3a6b3a" roughness={0.9} /></mesh>} scale={1.5} />
    </group>
  );
}

// Interior 'apartamento': sala-comedor (sofá, mesa, cocina, tapete).
function ApartmentInterior({ w, d }: { w: number; d: number }) {
  return (
    <>
      <Box position={[0, 1.2, -d / 2]} size={[w, 2.4, 0.2]} color="#cfd7df" radius={0.01} />
      <Box position={[-w / 2, 1.2, 0]} size={[0.2, 2.4, d]} color="#bac3cf" radius={0.01} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.6, 0.035, 0.6]} receiveShadow>
        <planeGeometry args={[5.5, 3.6]} />
        <meshStandardMaterial color="#4b1020" roughness={0.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <Sofa x={-4.8} z={-2.6} />
      <Table x={-1.6} z={1.7} />
      <Kitchen x={4.5} z={-3.4} />
      <PotPlant x={-6.6} z={3.2} />
      <Box position={[6.8, 1.0, 4.2]} size={[0.18, 2.05, 1.2]} color="#6b4d2d" radius={0.02} />
    </>
  );
}

// Interior 'vivienda': dormitorio doméstico (cama, armario, mesa de noche, cómoda).
function ViviendaInterior({ w, d }: { w: number; d: number }) {
  return (
    <>
      <Box position={[0, 1.2, -d / 2]} size={[w, 2.4, 0.2]} color="#d8cdbb" radius={0.01} />
      <Box position={[-w / 2, 1.2, 0]} size={[0.2, 2.4, d]} color="#cabfa6" radius={0.01} />
      {/* Tapete junto a la cama */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.2, 0.035, 1.6]} receiveShadow>
        <planeGeometry args={[4.2, 3.0]} />
        <meshStandardMaterial color="#3a4a36" roughness={0.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <Bed x={-5} z={-2.4} rot={0} />
      <Nightstand x={-3.2} z={-3.7} />
      <Wardrobe x={6.5} z={-3.6} rot={0} />
      <Dresser x={5.6} z={3.6} rot={0} />
      <PotPlant x={-6.6} z={3.6} />
      <Box position={[6.8, 1.0, 4.2]} size={[0.18, 2.05, 1.2]} color="#6b4d2d" radius={0.02} />
    </>
  );
}

// --- Elementos de vía (siniestro vial) ---
function Road({ w }: { w: number }) {
  const len = w * 2.2;
  const roadHalf = 3.6;
  const dashCount = Math.floor(len / 2);
  return (
    <group>
      {/* Calzada de asfalto */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[len, roadHalf * 2]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.96} />
      </mesh>
      {/* Bermas grises a los lados */}
      {[-1, 1].map((s) => (
        <mesh key={'b' + s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, s * (roadHalf + 0.9)]} receiveShadow>
          <planeGeometry args={[len, 1.8]} />
          <meshStandardMaterial color="#6b6f76" roughness={0.97} />
        </mesh>
      ))}
      {/* Líneas de borde continuas */}
      {[-1, 1].map((s) => (
        <mesh key={'e' + s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, s * (roadHalf - 0.25)]}>
          <planeGeometry args={[len, 0.16]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.8} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
      {/* Línea central amarilla discontinua */}
      {Array.from({ length: dashCount }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-len / 2 + 1 + i * 2, 0.03, 0]}>
          <planeGeometry args={[1, 0.16]} />
          <meshStandardMaterial color="#f2d04b" roughness={0.8} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
    </group>
  );
}

function Car({ x, z, rot = 0, color = '#b1342f' }: { x: number; z: number; rot?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <RoundedBox args={[3.6, 0.7, 1.7]} radius={0.18} smoothness={4} position={[0, 0.55, 0]} castShadow><meshStandardMaterial color={color} metalness={0.3} roughness={0.5} /></RoundedBox>
      <RoundedBox args={[1.9, 0.6, 1.55]} radius={0.18} smoothness={4} position={[-0.1, 1.05, 0]} castShadow><meshStandardMaterial color={color} metalness={0.3} roughness={0.5} /></RoundedBox>
      {/* Ventanas */}
      <RoundedBox args={[1.7, 0.42, 1.45]} radius={0.1} smoothness={3} position={[-0.1, 1.12, 0]}><meshStandardMaterial color="#1a2330" metalness={0.5} roughness={0.2} /></RoundedBox>
      {/* Ruedas */}
      {([[1.1, 0.85], [1.1, -0.85], [-1.1, 0.85], [-1.1, -0.85]] as [number, number][]).map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.35, wz]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.3, 16]} /><meshStandardMaterial color="#15171a" roughness={0.8} /></mesh>
      ))}
      {/* Faros */}
      {[0.5, -0.5].map((fz) => (
        <mesh key={fz} position={[1.82, 0.55, fz]}><boxGeometry args={[0.06, 0.18, 0.3]} /><meshStandardMaterial color="#fff7c2" emissive="#fff7c2" emissiveIntensity={0.6} /></mesh>
      ))}
    </group>
  );
}

function Cone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.03, 0]} size={[0.42, 0.06, 0.42]} color="#e5602a" radius={0.02} />
      <mesh position={[0, 0.3, 0]} castShadow><coneGeometry args={[0.2, 0.55, 14]} /><meshStandardMaterial color="#e5602a" roughness={0.7} /></mesh>
      <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.13, 0.13, 0.09, 14]} /><meshStandardMaterial color="#f2f2f2" roughness={0.8} /></mesh>
    </group>
  );
}

export function Room({ scenario }: Props) {
  const { w, d } = scenario.dimensions;
  const env = scenario.environmentType;
  const closed = env === 'cerrado';
  const vivienda = closed && scenario.decor === 'vivienda';
  const groundColor = closed ? (vivienda ? '#4a4034' : '#3f4654') : '#27592f';
  const floorColor = vivienda ? '#6b5d4c' : '#586074';

  return (
    <group>
      {/* Piso amplio */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w * 2.2, d * 2.2]} />
        <meshStandardMaterial color={groundColor} roughness={0.97} />
      </mesh>
      {/* Suelo de la escena: reflectante en interior, mate en parque; en vía lo aporta la calzada */}
      {env !== 'vial' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          {closed ? (
            <MeshReflectorMaterial blur={[200, 60]} resolution={256} mixBlur={1} mixStrength={1.1} roughness={0.78} depthScale={0.8} minDepthThreshold={0.3} maxDepthThreshold={1.2} color={floorColor} metalness={0.25} />
          ) : (
            <meshStandardMaterial color="#2e6f3d" roughness={0.95} />
          )}
        </mesh>
      )}

      {env === 'vial' ? (
        <>
          <Road w={w} />
          <Car x={0.5} z={-0.6} rot={0.32} />
          <Cone x={-2.6} z={2.3} />
          <Cone x={-1.8} z={1.7} />
          <Cone x={3.2} z={-2.2} />
          <Tree x={-9} z={6.5} s={0.9} />
          <Tree x={9} z={-6.5} s={0.85} />
          <Lamp x={8} z={5} />
        </>
      ) : closed ? (
        vivienda ? <ViviendaInterior w={w} d={d} /> : <ApartmentInterior w={w} d={d} />
      ) : (
        <>
          {/* Sendero */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} receiveShadow>
            <planeGeometry args={[w, 3]} />
            <meshStandardMaterial color="#6d7889" roughness={0.95} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
          <Tree x={-8} z={-6} s={1.1} />
          <Tree x={7} z={4} s={0.9} />
          <Tree x={2} z={-7} s={1.0} />
          <Bench x={-7} z={4} />
          <Lamp x={4} z={-1} />
        </>
      )}
    </group>
  );
}
