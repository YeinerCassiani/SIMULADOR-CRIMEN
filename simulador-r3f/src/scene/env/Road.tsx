// Vía pública de noche: calzada de asfalto con demarcación, bordillo con rampas
// donde cruza la ruta de ingreso, aceras de concreto, fachada de ladrillo con
// persianas y ventanas encendidas, faroles de sodio, barreras y conos.
import { useMemo } from 'react';
import type { QualityTier } from '../contracts';
import { routePath } from '../forensic/route';
import { Surface } from './materials';
import { DownLight } from './lights';
import { Furniture } from './props';
import { Trees } from './Trees';
import { SODIUM, STREET_LAMP_Y } from './Park';
import {
  bushSpots, crossingsAtZ, CURB_H, CURB_W, curbSpans, FACADE_Z, practicalIntensity, practicalShadow,
  ROAD_HALF, SIDEWALK_PLUS_Z, surfaceRepeat, treeSpots, STREET_LAMP_CD, type Placement,
} from './layout';

const TREES = treeSpots('vial');
const BUSHES = bushSpots('vial');
const FACADE_H = 4.6;

function Markings({ len }: { len: number }) {
  const dashes = Math.floor(len / 3);
  const line = <meshStandardMaterial color="#e9e6dc" roughness={0.7} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, s * (ROAD_HALF - 0.3)]} receiveShadow>
          <planeGeometry args={[len, 0.14]} />
          {line}
        </mesh>
      ))}
      {Array.from({ length: dashes }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-len / 2 + 1.5 + i * 3, 0.024, 0]} receiveShadow>
          <planeGeometry args={[1.6, 0.14]} />
          <meshStandardMaterial color="#e2b93a" roughness={0.7} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
    </group>
  );
}

function Curbs({ len, tier }: { len: number; tier: QualityTier }) {
  // Rampa de 2 m donde la ruta de ingreso cruza cada borde de la calzada.
  const runs = useMemo(() => [-1, 1].map((s) => {
    const z = s * ROAD_HALF;
    const gaps = crossingsAtZ(routePath('vial'), z).map((x) => [x - 1, x + 1] as [number, number]);
    return { s, spans: curbSpans(len, gaps) };
  }), [len]);
  return (
    <group>
      {runs.flatMap(({ s, spans }) => spans.map(([a, b]) => (
        <mesh key={`${s}${a}`} position={[(a + b) / 2, CURB_H / 2, s * (ROAD_HALF + CURB_W / 2)]} castShadow receiveShadow>
          <boxGeometry args={[b - a, CURB_H, CURB_W]} />
          <Surface tex="pavement_02" repeat={surfaceRepeat('pavement_02', b - a, CURB_H * 2)} tier={tier} tint="#c9c5bc" />
        </mesh>
      )))}
    </group>
  );
}

/** Fachada de ladrillo: cierra el fondo de la vía y da escala urbana. */
function Facade({ len, tier }: { len: number; tier: QualityTier }) {
  const windows = useMemo(() => {
    const out: { x: number; lit: boolean }[] = [];
    for (let x = -len / 2 + 2.2, i = 0; x < len / 2 - 1; x += 3.4, i++) {
      if (Math.abs(x - 5) < 2.2) continue; // sobre las persianas
      out.push({ x, lit: (i * 7) % 5 < 2 });
    }
    return out;
  }, [len]);
  return (
    <group position={[0, 0, FACADE_Z - 0.2]}>
      <mesh position={[0, FACADE_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, FACADE_H, 0.4]} />
        <Surface tex="red_brick" repeat={surfaceRepeat('red_brick', len, FACADE_H)} tier={tier} tint="#b4a59a" />
      </mesh>
      {/* Zócalo de concreto */}
      <mesh position={[0, 0.3, 0.22]} receiveShadow>
        <boxGeometry args={[len, 0.6, 0.06]} />
        <meshStandardMaterial color="#55534f" roughness={0.9} />
      </mesh>
      {windows.map((w) => (
        <group key={w.x} position={[w.x, 3.35, 0.205]}>
          <mesh>
            <boxGeometry args={[1.0, 1.25, 0.02]} />
            <meshStandardMaterial color="#2b2622" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[0.86, 1.1]} />
            {w.lit
              ? <meshStandardMaterial color="#3a2a18" emissive="#e8913f" emissiveIntensity={0.32} roughness={0.4} />
              : <meshStandardMaterial color="#0b1018" metalness={0.4} roughness={0.1} />}
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Road({ w, placements, tier, forensicLight }: { w: number; d: number; placements: readonly Placement[]; tier: QualityTier; forensicLight: boolean }) {
  const len = w * 2.2;
  const lamps = placements.filter((p) => p.model === 'street_lamp_01');
  const minusW = -ROAD_HALF - CURB_W - FACADE_Z; // ancho de la acera -z
  const plusW = SIDEWALK_PLUS_Z - ROAD_HALF - CURB_W;
  return (
    <group>
      {/* Berma de pasto bajo todo (se ve tras la acera +z). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, 48]} />
        <Surface tex="sparse_grass" repeat={surfaceRepeat('sparse_grass', len, 48)} tier={tier} tint="#6f7a62" />
      </mesh>
      {/* Calzada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} receiveShadow>
        <planeGeometry args={[len, ROAD_HALF * 2]} />
        <Surface tex="asphalt_02" repeat={surfaceRepeat('asphalt_02', len, ROAD_HALF * 2)} tier={tier} tint="#9a9a9e" roughness={0.95} />
      </mesh>
      <Markings len={len} />
      {/* Aceras (planas: los EMP/EF sobre la acera no quedan enterrados; el bordillo da el desnivel visual). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, -ROAD_HALF - CURB_W - minusW / 2]} receiveShadow>
        <planeGeometry args={[len, minusW]} />
        <Surface tex="pavement_02" repeat={surfaceRepeat('pavement_02', len, minusW)} tier={tier} tint="#a29e96" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, ROAD_HALF + CURB_W + plusW / 2]} receiveShadow>
        <planeGeometry args={[len, plusW]} />
        <Surface tex="pavement_02" repeat={surfaceRepeat('pavement_02', len, plusW)} tier={tier} tint="#a29e96" />
      </mesh>
      <Curbs len={len} tier={tier} />
      <Facade len={len} tier={tier} />
      <Trees trees={TREES} bushes={BUSHES} seed={11} />
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
