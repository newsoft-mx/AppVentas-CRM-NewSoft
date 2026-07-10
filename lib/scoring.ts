// Motor de scoring del deal (feature/scoring-engine).
//
// Un solo número (score 0–100) del que salen las tres lecturas: termómetro (color),
// probabilidad (%) y avance de etapa. Funciones PURAS y testeables (sin Prisma):
//
//   score = clamp( 50 + score_base·50 + ajuste_manual − decay , 0, 100 )
//
//   score_base = Σ_tipos-con-señal [ peso · factorÚltimoResultado ] / Σ pesos     ∈ [−1, +1]
//              = promedio ponderado del ÚLTIMO resultado de cada tipo que ocurrió
//   decay      = max(0, díasInactivo − umbral) · decay_por_día
//
// Editar pesos/factores/config recalcula todo on-read (el score no se persiste;
// solo se guarda `ajuste_manual` en el deal).

import type { Temperatura } from "@/types/crm";

export interface CatalogoTipo {
  id: string;
  /** Peso relativo de la interacción (0 = sin señal). Se normaliza al computar. */
  peso: number;
}
export interface CatalogoResultado {
  id: string;
  /** Calidad del desenlace [−1 … +1]. */
  factor: number;
}
/** Actividad mínima que necesita el motor (ya filtrada: no eliminadas). */
export interface ActividadScore {
  tipo_accion_id: string | null;
  resultado_id: string | null;
  created_at: Date | string;
}
export interface ScoringConfig {
  score_inicial: number; // score de un deal sin señal (ej. 50)
  decay_por_dia: number; // puntos que pierde por día de inactividad tras el umbral
  umbral_inactividad_dias: number; // días de gracia antes de enfriar
  niveles_umbral: number[]; // cortes de los 5 niveles, ej. [20,40,60,80]
  sensibilidad_prob: number; // etapas sin umbral: puntos de prob por punto de score
}

export interface ScoringInput {
  actividades: ActividadScore[];
  tipos: CatalogoTipo[];
  resultados: CatalogoResultado[];
  ajuste_manual: number;
  /** Última vez que se tocó el deal (máx. de actividades o alta del deal). Para el decay. */
  ultimoContacto: Date | string | null;
  config: ScoringConfig;
  ahora: Date;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Score 0–100 del deal (promedio ponderado del último resultado por tipo + ajuste − decay). */
export function computeScore(input: ScoringInput): number {
  const { actividades, tipos, resultados, ajuste_manual, ultimoContacto, config, ahora } = input;
  const pesoDe = new Map(tipos.map((t) => [t.id, t.peso]));
  const factorDe = new Map(resultados.map((r) => [r.id, r.factor]));

  // Último resultado por tipo (solo actividades que capturaron tipo + resultado del catálogo)
  const ultimoPorTipo = new Map<string, { fecha: number; peso: number; factor: number }>();
  for (const a of actividades) {
    if (!a.tipo_accion_id || !a.resultado_id) continue;
    const peso = pesoDe.get(a.tipo_accion_id);
    const factor = factorDe.get(a.resultado_id);
    if (peso == null || factor == null) continue;
    const fecha = new Date(a.created_at).getTime();
    const prev = ultimoPorTipo.get(a.tipo_accion_id);
    if (!prev || fecha > prev.fecha) ultimoPorTipo.set(a.tipo_accion_id, { fecha, peso, factor });
  }

  // Promedio ponderado (solo tipos con peso > 0 aportan señal)
  let num = 0;
  let den = 0;
  for (const { peso, factor } of ultimoPorTipo.values()) {
    if (peso <= 0) continue;
    num += peso * factor;
    den += peso;
  }
  const scoreBase = den > 0 ? num / den : null; // [−1..+1], o null si no hay señal
  const bruto = scoreBase === null ? config.score_inicial : 50 + scoreBase * 50;

  // Decay por inactividad (se enfría solo si nadie lo toca)
  let decay = 0;
  if (ultimoContacto) {
    const dias = Math.floor((ahora.getTime() - new Date(ultimoContacto).getTime()) / 86_400_000);
    decay = Math.max(0, dias - config.umbral_inactividad_dias) * config.decay_por_dia;
  }

  return clamp(Math.round(bruto + ajuste_manual - decay), 0, 100);
}

/** Nivel (color del termómetro) a partir del score, con cortes configurables. */
export function nivelDesdeScore(score: number, cortes: number[]): Temperatura {
  const [c1, c2, c3, c4] = cortes;
  if (score < c1) return "MUY_FRIO";
  if (score < c2) return "FRIO";
  if (score < c3) return "TIBIO";
  if (score < c4) return "CALIENTE";
  return "MUY_CALIENTE";
}

/**
 * Probabilidad de cierre a partir del score.
 * Con umbral: interpola entre el piso de la etapa actual y el de la siguiente,
 * según qué tan cerca está el score del umbral de avance.
 * Sin umbral (o última etapa): modelo aditivo alrededor del piso (± sensibilidad).
 */
export function probabilidadDesdeScore(input: {
  score: number;
  baseActual: number;
  baseSiguiente: number | null;
  umbral: number | null;
  sensibilidad: number;
}): number {
  const { score, baseActual, baseSiguiente, umbral, sensibilidad } = input;
  if (umbral != null && umbral > 0 && baseSiguiente != null) {
    const progreso = clamp(score / umbral, 0, 1);
    return clamp(Math.round(baseActual + (baseSiguiente - baseActual) * progreso), 0, 100);
  }
  return clamp(Math.round(baseActual + (score - 50) * sensibilidad), 0, 100);
}

/** ¿El score alcanzó el umbral de avance de la etapa? (null = la etapa no avanza por score). */
export function cruzaUmbral(score: number, umbral: number | null): boolean {
  if (umbral == null) return false;
  return score >= umbral;
}
