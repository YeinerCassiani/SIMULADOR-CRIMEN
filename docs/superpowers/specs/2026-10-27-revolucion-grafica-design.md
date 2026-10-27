# Revolución gráfica: escena 3D cinematográfica + interfaz de consola forense

Fecha: 2026-10-27 · Proyecto: `simulador-r3f/` · Estado: listo para revisión; ejecución autorizada por la petición del usuario (plan + ejecución inmediata con enjambre de agentes)

## 1. Problema (medido sobre la línea base)

Capturas `/.playwright-mcp/before-1.png` y `before-2.png` (1600×900):

- **Escena**: luz plana sin dirección, sin oclusión ambiental, materiales de color sólido (sin texturas), piso gris uniforme, muros sin grosor, ventanas ni puertas. Muebles mezclan low-poly CC0 con cajas procedurales. Nada comunica "escena del crimen": no hay placas numeradas, cinta, luz forense.
- **Interfaz**: tres columnas de paneles con bordes 1px y radios de 18px, emoji como íconos (🔒), botones grises idénticos, "React Three Fiber" como badge de producto, el visor 3D ocupa ~55% del ancho. Etiquetas `Html` de testigos atraviesan el modal del manual (bug de z-index).

## 2. Resultado medible (lo que cambia y cómo se verá)

| Métrica | Hoy | Meta | Cómo se mide |
|---|---|---|---|
| Área del visor 3D a 1600×900 | ~55% | ≥ 70% | `visual-eval` mide el rect del canvas |
| Contraste tonal de la escena (desv. estándar de luminancia del canvas) | se mide en base | ≥ 1.3× la base | `visual-eval`, por escenario |
| Canvas negro / errores de consola al rotar los 4 escenarios | 0 / 0 | 0 / 0 (no regresión) | `visual-eval` |
| FPS (calidad auto, Chrome headless con GPU por software no cuenta; se reporta) | sin medir | ≥ 50 en calidad media en hardware real; se reporta el número headless | `visual-eval` + `?perf` |
| Emoji usados como ícono en UI | ≥ 2 | 0 | test de lint en `ui.test.ts` |
| Tests vitest | 37 | 37 + nuevos, todos verdes | `npm run test:run` |
| Todo asset 3D externo con licencia CC0 y fuente registrada | parcial | 100% | `manifest.test.ts` |

Línea base de UI ya medida con `inspect.mjs --app` (`.taste-skill/before/report.json`): **5 FAIL, 1 WARN** (micro-etiquetas en mayúsculas, emoji, degradado, sombra pesada, texto < 11px; bordes oscuros). Meta: 0 FAIL.

Evidencia: `simulador-r3f/eval/report.json` + capturas en `simulador-r3f/eval/shots/` (gitignored) y resumen antes/después en el informe final.

## 3. Restricciones heredadas (no negociables, vienen de la memoria del proyecto)

1. **Offline**: nada de CDN en runtime. HDRI, texturas, modelos y fuentes se sirven desde `public/` o se empaquetan. `Environment preset` de drei está prohibido (causó canvas negro).
2. **Prohibido `<SoftShadows>`** de drei (corrompe shaders al cambiar escenario).
3. El reducer (`simulator.ts`) sigue siendo la única autoridad de puntaje. Esta revolución es **visual**: no cambia reglas, puntajes ni tipos de dominio, salvo añadir campos opcionales de presentación.
4. `<group key={scenario.scenarioId}>` se mantiene para remontaje limpio.
5. Todo `useGLTF` va con Suspense + ErrorBoundary y fallback procedural (`GltfProp`): un asset que falla nunca deja la escena en negro.
6. Cámara `near: 1` o mayor (z-fighting resuelto así; no volver a 0.1).
7. **Sin Draco**: `useGLTF(url, true)` descarga el decodificador de gstatic (CDN). Los `.glb` se generan con `gltf-transform webp` (texturas webp, geometría sin comprimir) y se cargan con `useGLTF(url)` sin decoder. Probado: Sofa_01 518 KB a 279 KB.
8. **Un solo tone mapping**: `Canvas gl={{ toneMapping: THREE.NoToneMapping }}` cuando el `ToneMapping` va en el EffectComposer; nunca los dos.
9. **API de Poly Haven** responde 403 sin `User-Agent`: el script envía `User-Agent: simulador-crimen-assets/1.0`.

## 4. Dirección de arte

### 4.1 Escena: "noche de procesamiento"

La escena se procesa de noche bajo luz de trabajo. Idea (de taste-skill): **la placa numerada amarilla de criminalística se vuelve el sistema de señalización de toda la interfaz**, en 3D y en 2D.

