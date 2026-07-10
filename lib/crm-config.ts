import { prisma } from "@/lib/prisma";
import type { ScoringConfig } from "@/lib/scoring";
import type { TipoActividad } from "@/types/crm";

export interface CrmConfigData {
  umbral_inactividad_dias: number;
  avance_modo: "SUGERIR" | "AUTOMATICO";
  puntos_actividad: Partial<Record<TipoActividad, number>>;
  enfriamiento_nivel: number;
}

const DEFAULTS: CrmConfigData = {
  umbral_inactividad_dias: 7,
  avance_modo: "SUGERIR",
  puntos_actividad: { LLAMADA: 1, EMAIL: 1, WHATSAPP: 1, NOTA: 0 },
  enfriamiento_nivel: 1,
};

// Lee el singleton de configuración; si no existe (entorno sin seed), usa defaults.
export async function getCrmConfig(): Promise<CrmConfigData> {
  const row = await prisma.crmConfig.findUnique({ where: { id: "crm" } });
  if (!row) return DEFAULTS;
  return {
    umbral_inactividad_dias: row.umbral_inactividad_dias,
    avance_modo: row.avance_modo,
    puntos_actividad:
      (row.puntos_actividad as Partial<Record<TipoActividad, number>>) ?? DEFAULTS.puntos_actividad,
    enfriamiento_nivel: row.enfriamiento_nivel,
  };
}

// ── Motor de scoring (feature/scoring-engine) ──
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
