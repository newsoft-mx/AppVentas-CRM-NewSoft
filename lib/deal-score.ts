// SSOT del scoring del deal (feature/scoring-engine).
//
// ÚNICO lugar que traduce datos de Prisma → { score, temperatura, probabilidad, avance }.
// Envuelve al motor puro `lib/scoring.ts`. TODOS los consumidores (Kanban, detalle,
// endpoint de actividades, override manual, reportes) DEBEN pasar por acá.
// PROHIBIDO re-derivar score/temperatura/probabilidad en componentes o endpoints.
// Ver DOMAIN.md y la memoria feedback_ssot_reglas_derivadas.

import { prisma } from "@/lib/prisma";
import { getScoringConfig } from "@/lib/crm-config";
import {
  computeScore,
  nivelDesdeScore,
  probabilidadDesdeScore,
  cruzaUmbral,
  type ActividadScore,
  type ScoringConfig,
} from "@/lib/scoring";
import type { Temperatura } from "@/types/crm";

interface StageCtx {
  id: string;
  orden: number;
  probabilidad_base: number;
  umbral_avance_score: number | null;
}

/** Contexto compartido: se carga UNA vez por request y se reusa para todos los deals (evita N+1). */
export interface ScoringContext {
  config: ScoringConfig;
  tipos: { id: string; peso: number }[];
  resultados: { id: string; factor: number }[];
  stages: StageCtx[]; // activas, ordenadas por `orden`
  stageById: Map<string, StageCtx>;
}

/** Carga config + catálogos + etapas una sola vez. */
export async function getScoringContext(): Promise<ScoringContext> {
  const [config, tipos, resultados, stages] = await Promise.all([
    getScoringConfig(),
    // Todos (incluye inactivos): una actividad histórica debe resolver su peso/factor.
    prisma.tipoAccion.findMany({ select: { id: true, peso: true } }),
    prisma.resultadoAccion.findMany({ select: { id: true, factor: true } }),
    prisma.pipelineStage.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, orden: true, probabilidad_base: true, umbral_avance_score: true },
    }),
  ]);
  const stagesCtx: StageCtx[] = stages.map((s) => ({
    id: s.id,
    orden: s.orden,
    probabilidad_base: s.probabilidad_base,
    umbral_avance_score: s.umbral_avance_score,
  }));
  return {
    config,
    tipos: tipos.map((t) => ({ id: t.id, peso: t.peso })),
    resultados: resultados.map((r) => ({ id: r.id, factor: Number(r.factor) })),
    stages: stagesCtx,
    stageById: new Map(stagesCtx.map((s) => [s.id, s])),
  };
}

/** Lo mínimo que necesita el motor por deal (actividades = no eliminadas). */
export interface DealScoreInput {
  ajuste_manual: number;
  stage_id: string;
  created_at: Date | string;
  actividades: ActividadScore[];
}

export interface DealScoreView {
  score: number;
  temperatura: Temperatura;
  probabilidad: number;
  cruzaAvance: boolean;
  siguienteStageId: string | null;
}

/** Última vez que se tocó el deal (para el decay): máx. de actividades o el alta del deal. */
function ultimoContacto(acts: ActividadScore[], dealCreated: Date | string): Date {
  let maxMs = new Date(dealCreated).getTime();
  for (const a of acts) maxMs = Math.max(maxMs, new Date(a.created_at).getTime());
  return new Date(maxMs);
}

/**
 * Read-model del deal: score y sus tres derivaciones. PURO dado el contexto.
 * Este es el único punto de derivación del scoring en toda la app.
 */
export function dealScoreView(ctx: ScoringContext, deal: DealScoreInput, ahora: Date): DealScoreView {
  const score = computeScore({
    actividades: deal.actividades,
    tipos: ctx.tipos,
    resultados: ctx.resultados,
    ajuste_manual: deal.ajuste_manual,
    ultimoContacto: ultimoContacto(deal.actividades, deal.created_at),
    config: ctx.config,
    ahora,
  });

  const etapa = ctx.stageById.get(deal.stage_id) ?? null;
  const siguiente = etapa ? ctx.stages.find((s) => s.orden > etapa.orden) ?? null : null;
  const umbral = etapa?.umbral_avance_score ?? null;

  const probabilidad = probabilidadDesdeScore({
    score,
    baseActual: etapa?.probabilidad_base ?? 0,
    baseSiguiente: siguiente?.probabilidad_base ?? null,
    umbral,
    sensibilidad: ctx.config.sensibilidad_prob,
  });

  return {
    score,
    temperatura: nivelDesdeScore(score, ctx.config.niveles_umbral),
    probabilidad,
    cruzaAvance: Boolean(siguiente) && cruzaUmbral(score, umbral),
    siguienteStageId: siguiente?.id ?? null,
  };
}
