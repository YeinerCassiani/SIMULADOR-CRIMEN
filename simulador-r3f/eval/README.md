# Evaluación visual (`npm run eval:visual`)

Harness determinista de la sección 7 del spec (`docs/superpowers/specs/2026-10-27-revolucion-grafica-design.md`).
Abre el simulador en Chrome/Edge local con `puppeteer-core`, recorre los 4 escenarios y mide la escena 3D.

## Uso

```bash
# servidor de desarrollo corriendo (npm run dev, por defecto http://localhost:5199)
npm run eval:visual -- --label before          # línea base
npm run eval:visual -- --label after           # compara contra eval/before/report.json
node scripts/visual-eval.mjs --url http://localhost:5199 --out eval --label after --only 0,3 --gl gpu
```

| Opción | Defecto | Qué hace |
|---|---|---|
| `--url` | `http://localhost:5199` | URL del simulador |
| `--out` | `eval` | Carpeta de salida |
| `--label` | `before` | `before` = base; `after` activa los umbrales de la meta si existe `eval/before/report.json` |
| `--gl` | `gpu` | `gpu` = GPU real vía ANGLE/D3D11 (~20 s por corrida). `swiftshader` = GPU por software (portable, ~6 min, ~1 FPS) |
| `--only` | todos | Índices de escenario separados por coma |
| `--wait` | `2500` | ms de espera tras cargar/cambiar escenario |
| `--fps-ms` | `3000` | Ventana de muestreo de FPS |
| `--headful` | no | Muestra el navegador |

Navegador: `CHROME_PATH` si está definido; si no, Chrome y luego Edge en sus rutas típicas de Windows/Linux/macOS.

Salida: `eval/<label>/report.json` (por escenario + `aggregate`) y capturas en `eval/shots/<label>/` (ignoradas por git: `eval/.gitignore`).
Código de salida: 0 si todo pasa, 1 si falla algún umbral, 2 si el harness revienta.

## Qué mide, por escenario

Cada escenario se evalúa en un contexto de navegador nuevo (localStorage limpio), viewport 1600×900.

1. Carga; si hay pantalla de bienvenida espera a que "Entrar" se habilite (tope 45 s), guarda `window.__splash` en `splash` (`readyMs`: ms hasta escena lista, `items`: recursos cargados, `errors`: recursos que fallaron) y entra. Luego cierra el modal "Manual", selecciona el escenario, espera `--wait`.
2. Espera a que la red quede inactiva (`waitForNetworkIdle`, 800 ms, tope 30 s): los `.glb`, texturas y HDRI del escenario tienen que haber llegado, si no la captura cae en un cuadro a medio cargar.
   Captura con `page.screenshot` recortado al **rect de escena libre** (`freeSceneRect`): el canvas menos `.rail`, `.topbar`, `.inspector` y `.dock`. Con el visor a pantalla completa (≥ 70 % del viewport) el canvas queda debajo de paneles opacos; medir la luminancia sobre ellos mediría la UI, no la escena. La base (`before`) ya era un canvas sin UI encima, así que la comparación de contraste es justa con este recorte. No depende de `preserveDrawingBuffer` e incluye las etiquetas HTML que se dibujan sobre la escena. Archivo `s<i>.png`. El `area-canvas` se sigue midiendo sobre el canvas completo.
3. Luminancia Rec.709 sobre sRGB (0..255): media, desviación estándar, fracción de píxeles casi negros (< 8/255). PNG decodificado con `zlib` de Node (`scripts/visual-eval-lib.mjs`, sin dependencias).
4. Rect del canvas como % del viewport.
5. Errores de consola (`console.error`) y `pageerror`.
6. FPS por `requestAnimationFrame` durante 3 s (se reporta, no es umbral) y `window.__scenePerf` (nivel de calidad, draw calls, triángulos) en `perf`. Cerrar cualquier otra pestaña que renderice la escena: comparte la GPU y hunde los FPS (medido: 1-7 fps con una pestaña de Playwright abierta, 35-50 sin ella).
7. Cambia a otro escenario y vuelve: captura `s<i>-switchback.png` y verifica que no quede negro.
8. Luz forense: busca un control con texto/aria-label/title "luz forense"; si no existe, pulsa la tecla `L`. Captura `s<i>-forense.png`. `forensic.available` es true si había control o si la imagen cambió (|Δmedia| o |Δdesv.| > 2). Informativo, no es umbral.

## Umbrales (`THRESHOLDS` en `scripts/visual-eval-lib.mjs`)

