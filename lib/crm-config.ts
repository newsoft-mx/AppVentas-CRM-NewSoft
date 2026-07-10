import { prisma } from "@/lib/prisma";
import type { ScoringConfig } from "@/lib/scoring";

// ── Config del motor de scoring (feature/scoring-engine) ──
const SCORING_DEFAULTS: ScoringConfig = {
  score_inicial: 50,
  decay_por_dia: 2,
  umbral_inactividad_dias: 7,
  niveles_umbral: [20, 40, 60, 80],
  sensibilidad_prob: 0.4,
};

/** Config del motor de scoring desde el singleton CrmConfig (defaults si no existe). */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const row = await prisma.crmConfig.findUnique({ where: { id: "crm" } });
  if (!row) return SCORING_DEFAULTS;
  return {
    score_inicial: row.score_inicial,
    decay_por_dia: row.decay_por_dia,
    umbral_inactividad_dias: row.umbral_inactividad_dias,
    niveles_umbral: Array.isArray(row.niveles_umbral)
      ? (row.niveles_umbral as number[])
      : SCORING_DEFAULTS.niveles_umbral,
    sensibilidad_prob: Number(row.sensibilidad_prob),
  };
}
