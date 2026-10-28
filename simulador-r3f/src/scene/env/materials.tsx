// Materiales PBR con las texturas CC0 del manifest (spec §4.1 y §6).
// Cada superficie texturizada va con Suspense (cargando) + AssetBoundary (falla):
// en ambos casos se ve un material de color plano equivalente, nunca negro.
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';
import { RepeatWrapping, SRGBColorSpace, NoColorSpace, Color, type Side, type Texture } from 'three';
import { TEXTURES, type TextureId } from '../../assets/manifest';
import type { QualityTier } from '../contracts';
import { AssetBoundary } from '../GltfProp';
import { anisotropyFor } from './layout';
import { FLAT_COLOR } from './textureData';


export interface SurfaceProps {
  tex: TextureId;
  /** Repeticiones [u, v] (de surfaceRepeat: metros reales / lado de la baldosa). */
  repeat: [number, number];
  tier: QualityTier;
  /** Tinte multiplicativo sobre el albedo (muros fríos/cálidos, asfalto mojado...). */
  tint?: string;
  roughness?: number;
  normalScale?: number;
  envMapIntensity?: number;
  side?: Side;
  polygonOffset?: boolean;
  /** Rotación de la textura en radianes (vetas del piso a lo largo del cuarto). */
  rotation?: number;
}

function flatColor(tex: TextureId, tint?: string): string {
  const c = new Color(FLAT_COLOR[tex]);
  if (tint) c.multiply(new Color(tint));
  return `#${c.getHexString()}`;
}

/** Material plano equivalente (cargando o si la textura falla). */
function FlatMaterial({ tex, tint, roughness = 0.9, side, polygonOffset, envMapIntensity }: SurfaceProps) {
  return (
    <meshStandardMaterial
      color={flatColor(tex, tint)}
      roughness={roughness}
      metalness={0}
      side={side}
      envMapIntensity={envMapIntensity}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffset ? -2 : 0}
      polygonOffsetUnits={polygonOffset ? -2 : 0}
    />
  );
}

function prepare(src: Texture, repeat: [number, number], srgb: boolean, aniso: number, rotation: number): Texture {
  // useTexture devuelve el MISMO objeto a todos: el repeat se fija en un clon
  // (comparte la imagen; three sube una sola vez a GPU por Source).
  const t = src.clone();
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.rotation = rotation;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.anisotropy = aniso;
  t.channel = 0; // aoMap en el uv principal (planos y cajas no tienen uv1)
  t.needsUpdate = true;
  return t;
}

function TexturedMaterial({ tex, repeat, tier, tint, roughness = 1, normalScale = 1, envMapIntensity, side, polygonOffset, rotation = 0 }: SurfaceProps) {
  const maps = TEXTURES[tex].maps;
  const [diffSrc, norSrc, armSrc] = useTexture([maps.diff.url, maps.nor_gl.url, maps.arm.url]);
  const aniso = anisotropyFor(tier);
  const [ru, rv] = repeat;
  const { diff, nor, arm } = useMemo(() => ({
    diff: prepare(diffSrc, [ru, rv], true, aniso, rotation),
    nor: prepare(norSrc, [ru, rv], false, aniso, rotation),
    arm: prepare(armSrc, [ru, rv], false, aniso, rotation),
  }), [diffSrc, norSrc, armSrc, ru, rv, aniso, rotation]);
  useEffect(() => () => { diff.dispose(); nor.dispose(); arm.dispose(); }, [diff, nor, arm]);
  return (
    <meshStandardMaterial
      map={diff}
      normalMap={nor}
      normalScale={[normalScale, normalScale]}
      roughnessMap={arm}
      aoMap={arm}
      aoMapIntensity={0.9}
      color={tint ?? '#ffffff'}
      roughness={roughness}
      metalness={0}
      side={side}
      envMapIntensity={envMapIntensity}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffset ? -2 : 0}
      polygonOffsetUnits={polygonOffset ? -2 : 0}
    />
  );
}

/** Material PBR texturizado con degradación a color plano. Va como hijo de un <mesh>. */
export function Surface(props: SurfaceProps) {
  const flat: ReactNode = <FlatMaterial {...props} />;
  return (
    <AssetBoundary fallback={flat}>
      <Suspense fallback={flat}>
        <TexturedMaterial {...props} />
      </Suspense>
    </AssetBoundary>
  );
}
