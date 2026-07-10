# DOMAIN.md — Reglas de dominio y dónde vive su ÚNICA implementación

> Mapa de invariantes del negocio. **Antes de implementar una regla derivada, buscá acá
> su helper canónico e importalo. Prohibido re-derivar la misma regla inline en
> componentes/pantallas/endpoints.** (Ver memoria `feedback_ssot_reglas_derivadas`.)

## Scoring del deal (termómetro / probabilidad / avance de etapa)

**Regla:** el "estado" comercial de un deal es UN número — el **score 0–100** — del que
salen sus tres lecturas. No se persiste: se **deriva on-read**. Único estado persistido
del score = `Deal.ajuste_manual`.

**Única implementación:**
- Motor puro (fórmula): **`lib/scoring.ts`** — `computeScore`, `nivelDesdeScore`, `probabilidadDesdeScore`, `cruzaUmbral`.
- Adaptador SSOT (Prisma → view-model): **`lib/deal-score.ts`** — `getScoringContext()` + `dealScoreView(ctx, deal, ahora)` → `{ score, temperatura, probabilidad, cruzaAvance, siguienteStageId }`.

**Cómo se consume (todos importan el adaptador, nadie re-deriva):**
- Kanban (`app/(dashboard)/pipeline/page.tsx`), detalle (`pipeline/[id]/page.tsx`),
  endpoint de actividades, override manual y reportes → `dealScoreView`.
- Los componentes (`PipelineKanban`, `DealDetalleClient`, `Termometro`) **solo muestran**
  `score`/`temperatura`/`probabilidad` recibidos por props.

**Fórmula (resumen):** `score = clamp(50 + score_base·50 + ajuste_manual − decay, 0, 100)`,
`score_base` = promedio ponderado del último resultado por tipo (`Σ peso·factor / Σ peso`).
`peso` (TipoAccion) y `factor` (ResultadoAccion, [−1..+1]) son editables en Configuración.
Nivel por rangos configurables; probabilidad interpola piso etapa → siguiente según
`score/umbral_avance_score`; decay por inactividad.

**Prohibido:** leer `deal.temperatura` / `deal.probabilidad` persistidos como fuente de
verdad (quedan como columnas muertas hasta la migración de limpieza), o re-implementar la
fórmula en un componente/endpoint.

**Tests del invariante:** `__tests__/lib/scoring.test.ts` (tabla de verdad) +
`__tests__/lib/deal-score.test.ts` (adaptador). El mismo deal debe dar el mismo score en
todos los consumidores por construcción (todos llaman a `dealScoreView`).
