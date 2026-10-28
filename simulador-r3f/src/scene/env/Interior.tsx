// Interiores: apartamento (sala-comedor) y vivienda (dormitorio). Mismo cascarón,
// distinta piel (piso, tinte de muros), mobiliario y luz práctica.
import type { QualityTier } from '../contracts';
import { InteriorShell } from './Architecture';
import { DownLight, GlowLight } from './lights';
import { anchorOffset, PENDANT_CD, practicalIntensity, practicalShadow, WALL_HEIGHT, type Placement } from './layout';
import { MODELS } from '../../assets/manifest';
import { Furniture } from './props';

interface InteriorProps {
  w: number;
  d: number;
  decor: 'apartamento' | 'vivienda';
  placements: readonly Placement[];
  tier: QualityTier;
  forensicLight: boolean;
}

/** Altura del globo emisivo de la lámpara colgante (la luz sale de ahí). */
const lamp = MODELS.modern_ceiling_lamp_01.bbox;
const GLOBE_Y = WALL_HEIGHT + anchorOffset(lamp, 'ceiling')[1] + 0.4;

function Rug({ x, z, w, d, color, border }: { x: number; z: number; w: number; d: number; color: string; border: string }) {
  return (
    <group position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0, 0.026]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={border} roughness={0.95} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh position={[0, 0, 0.028]} receiveShadow>
        <planeGeometry args={[w - 0.24, d - 0.24]} />
        <meshStandardMaterial color={color} roughness={0.97} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </group>
  );
}

export function Interior({ w, d, decor, placements, tier, forensicLight }: InteriorProps) {
  const pendants = placements.filter((p) => p.model === 'modern_ceiling_lamp_01');
  const bedside = placements.find((p) => p.proc === 'bedsideLamp');
  return (
    <group>
      <InteriorShell w={w} d={d} decor={decor} tier={tier} />
      {decor === 'apartamento'
        ? <Rug x={-6.25} z={0.9} w={2.2} d={2.9} color="#5a1f28" border="#2b1418" />
        : <Rug x={0.6} z={-2.65} w={2.6} d={1.5} color="#34452f" border="#22301f" />}
      {/* Sin techo (cámara orbital) la colgante quedaba flotando a media altura:
          se dibuja solo su luz, como en un corte de maqueta. */}
      <Furniture placements={placements.filter((p) => p.model !== 'modern_ceiling_lamp_01')} />
      {/* Luz cálida de las lámparas de techo: la clave práctica del interior. */}
      {pendants.map((p, i) => (
        <DownLight
          key={p.key}
          position={[p.x, GLOBE_Y - 0.08, p.z]}
          color="#ffd2a1"
          intensity={practicalIntensity(decor === 'vivienda' ? PENDANT_CD.vivienda : PENDANT_CD.apartamento, forensicLight)}
          angle={1.45}
          penumbra={0.9}
          distance={9}
          castShadow={practicalShadow(i, tier)}
        />
      ))}
      {bedside && (
        <GlowLight position={[bedside.x, (bedside.y ?? 0) + 0.32, bedside.z + 0.05]} color="#ffc27a" intensity={practicalIntensity(2.2, forensicLight)} distance={4} />
      )}
    </group>
  );
}
