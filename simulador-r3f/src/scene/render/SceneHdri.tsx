// IBL de la escena (spec §4.1): HDRI LOCAL de public/assets solo para reflejos,
// nunca como fondo (background={false}; el fondo nocturno lo pone Atmosphere).
//
// Reglas heredadas: prohibido `preset` (CDN → canvas negro). El HDRI va dentro de
// su propio <Suspense> + ErrorBoundary con el entorno de Lightformer como respaldo:
// mientras carga o si falla (404, parseo), la escena sigue visible con reflejos.
// Un solo HDRI para todos los ambientes: cambiar de escenario no vuelve a suspender.
// La intensidad (scene.environmentIntensity) la anima SceneLighting por ambiente
// y por modo forense; aquí no se fija para no pelear con ese control.
import { memo, Suspense } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { RenderErrorBoundary } from './ErrorBoundary';
import { findHdriUrl } from './presets';

// El manifiesto lo genera el agente assets (src/assets/manifest.ts). Se busca con
// import.meta.glob: si el archivo aún no existe el glob queda vacío (sin error de
// compilación) y se usa el Lightformer; cuando aparece, Vite lo recoge.
const manifestModules = import.meta.glob('../../assets/manifest.ts', { eager: true });
const HDRI_URL: string | null = findHdriUrl(manifestModules);

/** Entorno generado en runtime (offline, no suspende): luces de estudio tenues y frías de noche. */
function LightformerEnv({ closed }: { closed: boolean }) {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={closed ? 1.2 : 0.9} color={closed ? '#ffd9a8' : '#b9cdf0'} scale={[10, 10, 1]} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={0.6} color="#7f96c8" scale={[8, 5, 1]} position={[-9, 4, -7]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="circle" intensity={0.7} color="#ffe6c4" scale={4} position={[8, 4, 6]} rotation={[0, -Math.PI / 4, 0]} />
    </Environment>
  );
}

export const SceneHdri = memo(function SceneHdri({ closed }: { closed: boolean }) {
  // key: el cubemap se hornea una vez (frames=1); cambiar de ambiente lo regenera.
  const fallback = <LightformerEnv key={closed ? 'int' : 'ext'} closed={closed} />;
  if (!HDRI_URL) return fallback;
  return (
    <RenderErrorBoundary fallback={fallback} label={`HDRI ${HDRI_URL}`}>
      <Suspense fallback={fallback}>
        <Environment files={HDRI_URL} background={false} />
      </Suspense>
    </RenderErrorBoundary>
  );
});