- **Iluminación**: tone mapping AgX (o ACES) con exposición por ambiente; HDRI local de Poly Haven (1k, `.hdr`) solo para reflejos/IBL con `background` oscuro propio; luz clave cálida de lámpara de techo (interior) o farol sodio (exterior), relleno frío de luna, luces de trabajo forense (focos en trípode) apuntando a la zona de EMP/EF. Sombras PCF con `shadow-mapSize` según calidad.
- **Postproceso** (`@react-three/postprocessing`, ya instalado): N8AO (oclusión ambiental), Bloom con umbral alto, SMAA, Vignette, ToneMapping al final; N8AO y SMAA se apagan en calidad baja.
- **Calidad adaptativa**: drei `PerformanceMonitor` + `AdaptiveDpr`; función pura `pickTier()` con histéresis decide alta/media/baja; el usuario puede fijarla.
- **Materiales**: texturas PBR CC0 de Poly Haven (1k, webp) para piso de madera, muro de yeso, baldosa, asfalto, pasto, concreto, con `repeat` correcto y `colorSpace` sRGB solo en albedo.
- **Arquitectura**: muros con grosor, zócalo, marco de puerta y ventana (la ventana deja ver el exterior oscuro), techo omitido para cámara orbital.
- **Mobiliario**: modelos CC0 de Poly Haven convertidos a `.glb` con texturas webp (presupuesto ≤ 2 MB por modelo, ≤ 20 MB por escenario). Árboles de Poly Haven pesan 66-214 MB: se descartan; árboles y arbustos siguen procedurales pero mejorados (copas con varias masas, variación de color, instanciados).
- **Elementos forenses** (la identidad del producto): placas numeradas A-frame amarillas (aparecen al señalizar, número del EMP/EF), cinta "NO PASE · CRIMINALÍSTICA" con malla de cinta que ondula al viento en exterior, conos y trípodes de luz, ruta de ingreso/salida como pasos/baldosas de protección en vez de línea punteada, anillo de selección sustituido por halo de selección (Outline del postproceso o contorno drei) en el color de acento.
- **Modo luz forense (la "cosa viva")**: un toggle (tecla `L` y botón) atenúa la escena a penumbra azul-violeta y revela manchas latentes fluorescentes cerca de los EMP/EF biológicos. Es solo visual, no cambia puntaje; el texto del panel explica qué es la luz forense alternativa y que no sustituye el procedimiento.
- **Cámara**: drei `CameraControls`; vuelo de entrada de 1.6 s al cargar/cambiar escenario; al seleccionar un EMP/EF la cámara se acerca y lo encuadra; tecla `Esc` o botón "Vista general" vuelve. Respeta `prefers-reduced-motion` (cortes en vez de vuelos).

### 4.2 Interfaz: "consola forense" (taste-skill app style `data-terminal`, seed 1713392538)

- **Composición**: el visor 3D a pantalla completa como fondo; la interfaz son superficies opacas ancladas a los bordes (no glass, no blur, no sombras salvo en lo que flota).
  - **Riel izquierdo** (56px) con marca del producto (monograma "SC" en placa amarilla) y destinos: Escena, Procedimiento, Marco normativo, Docente, Ajustes.
  - **Barra superior**: nombre del caso, número de caso, ambiente, rol activo (selector), cronómetro en cifras tabulares, puntaje y nivel.
  - **Bandeja de herramientas** inferior centrada: las 10 herramientas como botones con ícono lucide de trazo + etiqueta corta; candado/condición como ícono lucide + texto, nunca emoji. Herramienta activa marcada con la línea de acento de 1px del ancho de la etiqueta (el "move" del estilo).
  - **Inspector derecho** (360px, plegable): lista de EMP/EF, y al seleccionar uno, su ficha con el aspecto de un **rótulo de cadena de custodia** (artefacto real del dominio): campos en tabla, estado de las 8 etapas como fila de marcas, fundamento legal.
  - **Hoja de ruta** del procedimiento: tira horizontal de las etapas sobre la bandeja de herramientas (compacta) con detalle expandible.
  - **Bitácora** como cajón inferior derecho plegable.
  - Modales: misma superficie, scrim 60% negro, las etiquetas `Html` de la escena se ocultan mientras hay modal (arregla el bug).
- **Tokens** (sheet `data-terminal`, acento cambiado por el del mundo del producto): fondo `#171719`, superficie `#131217`, elevado `#212023`, texto `#ffffff`, atenuado `#8a8c92`, **acento `#f2c230` (amarillo placa)**, positivo `#44a282`, negativo `#e5566f`, aviso `#d9a441`. Radios 6px (tarjetas) y 999px (controles). Densidad alta, cuerpo 13px, títulos 20/26px.
- **Tipografía**: Public Sans autoalojada vía `@fontsource-variable/public-sans` (offline), `tabular-nums` en todo número.
- **Íconos**: `lucide-react` (un solo set, trazo 1.5).
- **Accesibilidad**: foco visible, `aria-label` en todo botón de ícono, contraste ≥ 4.5:1, navegación por teclado conservada (lista de EMP/EF), `prefers-reduced-motion`.
- **Responsive**: ≥ 1100px como arriba; < 1100px el inspector pasa a hoja inferior y el riel a barra inferior.

