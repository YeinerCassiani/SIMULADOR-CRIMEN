// Luces prácticas LOCALES del ambiente (lámpara de techo, farol, lámpara de noche).
// Las globales (luna, relleno, IBL, luces de trabajo) son de render/forensic.
// Cantidad fija por montaje: el modo forense atenúa, nunca desmonta (cambiar el
// número de luces recompila todos los shaders). Sombra: solo la primera y solo en
// calidad alta, como spot (1 pasada) en vez de pointLight (6 pasadas).
import { useState } from 'react';
import { Object3D } from 'three';

type Vec3 = [number, number, number];

interface DownLightProps {
  /** Posición de la fuente (bombilla). Apunta en vertical al piso. */
  position: Vec3;
  color: string;
  intensity: number;
  /** Semiángulo del cono (rad). */
  angle: number;
  penumbra?: number;
  distance: number;
  castShadow: boolean;
  shadowSize?: number;
}

/** Foco cenital: el target vive en la escena para que su matriz se actualice. */
export function DownLight({ position, color, intensity, angle, penumbra = 0.8, distance, castShadow, shadowSize = 1024 }: DownLightProps) {
  const [target] = useState(() => new Object3D());
  return (
    <>
      <primitive object={target} position={[position[0], 0, position[2]]} />
      <spotLight
        position={position}
        target={target}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        decay={2}
        castShadow={castShadow}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={0.2}
        shadow-camera-far={distance}
      />
    </>
  );
}

/** Luz puntual pequeña sin sombra (lámpara de mesa). */
export function GlowLight({ position, color, intensity, distance }: { position: Vec3; color: string; intensity: number; distance: number }) {
  return <pointLight position={position} color={color} intensity={intensity} distance={distance} decay={2} />;
}
