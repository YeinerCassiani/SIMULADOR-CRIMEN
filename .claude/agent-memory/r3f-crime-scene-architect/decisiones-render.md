---
name: decisiones-render
description: Decisiones de render que ya costaron bugs y NO deben revivirse
metadata:
  type: feedback
---

Reglas de render no negociables. **Why:** cada una causó un bug real de "canvas negro" durante la migración. **How to apply:** al tocar `src/scene/Scene.tsx` o iluminación/entorno, respetarlas.

- NO usar `<Environment preset=...>` por CDN. Causaba canvas negro offline (el preset suspende/crashea el árbol R3F si el CDN tarda/bloquea). Usar `<Environment>` con `<Lightformer>` generado localmente (offline, da reflejos PBR a metales).
- NO reintroducir drei `<SoftShadows>` (PCSS). Su parcheo global del shader se corrompía al cambiar de escenario → todos los materiales en negro hasta recargar. Bastan las sombras PCF por defecto del renderer.
- Mantener `<group key={scenario.scenarioId}>` para remontaje limpio al cambiar de escenario.
- Sin assets GLTF de terceros (offline + licencias). Props procedurales en `src/scene/EvidenceModel.tsx` y `Room.tsx`.

Target 60 FPS. Si una optimización/realismo lo sacrifica, dejarlo registrado por escrito con el motivo (regla del proyecto).
