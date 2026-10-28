# Simulador 3D de escena del crimen (React Three Fiber)

Simulador de procesamiento de escena con cadena de custodia. Es React 19 + TypeScript + Vite, con la escena en `@react-three/fiber` y `drei`. Funciona offline: modelos, texturas, HDRI y fuentes se sirven desde `public/` o van empaquetados, y no hay CDN en runtime.

```bash
npm install
npm run dev            # http://localhost:5173 (añadir ?perf para ver fps/draws/nivel)
npm run test:run       # gate vitest (< 2 s de tests)
npm run lint
npm run build          # tsc -b + vite build
```

## Arquitectura visual

La única frontera entre la interfaz y la escena es `src/scene/contracts.ts`: `ViewSettings`, `SceneProps`, `EvidenceProps`, `EnvironmentProps`, `ForensicLayerProps` y `WitnessesProps`. El reducer `src/simulator.ts` es la única autoridad de reglas y puntaje; todo lo visual se limita a leer el estado.

| Carpeta | Qué contiene |
|---|---|
| `src/scene/Scene.tsx` | Canvas con PCF, `near: 1` y sin tone mapping propio. Incluye `<group key={scenarioId}>` para remontar al cambiar de escenario, el aviso `scene:contextlost` y `?quality=alta\|media\|baja`. |
| `src/scene/render/` | Luz global de noche: ambiente, hemisférica, luna, clave direccional del interior, relleno y baño de muros, UV forense. También el postproceso (N8AO, Bloom, SMAA, Vignette y un solo `ToneMapping` ACES), la cámara (`CameraControls`, vuelo de entrada, encuadre del EMP/EF, desplazamiento por los paneles), la calidad adaptativa (`pickTier` con histéresis) y el HDRI local. |
| `src/scene/env/` | Los cuatro ambientes (apartamento, vivienda, parque, vía): arquitectura con vanos, mobiliario CC0 (`GltfProp`) y materiales PBR (`Surface`). Las luces prácticas (colgantes, faroles de sodio, lámpara de noche) y el layout puro (`layout.ts`) quitan los muebles que chocan con un EMP/EF. |
| `src/scene/forensic/` | Capa forense: cinta "NO PASE", ruta de placas de paso, trípodes de trabajo (modelo y luz), manchas latentes del modo luz forense, placas numeradas, regla fotográfica y halo de selección (`Evidence.tsx`), maquetas de los EMP/EF (`EvidenceModel.tsx`) y testigos (`Witnesses.tsx`). |
| `src/ui/` | Consola forense: riel, barra superior, bandeja de herramientas, inspector con el rótulo de cadena de custodia, hoja de ruta, bitácora y modales. La lógica pura está en `logic.ts` y `roadmap.ts`. |

Las reglas de reparto de luces se fijaron en la integración y las prueba `integration.test.ts`. Los focos de trabajo los monta solo `forensic`; render ilumina únicamente lo global. Las luces no se montan ni desmontan por calidad o modo forense, solo cambian de intensidad, para no recompilar shaders.

Restricciones heredadas (ver `docs/superpowers/specs/2026-10-27-revolucion-grafica-design.md` §3): no usar drei `<SoftShadows>` ni `Environment preset`, no usar Draco y no cargar nada por CDN.

## Assets (Poly Haven, CC0)

`scripts/fetch-assets.mjs` descarga modelos, texturas e HDRI. Convierte los `.glb` con `gltf-transform webp` (sin Draco ni meshopt) y genera `src/assets/manifest.ts` y `../ASSET_CREDITS.md`. Es idempotente gracias a `public/assets/assets.lock.json`.

```bash
node scripts/fetch-assets.mjs            # solo lo que falta o cambió
node scripts/fetch-assets.mjs --force    # rehace todo
node scripts/fetch-assets.mjs --only=Sofa_01
```

`manifest.test.ts` verifica que cada archivo exista con los bytes del manifest, que la licencia sea CC0, la fuente, el presupuesto (≤ 2.5 MB por modelo, ≤ 45 MB en total) y que no haya Draco.

## Evaluación visual

`npm run eval:visual -- --label after` usa puppeteer-core con el Chrome local contra el servidor de desarrollo (`--url`, por defecto http://localhost:5199). Por cada escenario mide la luminancia y el contraste del área de escena libre de paneles, detecta canvas negro también tras cambiar de escenario e ir y volver, cuenta los errores de consola, mide el área del canvas, los FPS y el nivel de calidad, y prueba la luz forense. Compara contra `eval/before/report.json`. El detalle, los umbrales y el último resultado están en `eval/README.md`. Mientras corre, cierra cualquier otra pestaña con la escena, porque comparte la GPU.
