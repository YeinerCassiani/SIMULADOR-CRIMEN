---
name: dominio-7-etapas
description: Cómo se modela la máquina de 7 etapas, el scoring y la trazabilidad de custodia
metadata:
  type: project
---

Las 7 etapas procesales (aseguramiento → fijación → recolección → embalaje → rótulo → cadena de custodia → entrega) están implementadas E2E y verificadas.

**Why:** el objetivo de la tarea pedía formalizar una máquina de estados explícita; el reducer ya hacía el flujo con flags + gating, pero no exponía "etapa actual/siguiente".
**How to apply:** al consultar o mostrar progreso por EMP/EF, usar `src/stages.ts` (capa pura, de solo lectura). NO duplicar scoring ahí — el reducer (`simulator.ts`) sigue siendo la autoridad que aplica puntos y gating.

Piezas:
- `src/stages.ts` — STAGES[] (def canónica con order, requires, legalBasis), currentStage(), nextStage(), canTransitionTo(), stagesCompleted(), TOTAL_ITEM_STAGES (=6 de EMP/EF; 7 con ASEGURAMIENTO global). ASEGURAMIENTO es order 0 (global). Probado: detecta huecos (collected sin fijación → no avanza). Derivado puro de EvidenceState.
- `src/simulator.ts` reducer — scoring + gating de orden + penalizaciones; mensajes de error graves ahora citan Ley 906/2004 (arts. 216/254/255).
- `src/report.ts` — buildCustodyChains()/custodyTraceText() reconstruyen la secuencia de traspasos por EMP/EF y detectan rupturas de continuidad (el "recibe" de un tramo debe ser el "entrega" del siguiente, art. 254). El informe TXT incluye "ESTADO POR ETAPA" y "TRAZABILIDAD DE LA CADENA DE CUSTODIA" con conteo de rupturas.
- `src/ui/Hud.tsx` — tarjeta de EMP/EF muestra etapa actual, siguiente y fundamento normativo (.stage-line / .legal-note en App.css).

Medición FPS: drei `<Stats>` opt-in con `?perf` en la URL (`src/scene/Scene.tsx`, const SHOW_PERF). Sin dependencia nueva. Desactivado por defecto para no gastar frame budget.

Verificación tras cambios (2026-06-22): tsc EXIT 0, vite build EXIT 0 (app ~58 KB / vendor ~1.17 MB sin cambio material), dev HTTP 200 sin errores en log.