## 5. Arquitectura y límites (para trabajo en paralelo)

Contrato nuevo `src/scene/contracts.ts` (lo escribe el coordinador antes de repartir):

```ts
export type QualityTier = 'alta' | 'media' | 'baja';
export interface ViewSettings {
  quality: 'auto' | QualityTier;   // elección del usuario
  forensicLight: boolean;          // modo luz forense
  labels: boolean;                 // etiquetas Html sobre la escena
  overview: number;                // contador: cada incremento pide volver a vista general
}
export const DEFAULT_VIEW: ViewSettings;
export interface SceneProps { state: SimState; dispatch: Dispatch<Action>; view: ViewSettings; onTierChange?(t: QualityTier): void }
```

Propiedad de archivos (cada agente solo toca lo suyo):

| Unidad | Dueño | Archivos |
|---|---|---|
| Contrato + stubs | coordinador | `src/scene/contracts.ts`, stubs iniciales en `scene/env/`, `scene/forensic/` |
| Pipeline de assets | agente `assets` | `scripts/fetch-assets.mjs`, `public/assets/**`, `src/assets/manifest.ts`, `ASSET_CREDITS.md`, `src/__tests__/manifest.test.ts` |
| Render | agente `render` | `src/scene/Scene.tsx`, `src/scene/render/**` (luces, post, cámara, calidad), `src/__tests__/quality.test.ts` |
| Props forenses | agente `forensic` | `src/scene/forensic/**`, `Evidence.tsx`, `EvidenceModel.tsx`, `Witnesses.tsx`, `src/__tests__/forensic.test.ts` |
| Interfaz | agente `ui` | `src/App.tsx`, `src/App.css`, `src/index.css`, `src/ui/**`, `index.html`, `src/__tests__/ui.test.ts` |
| Harness de evaluación | agente `eval` | `scripts/visual-eval.mjs`, `eval/README.md`, script npm `eval:visual` |
| Ambientes | agente `env` (fase 2, usa assets) | `src/scene/Room.tsx`, `src/scene/env/**`, `src/scene/GltfProp.tsx` |

Dependencias nuevas (ya instaladas por el coordinador para evitar carreras en `package-lock.json`): `lucide-react@1.62.0`, `@fontsource-variable/public-sans@5.3.0`; dev: `@gltf-transform/cli@4.5.1`. Ningún agente instala paquetes.

**Concurrencia en un solo árbol de trabajo**: los agentes de una misma ola NO ejecutan `npm run build` ni `tsc -b` (escriben `dist/` y `tsbuildinfo`). Verifican con `npx tsc -p tsconfig.app.json --noEmit` (solo lectura; ignoran errores en archivos que no son suyos) y `npx vitest run <su test>`. El coordinador integra y corre la puerta completa al final de cada ola.

**Olas**: ola 0 = contrato + stubs + harness de evaluación + línea base medida sobre el árbol sin cambios visuales. Ola 1 = assets, render, forensic, ui en paralelo. Ola 2 = env (usa los assets). Ola 3 = integración, eval, revisión.

## 6. Manejo de errores

- Asset que no carga: `GltfProp` cae al procedural; textura que no carga: material de color plano equivalente (Suspense con fallback de material).
- GPU débil: `PerformanceMonitor` baja a media/baja (sin N8AO, sombras 1024, DPR 1).
- WebGL perdido: `onCreated` registra `webglcontextlost` y la UI muestra un aviso con botón de recarga.
- Fuente no cargada: pila `"Public Sans Variable", system-ui`.

## 7. Pruebas y evaluaciones

- **Gate (vitest, < 2 s)**: `quality.test.ts` (histéresis de `pickTier`), `manifest.test.ts` (cada asset existe en disco, licencia CC0, fuente, presupuesto de tamaño), `forensic.test.ts` (numeración de placas, qué EMP/EF tienen mancha latente), `ui.test.ts` (sin emoji en `src/ui/**`, tokens definidos), más los 37 existentes.
- **Eval periódica** (`npm run eval:visual`, puppeteer-core + Chrome local): por cada escenario carga, cierra el manual, espera estabilidad, captura, mide luminancia media/desviación, detecta negro, cuenta errores de consola, muestrea FPS 3 s, prueba modo luz forense y vuelta entre escenarios; escribe `eval/report.json` con umbrales de aprobación. Corre contra el commit base para la línea base y contra el resultado.

## 8. Fuera de alcance

Cambios de reglas o puntaje; personajes con rig/animación esquelética (testigos siguen siendo maniquíes, mejor modelados); física; i18n; WebGPU.
