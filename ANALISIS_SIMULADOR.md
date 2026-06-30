# Análisis del Simulador 3D de Escena del Crimen y Cadena de Custodia

**Fecha:** 2026-06-21
**Archivo analizado:** `simulador 3D. esena del crimen.html` (535 líneas, HTML + CSS + JS vanilla, sin dependencias)
**Objetivo del análisis:** evaluar estado actual, errores y oportunidades de mejora, y recomendar tecnología (prioridad: **realismo de la escena**).

---

## 1. Resumen ejecutivo

El simulador es una práctica académica sólida y bien pensada para estudiantes de investigación judicial en Colombia. Su mayor fortaleza es **pedagógica**: modela con fidelidad el procedimiento real (asegurar → fijar → recolectar → embalar → rotular → cadena de custodia → entregar) y **penaliza el orden incorrecto** de las acciones. Su mayor debilidad es **técnica y de presentación**: lo que llama "3D realista" es en realidad una proyección **isométrica falsa dibujada sobre Canvas 2D**, sin cámara, sin luces ni profundidad, con varios bugs de render.

Los cuatro puntos más importantes:

1. **El motor de render es el techo del proyecto.** Mientras siga sobre Canvas 2D con proyección manual, el realismo está limitado por diseño.
2. **Hay 6 bugs concretos** (parpadeo del césped, bucle de render permanente, falta de orden por profundidad, detección de clic imprecisa, sin persistencia, "Finalizar" no bloquea).
3. **Datos valiosos están desaprovechados:** testigos con atributos que no se usan individualmente, y el destino de laboratorio que nunca se evalúa.
4. **Recomendación:** migrar **solo la capa de render** a **React Three Fiber con `@json-render/react-three-fiber`**, reutilizando el modelo de escenarios JSON y toda la lógica de puntuación, que son la parte más valiosa del proyecto.

---

## 2. Arquitectura actual

Un único archivo con tres bloques:

- **CSS** (`<style>`): variables en `:root`, layout de tres columnas con CSS Grid (`.app`), tarjetas, modales y media queries responsive (líneas 8-44).
- **HTML**: panel izquierdo (configuración, roles, acciones globales, herramientas), centro (`<canvas>` + HUD + sliders), panel derecho (lista de EMP/EF, bitácora, descargas) y 6 modales (manual, embalaje, rótulo, custodia, informe, editor docente).
- **JavaScript** (`<script>`): estado global en el objeto `app` ([L332](simulador%203D.%20esena%20del%20crimen.html#L332)), datos en `DEFAULT_SCENARIOS` ([L301](simulador%203D.%20esena%20del%20crimen.html#L301)), y la lógica de puntuación, render y exportación.

**Render:** la función `project(x,y,z)` ([L485](simulador%203D.%20esena%20del%20crimen.html#L485)) aplica una rotación solo sobre el eje Y y una proyección isométrica fija; `drawBox` dibuja cajas axis-aligned con caras sombreadas. No existe cámara, iluminación real ni modelos; el "3D" es un truco 2D.

**Modelo de datos (su mejor activo):** cada escenario es un objeto JSON con `evidenceItems`, cada uno con posición `x/z`, dimensiones `w/d/h`, `nature`, `correctPackaging`, `labDestination` y `requiresPhotoBeforeCollection`. El estado de cada EMP/EF se inicializa en `loadScenario` ([L383](simulador%203D.%20esena%20del%20crimen.html#L383)).

---

## 3. Lo que funciona bien (preservar en cualquier evolución)

- **Secuencia con penalizaciones realistas.** Recolectar sin fijar fotográficamente marca el EMP/EF como contaminado y resta 25 puntos ([L421](simulador%203D.%20esena%20del%20crimen.html#L421)); embalar/rotular/cadena sin el paso previo penalizan fuerte. Esto es exactamente lo que debe enseñar.
- **Calificación matizada en formularios.** El rótulo y la cadena de custodia no solo verifican presencia de datos, sino coherencia (NUNC e ID que coincidan, descripción que mencione el elemento) en `saveLabelRecord` ([L447](simulador%203D.%20esena%20del%20crimen.html#L447)) y `saveCustodyRecord` ([L466](simulador%203D.%20esena%20del%20crimen.html#L466)).
- **Editor docente por JSON** ([L529](simulador%203D.%20esena%20del%20crimen.html#L529)): el docente agrega casos sin tocar el código, con validación mínima en `validateScenario`.
- **Buenas prácticas básicas de seguridad:** escapado anti-XSS con `safe()` ([L336](simulador%203D.%20esena%20del%20crimen.html#L336)) en bitácora y lista de EMP/EF.
- **Exportaciones útiles:** informe TXT, registro JSON y bitácora CSV; diseño responsive con dos breakpoints.

---

## 4. Errores y bugs

| # | Severidad | Bug | Ubicación | Detalle |
|---|-----------|-----|-----------|---------|
| 1 | Media | Parpadeo del césped | [L493](simulador%203D.%20esena%20del%20crimen.html#L493) | `drawGrass` llama `Math.random()` en cada frame, así que los 35 puntos de césped saltan de posición 60 veces por segundo. |
| 2 | Media | Bucle de render permanente | [L486](simulador%203D.%20esena%20del%20crimen.html#L486) | `drawLoop` ejecuta `drawScene` vía `requestAnimationFrame` a 60fps aunque no cambie nada. Consumo de CPU/batería innecesario; además `drawScene` ya se llama en cada evento, por lo que el bucle es redundante. |
| 3 | Media | Sin orden por profundidad (z-sorting) | [L487](simulador%203D.%20esena%20del%20crimen.html#L487), [L490-491](simulador%203D.%20esena%20del%20crimen.html#L490) | Los objetos se pintan en orden de array fijo, no por distancia a la cámara. Al rotar la escena, muebles y EMP/EF traseros pueden dibujarse encima de los delanteros. |
| 4 | Media | Detección de clic imprecisa | [L400](simulador%203D.%20esena%20del%20crimen.html#L400), [L516](simulador%203D.%20esena%20del%20crimen.html#L516) | El hit-test usa `e.screen`, que es el rectángulo de la **etiqueta** flotante, no el cuerpo del EMP/EF. Se hace clic "al aire" sobre el elemento y a veces no responde, o responde un elemento equivocado. |
| 5 | Media | Sin persistencia | [L383-387](simulador%203D.%20esena%20del%20crimen.html#L383) | No hay `localStorage`/IndexedDB. Recargar la página o pulsar "Reiniciar" borra todo el progreso; un estudiante que cierra el navegador pierde la práctica. |
| 6 | Baja | "Finalizar" no bloquea | [L521](simulador%203D.%20esena%20del%20crimen.html#L521) | `finalizePractice` solo muestra el informe; se puede seguir actuando y sumando puntos después, lo que invalida el cierre de la evaluación. |

**Observaciones menores:** `colorForNature` ([L510](simulador%203D.%20esena%20del%20crimen.html#L510)) depende de coincidencias frágiles de texto en `nature`; el "Reiniciar" en realidad recarga el escenario actual y no es un reset neutro; el editor docente acumula escenarios en memoria que se pierden al recargar.

---

## 5. Oportunidades de mejora (contenido, pedagogía, UX)

- **Testigos desaprovechados.** Cada testigo tiene `mustBeSeparated` y `hasRelevantInfo` ([L308](simulador%203D.%20esena%20del%20crimen.html#L308)), pero un único botón global "Separar/entrevistar" los trata a todos igual. Oportunidad: convertirlos en personajes clicables con decisiones individuales (separar, entrevistar, registrar versión) que sumen o resten según sus atributos.
- **El destino de laboratorio nunca se evalúa.** "Entregar" siempre acierta hacia `e.labDestination` ([L438](simulador%203D.%20esena%20del%20crimen.html#L438)). Debería ser una **decisión del estudiante** (elegir laboratorio correcto según la naturaleza del EMP/EF), igual que ya ocurre con el embalaje.
- **Narrativa sin mecánica.** El escenario de parque menciona "riesgo de pérdida de EMP/EF por clima y paso de personas" ([L320](simulador%203D.%20esena%20del%20crimen.html#L320)) pero no hay temporizador ni degradación. Un cronómetro opcional daría presión realista en escena abierta.
- **Accesibilidad.** El canvas no es accesible por teclado ni tiene ARIA; la naturaleza del EMP/EF se codifica **solo por color**, lo que excluye a personas con daltonismo. Faltan etiquetas de texto/íconos redundantes.
- **Mantenibilidad.** Archivo monolítico de 535 líneas sin módulos ni pruebas. Cualquier cambio obliga a navegar todo el archivo.
- **Trazabilidad académica.** El resultado solo sale como descarga manual (TXT/JSON/CSV). No hay registro centralizado ni integración con un LMS para que el docente reciba las notas automáticamente.

---

## 6. ¿Existen tecnologías más óptimas que HTML puro? — Comparativa

El criterio principal es **realismo de la escena**; los secundarios son esfuerzo de migración, peso del bundle, facilidad de despliegue y mantenibilidad.

| Tecnología | Realismo | Esfuerzo | Peso / Despliegue | Veredicto |
|------------|----------|----------|-------------------|-----------|
| **Canvas 2D vanilla (actual)** | Bajo (isométrico falso) | — | Mínimo, un archivo | Techo de realismo alcanzado |
| **Three.js (vanilla)** | Alto (3D real, luces, sombras, GLTF) | Medio | Medio, web | Excelente, pero UI manual |
| **React Three Fiber (R3F)** | Alto | Medio | Medio, web | 3D declarativo + UI moderna |
| **`@json-render/react-three-fiber`** | Alto | **Medio-bajo** | Medio, web | **Recomendado** (ver abajo) |
| **Babylon.js** | Alto (inspector, físicas incluidas) | Medio-alto | Mayor | Buena alternativa más "motor" |
| **Godot (export web)** | Muy alto (físicas, editor visual) | Alto | Alto (WASM, decenas de MB) | Sobredimensionado para el caso |
| **Unity WebGL** | Máximo | Muy alto | Muy alto (20-50 MB+, licencia) | Excesivo para uso académico web |

### Recomendación: React Three Fiber con `@json-render/react-three-fiber`

La razón decisiva es que **el simulador ya está dirigido por datos JSON**, y existe un renderer 3D que consume exactamente ese formato. Esto convierte una migración normalmente cara en algo incremental, porque se conserva el activo más valioso (datos + lógica de puntuación) y se reemplaza solo el dibujo.

Cómo encaja, punto por punto:

- **Las cajas actuales pasan a primitivas reales.** Cada `evidenceItem` (con `x/z/w/d/h`) se mapea a un componente `Box` con `position` y `material` PBR (`metalness`, `roughness`, `emissive`). Los muebles dibujados a mano (`drawSofa`, `drawTable`, etc.) se sustituyen por modelos **GLTF** vía el componente `Model`, lo que sube el realismo de golpe.
- **El bug de detección de clic (#4) desaparece.** Three.js trae **raycasting** nativo: `raycaster.setFromCamera(mouse, camera)` + `intersectObjects(...)` selecciona el cuerpo 3D exacto, no una etiqueta. (Skill `threejs-interaction`.)
- **Los sliders de rotación/zoom se reemplazan por `OrbitControls`.** Cámara orbital real con límites configurables (`minDistance`, `maxPolarAngle`), damping y soporte táctil. Adiós a la proyección manual y al bug de z-sorting (#3), que el render 3D resuelve por profundidad automáticamente.
- **Realismo de iluminación.** `AmbientLight` + `DirectionalLight` con `castShadow`, `Environment` con HDRI y `Fog` para el escenario abierto (clima). Eso es justo lo que el Canvas 2D no puede dar.
- **Las etiquetas flotantes de cada EMP/EF** se mantienen con HTML posicionado mediante world-to-screen (`vector.project(camera)`), conservando el HUD actual.
- **Editor docente más potente:** con `TransformControls`/`DragControls` el docente podría **colocar los EMP/EF arrastrándolos** en la escena y exportar el JSON resultante, mejorando el flujo actual de pegar JSON a mano.
- **El bucle de render (#2) y el parpadeo (#1)** se resuelven solos: R3F gestiona el render loop de forma eficiente y el césped pasaría a geometría/instancias estables en vez de `Math.random()` por frame.

Componentes disponibles que cubren la escena (del catálogo de `@json-render/react-three-fiber`): `Box`, `Plane`, `Cylinder`, `Group`, `Model` (GLTF), `Environment` (HDRI), `Fog`, `GridHelper`, `Text3D`, `AmbientLight`/`DirectionalLight`/`SpotLight`, `PerspectiveCamera`, `OrbitControls`.

**Cuándo NO migrar:** si la prioridad fuera "un solo archivo, cero instalación, abrir en cualquier PC sin internet", convendría quedarse en vanilla y solo arreglar los 6 bugs. Como la prioridad declarada es **realismo**, la migración a R3F es la opción correcta.

---

## 7. Hoja de ruta sugerida (incremental, sin compromiso)

- **Fase 0 — Saneamiento sobre el HTML actual (rápida, sin cambiar tecnología).** Arreglar los bugs #1-#6: césped estático, eliminar el bucle redundante (render bajo demanda), ordenar por profundidad, hit-testing sobre el cuerpo del EMP/EF, persistencia con `localStorage`, y bloquear acciones tras "Finalizar". Entrega valor inmediato aunque no se migre.
- **Fase 1 — Profundizar la pedagogía (sobre cualquier base).** Destino de laboratorio como decisión evaluable; testigos individuales clicables; temporizador opcional para escena abierta; accesibilidad (teclado, ARIA, codificación no solo por color).
- **Fase 2 — Migración de render a React Three Fiber.** Reutilizar `DEFAULT_SCENARIOS` y toda la lógica de puntuación; reemplazar `project`/`drawBox`/`draw*` por componentes de `@json-render/react-three-fiber`; cámara `OrbitControls`; selección por raycasting; modelos GLTF para muebles y objetos.
- **Fase 3 — Plataforma (opcional).** Persistencia/multiusuario (Supabase/Firebase) y exportación de notas a LMS vía SCORM/xAPI para que el docente reciba resultados automáticamente.

---

## 8. Conclusión

El simulador tiene un núcleo pedagógico excelente envuelto en un motor de presentación que ya tocó su techo. La ruta de mayor impacto es **conservar los datos y la lógica de calificación tal cual** y **cambiar únicamente la capa de render** a React Three Fiber dirigido por JSON. Eso responde directamente a la prioridad de realismo, resuelve de paso tres de los seis bugs y abre la puerta a modelos 3D, iluminación realista y una cámara de verdad, sin reescribir la parte que hoy hace bien su trabajo.
