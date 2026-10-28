// Cascarón interior: piso texturizado, muros con grosor y zócalo, vano de puerta
// con marco y hoja abierta, ventanas con marco y vidrio. Sin techo (cámara orbital).
// Muros -x y -z completos; +x y +z recortados a la altura de la rodilla.
import { DoubleSide } from 'three';
import type { TextureId } from '../../assets/manifest';
import type { QualityTier } from '../contracts';
import { Surface } from './materials';
import {
  BASEBOARD_H, interiorShell, KNEE_HEIGHT, surfaceRepeat, WALL_HEIGHT, WALL_T, wallPieces, type Opening,
} from './layout';

type Vec3 = [number, number, number];

interface WallProps {
  /** Centro del muro (base, y = 0). */
  position: Vec3;
  rotY: number;
  length: number;
  height: number;
  openings?: readonly Opening[];
  /** Lado del cuarto en z local (+1 o -1): ahí van el zócalo y el alféizar. */
  inner: 1 | -1;
  tier: QualityTier;
  tint: string;
}

const TRIM = '#2a1d14';

function Wall({ position, rotY, length, height, openings = [], inner, tier, tint }: WallProps) {
  const pieces = wallPieces(length, height, openings);
  const baseRuns = pieces.filter((p) => p.y0 === 0);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {pieces.map((p, i) => {
        const w = p.u1 - p.u0, h = p.y1 - p.y0;
        return (
          <mesh key={i} position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, WALL_T]} />
            <Surface tex="white_plaster_02" repeat={surfaceRepeat('white_plaster_02', w, h)} tier={tier} tint={tint} normalScale={0.6} />
          </mesh>
        );
      })}
      {/* Zócalo de madera en la cara interior (se corta en las puertas). */}
      {height > BASEBOARD_H * 2 && baseRuns.map((p, i) => (
        <mesh key={`b${i}`} position={[(p.u0 + p.u1) / 2, BASEBOARD_H / 2, inner * (WALL_T / 2 + 0.012)]} receiveShadow>
          <boxGeometry args={[p.u1 - p.u0, BASEBOARD_H, 0.024]} />
          <Surface tex="dark_wood" repeat={surfaceRepeat('dark_wood', p.u1 - p.u0, BASEBOARD_H)} tier={tier} roughness={0.8} />
        </mesh>
      ))}
      {openings.map((o, i) => (o.kind === 'door' ? <DoorFrame key={`o${i}`} o={o} inner={inner} /> : <WindowFrame key={`o${i}`} o={o} inner={inner} />))}
    </group>
  );
}

