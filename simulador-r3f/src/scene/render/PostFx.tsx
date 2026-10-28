// Postproceso por nivel de calidad (spec §4.1).
//
// - El EffectComposer queda montado en los 3 niveles: al montarse fija
//   gl.toneMapping = NoToneMapping y al desmontarse lo restaura; si se desmontara
//   en 'baja' el look saltaría. El único tone mapping es <ToneMapping> (ACES Filmic), al final.
//   Integración: AgX dejaba la noche en medios tonos planos (desv. de luminancia
//   ~45 con cualquier exposición); ACES tiene pie y hombro más marcados y separa
//   los charcos de luz del relleno. El spec permite ambos (§4.1).
// - memo con props primitivas: el composer reconstruye sus EffectPass cada vez que
//   cambia la identidad de `children`, y Scene se re-renderiza cada segundo (TICK).
// - N8AO siempre montado y habilitado por ref: el wrapper no implementa dispose,
//   montarlo/desmontarlo por nivel perdería render targets.
// - multisampling={0}: el antialiasing lo hace SMAA (MSAA + SMAA sería doble coste).
// - Orden: N8AO (Pass propio) → Bloom → SMAA → Vignette → ToneMapping.
// - Exposición: la anima SceneLighting en gl.toneMappingExposure, que el shader de
//   ToneMappingEffect lee (incluye tonemapping_pars_fragment).
import { memo, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import type { QualityTier } from '../contracts';
import { TIER_CONFIG } from './quality';

// postprocessing 6.39 ToneMappingMode.ACES_FILMIC (build/index.js: `ACES_FILMIC: 6`).
// Literal para no importar 'postprocessing' (dependencia transitiva, no declarada).
const TONE_MAPPING_ACES = 6;

export const PostFx = memo(function PostFx({ tier }: { tier: QualityTier }) {
  const cfg = TIER_CONFIG[tier];
  const ao = useRef<ComponentRef<typeof N8AO>>(null);

  useLayoutEffect(() => {
    if (ao.current) ao.current.enabled = cfg.ao;
  }, [cfg.ao]);

  return (
    <EffectComposer multisampling={0}>
      {/* aoRadius en metros (el escenario mide 16-20 m): 1.2 m oscurece rincones y contacto sin halos. */}
      <N8AO ref={ao} aoRadius={1.2} distanceFalloff={0.5} intensity={2.4} quality="medium" halfRes={cfg.aoHalfRes} />
      {cfg.bloom ? <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.92} luminanceSmoothing={0.2} /> : <></>}
      {cfg.smaa ? <SMAA /> : <></>}
      <Vignette eskil={false} offset={0.3} darkness={0.65} />
      <ToneMapping mode={TONE_MAPPING_ACES} />
    </EffectComposer>
  );
});