| Check | before | after (con base) |
|---|---|---|
| `no-negro` y `no-negro-tras-cambio` | casi-negro < 0.85 y desv. > 12 | igual |
| `errores-consola` | 0 | 0 |
| `area-canvas` | ≥ 50 % | ≥ 70 % |
| `contraste-vs-base` | (no aplica) | desv. ≥ 1.3 × desv. base del mismo escenario (por título) |

## Selectores (la UI cambia: se localiza por texto, nunca por clases)

| Control | Estrategia |
|---|---|
| Bienvenida | `[data-splash-enter]` (atributo estable, no clase); habilitado = carga lista |
| Modal manual | primer `<button>` cuyo texto empieza con "Entendido" (se abre al empezar la práctica) |
| Escenario | 0) pantalla de inicio: `[data-home]` si ya hay práctica, `[data-start-student]`, la tarjeta `[data-start-case="<título>"]`, dos veces `[data-start-next]` (rol por defecto) y `[data-start-go]`; 1) versiones antiguas: `<select>` con ≥ 2 opciones cuyo texto es un título de escenario (títulos leídos de `src/data/scenarios.ts` con regex `title: '...'`), se usa `elementHandle.select()` que dispara `change`; 2) si no hay select: primer `[role=option|radio|tab|menuitem|menuitemradio]`, `button` o `a` cuyo texto o aria-label contiene el título |
| Canvas 3D | el `<canvas>` de mayor área |
| Luz forense | `button`, `[role=switch|checkbox|button]`, `input[type=checkbox]` o `label` con /luz\s+forense/i en texto, aria-label o title; si no, tecla `L` |

No hay parámetro de URL `?scenario=` en la app; si la UI lo añade, puede sumarse como estrategia 0.
Si el rediseño cambia los títulos de escenario o el texto "Entendido", hay que actualizar estas estrategias.

## Línea base (2026-10-27, commit e752137, árbol sin cambios visuales)

`--gl gpu` (ANGLE, AMD Radeon RX Vega 11, D3D11). `eval/before/report.json`. La corrida equivalente con SwiftShader está en `eval/before/report-swiftshader.json` (mismas luminancias ±0.1, FPS 0.3–1.1).

| # | Escenario | Lum. media | Desv. | Casi-negro | Canvas % | FPS | Errores | Luz forense |
|---|---|---|---|---|---|---|---|---|
| 0 | Apartamento urbano | 71.99 | 45.64 | 0.0261 | 49.07 | 69.5 | 0 | no existe |
| 1 | Parque público | 88.46 | 42.15 | 0 | 49.07 | 66.4 | 0 | no existe |
| 2 | Vivienda (NNA) | 70.47 | 44.65 | 0.0249 | 49.07 | 62.0 | 0 | no existe |
| 3 | Vía pública | 84.06 | 44.01 | 0 | 49.07 | 48.0 | 0 | no existe |

Canvas: 890×794 px en (345, 93), 49.07 % del viewport (el spec estimaba ~55 %): la base falla `area-canvas ≥ 50 %`, es el dato real.
Metas `after`: canvas ≥ 70 %; desviación ≥ 59.33 / 54.80 / 58.05 / 57.21 (escenarios 0–3); 0 negros, 0 errores.

## Tests

`src/__tests__/visualEvalMath.test.ts` cubre las funciones puras (decodificación PNG con filtros, luminancia, umbrales, agregado). Gate: `npx vitest run src/__tests__/visualEvalMath.test.ts`.

## Resultado `after` (integración ola 3)

`eval/after/report.json`, misma GPU (RX Vega 11, ANGLE/D3D11), recorte de escena libre:

| # | Escenario | Lum. media | Desv. | Meta desv. | Canvas % | FPS (nivel) | Errores |
|---|---|---|---|---|---|---|---|
| 0 | Apartamento urbano | 68.55 | 61.91 | 59.33 | 100 | 48.1 (alta) | 0 |
| 1 | Parque público | 50.32 | 55.55 | 54.80 | 100 | 43.7 (media) | 0 |
| 2 | Vivienda (NNA) | 51.03 | 48.68 | 58.05 | 100 | 38.7 (media) | 0 |
| 3 | Vía pública | 52.74 | 59.86 | 57.21 | 100 | 42.0 (media) | 0 |

La vivienda queda en 1.09× la base. La base era una escena diurna plana con muros blancos contra un cielo oscuro; la de ahora es nocturna y la domina un piso de baldosa de tono medio. Con más exposición o charcos más intensos la media sube, pero la desviación casi no se mueve: se ganaba menos de 1 punto por iteración y el charco de la colgante ya roza el blanco. Se dejó así para no quemar la imagen.