/** Marco de puerta (jambas + dintel) y hoja abierta hacia fuera (no invade el cuarto). */
function DoorFrame({ o, inner }: { o: Opening; inner: 1 | -1 }) {
  const t = 0.07, depth = WALL_T + 0.05;
  const u0 = o.center - o.width / 2, u1 = o.center + o.width / 2;
  const leafW = o.width - 0.04;
  // Bisagra en u0, cara exterior; la hoja gira ~75° hacia fuera del cuarto.
  const outer = -inner;
  const angle = -outer * (Math.PI * 0.42);
  return (
    <group>
      {[u0 - t / 2, u1 + t / 2].map((u) => (
        <mesh key={u} position={[u, o.top / 2, 0]} castShadow>
          <boxGeometry args={[t, o.top, depth]} />
          <meshStandardMaterial color={TRIM} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[o.center, o.top + t / 2, 0]} castShadow>
        <boxGeometry args={[o.width + 2 * t, t, depth]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
      <group position={[u0 + 0.02, 0, outer * (WALL_T / 2)]} rotation={[0, angle, 0]}>
        <mesh position={[leafW / 2, (o.top - 0.02) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[leafW, o.top - 0.02, 0.04]} />
          <meshStandardMaterial color="#5b3b24" roughness={0.55} />
        </mesh>
        {/* Manija */}
        <mesh position={[leafW - 0.08, 1.0, inner * 0.035]}>
          <boxGeometry args={[0.12, 0.025, 0.025]} />
          <meshStandardMaterial color="#b9b2a4" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** Ventana: marco, travesaño central, vidrio oscuro (deja ver la noche) y alféizar interior. */
function WindowFrame({ o, inner }: { o: Opening; inner: 1 | -1 }) {
  const t = 0.06, depth = WALL_T + 0.03;
  const h = o.top - o.bottom, cy = (o.top + o.bottom) / 2;
  return (
    <group>
      {[o.center - o.width / 2 + t / 2, o.center + o.width / 2 - t / 2, o.center].map((u, i) => (
        <mesh key={i} position={[u, cy, 0]} castShadow>
          <boxGeometry args={[i === 2 ? t * 0.7 : t, h, depth]} />
          <meshStandardMaterial color="#e4e1da" roughness={0.5} />
        </mesh>
      ))}
      {[o.bottom + t / 2, o.top - t / 2].map((y) => (
        <mesh key={y} position={[o.center, y, 0]} castShadow>
          <boxGeometry args={[o.width, t, depth]} />
          <meshStandardMaterial color="#e4e1da" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[o.center, cy, 0]} renderOrder={1}>
        <planeGeometry args={[o.width - t, h - t]} />
        <meshStandardMaterial color="#0d1a2b" metalness={0.3} roughness={0.05} transparent opacity={0.4} depthWrite={false} side={DoubleSide} envMapIntensity={1.4} />
      </mesh>
      <mesh position={[o.center, o.bottom - 0.02, inner * (WALL_T / 2 + 0.06)]} castShadow receiveShadow>
        <boxGeometry args={[o.width + 0.16, 0.04, 0.14]} />
        <meshStandardMaterial color="#cfcac0" roughness={0.6} />
      </mesh>
    </group>
  );
}

export interface InteriorShellProps {
  w: number;
  d: number;
  decor: string | undefined;
  tier: QualityTier;
}

const SHELL: Record<'apartamento' | 'vivienda', { floor: TextureId; floorTint: string; wallTint: string; floorRot: number }> = {
  // Apartamento: madera clara, muros de yeso gris frío.
  apartamento: { floor: 'wood_floor', floorTint: '#e8dccb', wallTint: '#eef1f5', floorRot: 0 },
  // Vivienda: baldosa de barro, muros de yeso cálido.
  vivienda: { floor: 'terracotta_floor_tiles', floorTint: '#9a8474', wallTint: '#f4e8d4', floorRot: 0 },
};

export function InteriorShell({ w, d, decor, tier }: InteriorShellProps) {
  const sh = interiorShell(decor);
  const look = SHELL[decor === 'vivienda' ? 'vivienda' : 'apartamento'];
  const T = WALL_T;
  return (
    <group>
      {/* Exterior inmediato: patio de concreto oscuro alrededor del cuarto. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w * 2.6, d * 2.6]} />
        <Surface tex="pavement_02" repeat={surfaceRepeat('pavement_02', w * 2.6, d * 2.6)} tier={tier} tint="#2b2d33" />
      </mesh>
      {/* Piso del cuarto (debajo de 0.03: placas y manchas forenses van encima). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <Surface tex={look.floor} repeat={surfaceRepeat(look.floor, w, d)} tier={tier} tint={look.floorTint} roughness={0.9} rotation={look.floorRot} />
      </mesh>
      {/* Fondo (-z) y lateral (-x): completos, con vanos. */}
      <Wall position={[0, 0, -d / 2 - T / 2]} rotY={0} length={w + 2 * T} height={WALL_HEIGHT} openings={sh.back} inner={1} tier={tier} tint={look.wallTint} />
      <Wall position={[-w / 2 - T / 2, 0, 0]} rotY={-Math.PI / 2} length={d} height={WALL_HEIGHT} openings={sh.left} inner={-1} tier={tier} tint={look.wallTint} />
      {/* Cercanos a la cámara (+x, +z): a la rodilla, para leer la planta sin perder el límite. */}
      <Wall position={[w / 2 + T / 2, 0, 0]} rotY={-Math.PI / 2} length={d} height={KNEE_HEIGHT} inner={1} tier={tier} tint={look.wallTint} />
      <Wall position={[0, 0, d / 2 + T / 2]} rotY={0} length={w + 2 * T} height={KNEE_HEIGHT} inner={-1} tier={tier} tint={look.wallTint} />
    </group>
  );
}
