---
name: arquitectura-r3f
description: Estructura del subproyecto simulador-r3f, versiones del stack y ubicación de cada pieza
metadata:
  type: project
---

Subproyecto activo: `simulador-r3f/` (Vite + React 19 + TypeScript). Entry `src/main.tsx` → `src/App.tsx`.

Stack (package.json, verificado 2026-06-21):
- @react-three/fiber ^9.6.1, @react-three/drei ^10.7.7, three ^0.184.0, react ^19.2.6, vite ^8, typescript ~6.0.2.
- Build sano: `tsc -b` y `vite build` pasan (EXIT 0). Bundle vendor-r3f ~1.17 MB / ~326 KB gzip; app ~54 KB. code-splitting en vite.config (manualChunks).

Dónde vive cada cosa:
- Tipos de dominio: `src/types.ts` (ToolId, EvidenceItem, Scenario, LabelRecord, CustodyRecord, EvidenceState, WitnessState, LAB_DESTINATIONS, PACKAGING_LABELS, ROLES).
- Reducer / state machine implícita: `src/simulator.ts` (initState, reducer, grade, progressPercent, phaseLabel, normalize). Scoring y gating de orden viven aquí.
- Datos de escenarios: `src/data/scenarios.ts` (2 escenarios: SCN-CER-001 apartamento cerrado, SCN-ABI-001 parque abierto).
- Reporte/export: `src/report.ts` (buildReport TXT, exportData JSON, buildCSV, validateScenario, downloadText).
- Persistencia: `src/persistence.ts` (localStorage key `simulador-crimen-r3f-v2`; no restaura modales).
- Escena 3D: `src/scene/` (Scene.tsx monta el único `<Canvas>`; Room, Evidence, EvidenceModel, Witnesses). Cámara [12,11,14] fov 45. OrbitControls con damping.
- UI: `src/ui/Hud.tsx` (paneles izq/der, herramientas, globales, bitácora, descargas) y `src/ui/Modals.tsx` (package/label/custody/deliver/report/teacher/manual).

Convenciones: estado por `useReducer` en App; render 100% data-driven desde `state`. Lógica de negocio en reducer/report, NO en componentes de render. Comentarios en español. Props procedurales, sin assets GLTF externos (offline, licencias).

El flujo E2E de las 7 etapas (aseguramiento→fijación→recolección→embalaje→rótulo→custodia→entrega) YA está implementado y verificado; no reescribir.
