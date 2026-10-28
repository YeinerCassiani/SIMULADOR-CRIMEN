// Punto de entrada del ambiente 3D (contrato: EnvironmentProps). Lo monta Scene.tsx
// dentro de <group key={scenarioId}>. Decide el ambiente (apartamento, vivienda,
// parque, vía), su layout sin colisiones con los EMP/EF y precarga sus assets.
import { memo, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { MODELS } from '../../assets/manifest';
import type { EnvironmentProps } from '../contracts';
import { envKind, envTextures, layoutFor, layoutModels } from './layout';
import { preloadTextures } from './textureData';
import { Interior } from './Interior';
import { Park } from './Park';
import { Road } from './Road';

function SceneEnvironmentImpl({ scenario, tier, forensicLight }: EnvironmentProps) {
  const kind = envKind(scenario);
  const placements = useMemo(() => layoutFor(scenario), [scenario]);
  // Precarga en paralelo los modelos y texturas del escenario activo (idempotente:
  // useGLTF/useTexture cachean por URL; los demás escenarios no se descargan).
  useMemo(() => {
    for (const id of layoutModels(placements)) useGLTF.preload(MODELS[id].url);
    preloadTextures(envTextures(kind));
  }, [placements, kind]);

  const { w, d } = scenario.dimensions;
  switch (kind) {
    case 'abierto':
      return <Park w={w} d={d} placements={placements} tier={tier} forensicLight={forensicLight} />;
    case 'vial':
      return <Road w={w} d={d} placements={placements} tier={tier} forensicLight={forensicLight} />;
    default:
      return <Interior w={w} d={d} decor={kind} placements={placements} tier={tier} forensicLight={forensicLight} />;
  }
}

/**
 * Memo: Scene se re-renderiza en cada TICK (cada segundo en exteriores) y en todo
 * cambio de estado; el ambiente solo depende del escenario, la calidad y la luz forense.
 */
export const SceneEnvironment = memo(SceneEnvironmentImpl, (a, b) =>
  a.scenario === b.scenario && a.tier === b.tier && a.forensicLight === b.forensicLight);
