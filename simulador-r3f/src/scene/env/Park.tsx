// Parque de noche: pasto texturizado, sendero curvo de concreto, faroles de sodio,
// bancas y árboles procedurales instanciados.
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { QualityTier } from '../contracts';
import { Surface } from './materials';
import { DownLight } from './lights';
import { Furniture } from './props';
import { Trees } from './Trees';
import {
  bushSpots, PARK_PATH, PARK_PATH_WIDTH, practicalIntensity, practicalShadow, ribbon, surfaceRepeat,
  TEXTURE_TILE_M, treeSpots, STREET_LAMP_CD, type Placement,
} from './layout';

/** Altura de la bombilla del farol (street_lamp_01: linterna en y 3.14–3.51). */
export const STREET_LAMP_Y = 3.2;
/** Luz de sodio: ámbar cálido. */
export const SODIUM = '#ffa64d';

const TREES = treeSpots('abierto');
const BUSHES = bushSpots('abierto');

function PathRibbon({ tier }: { tier: QualityTier }) {
  const geo = useMemo(() => {
    const r = ribbon(PARK_PATH, PARK_PATH_WIDTH, 0.022);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(r.positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(r.uvs, 2));
    g.setIndex(r.indices);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const k = 1 / TEXTURE_TILE_M.pavement_02;
  return (
    <mesh geometry={geo} receiveShadow>
      <Surface tex="pavement_02" repeat={[k, k]} tier={tier} tint="#a7a39b" polygonOffset />
    </mesh>
  );
}

export function Park({ w, d, placements, tier, forensicLight }: { w: number; d: number; placements: readonly Placement[]; tier: QualityTier; forensicLight: boolean }) {
  const lamps = placements.filter((p) => p.model === 'street_lamp_01');
  const G = 2.8;
  return (
    <group>
      {/* Tierra alrededor del área (fuera del cordón). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w * G, d * G]} />
        <Surface tex="forest_ground_05" repeat={surfaceRepeat('forest_ground_05', w * G, d * G)} tier={tier} tint="#45453f" />
      </mesh>
      {/* Zona verde de la escena. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[w + 6, d + 4]} />
        <Surface tex="sparse_grass" repeat={surfaceRepeat('sparse_grass', w + 6, d + 4)} tier={tier} tint="#b4d29a" />
      </mesh>
      <PathRibbon tier={tier} />
      <Trees trees={TREES} bushes={BUSHES} />
      <Furniture placements={placements} />
      {lamps.map((p, i) => (
        <DownLight
          key={p.key}
          position={[p.x, STREET_LAMP_Y - 0.05, p.z]}
          color={SODIUM}
          intensity={practicalIntensity(STREET_LAMP_CD, forensicLight)}
          angle={1.1}
          penumbra={0.75}
          distance={14}
          castShadow={practicalShadow(i, tier)}
        />
      ))}
    </group>
  );
}
