// Datos de texturas del ambiente sin componentes (Fast Refresh exige que
// materials.tsx exporte solo componentes): color plano de respaldo y precarga.
import { useTexture } from '@react-three/drei';
import { TEXTURES, type TextureId } from '../../assets/manifest';

/** Color medio de cada albedo: el fallback plano se parece a la textura. */
export const FLAT_COLOR: Record<TextureId, string> = {
  wood_floor: '#7a5636',
  terracotta_floor_tiles: '#9a5a3e',
  white_plaster_02: '#d6d1c8',
  dark_wood: '#3a281c',
  asphalt_02: '#3b3b3d',
  pavement_02: '#7b776f',
  sparse_grass: '#4b5a2c',
  forest_ground_05: '#4a3c2c',
  red_brick: '#8a4433',
};

/** Precarga las texturas de un ambiente (las mismas URL que usa Surface). */
export function preloadTextures(ids: readonly TextureId[]) {
  for (const id of ids) {
    const mp = TEXTURES[id].maps;
    useTexture.preload([mp.diff.url, mp.nor_gl.url, mp.arm.url]);
  }
}
