import { dealScoreView, type ScoringContext } from "@/lib/deal-score";

const AHORA = new Date("2026-07-10T12:00:00Z");
const hace = (d: number) => new Date(AHORA.getTime() - d * 86_400_000);

// Contexto compartido armado a mano (el adaptador es puro dado el ctx)
const stages = [
  { id: "s1", orden: 1, probabilidad_base: 50, umbral_avance_score: 80 as number | null },
  { id: "s2", orden: 2, probabilidad_base: 70, umbral_avance_score: null as number | null },
];
const CTX: ScoringContext = {
  config: { score_inicial: 50, decay_por_dia: 2, umbral_inactividad_dias: 7, niveles_umbral: [20, 40, 60, 80], sensibilidad_prob: 0.4 },
  avance_modo: "SUGERIR",
  tipos: [{ id: "reu", peso: 40 }, { id: "wa", peso: 10 }],
  resultados: [{ id: "ok", factor: 1 }, { id: "nc", factor: -0.3 }],
  stages,
  stageById: new Map(stages.map((s) => [s.id, s])),
};

const acts = (list: { tipo: string; res: string; dias?: number }[]) =>
  list.map((a) => ({ tipo_accion_id: a.tipo, resultado_id: a.res, created_at: hace(a.dias ?? 0) }));

describe("deal-score adapter — las tres derivaciones salen del mismo score", () => {
  it("Reunión concretada en s1 → score 100, MUY_CALIENTE, prob 70, sugiere avance", () => {
    const v = dealScoreView(CTX, { ajuste_manual: 0, stage_id: "s1", created_at: hace(0), actividades: acts([{ tipo: "reu", res: "ok" }]) }, AHORA);
    expect(v).toEqual({ score: 100, temperatura: "MUY_CALIENTE", probabilidad: 70, cruzaAvance: true, siguienteStageId: "s2" });
  });

  it("deal sin actividad en s1 → score 50, TIBIO, prob interpolada 63, no avanza", () => {
    const v = dealScoreView(CTX, { ajuste_manual: 0, stage_id: "s1", created_at: hace(0), actividades: [] }, AHORA);
    expect(v).toEqual({ score: 50, temperatura: "TIBIO", probabilidad: 63, cruzaAvance: false, siguienteStageId: "s2" });
  });

  it("última etapa (sin umbral) → probabilidad aditiva alrededor del piso, nunca avanza", () => {
    const v = dealScoreView(CTX, { ajuste_manual: 0, stage_id: "s2", created_at: hace(0), actividades: [] }, AHORA);
    expect(v.probabilidad).toBe(70);
    expect(v.cruzaAvance).toBe(false);
    expect(v.siguienteStageId).toBeNull();
  });

  it("decay: reunión concretada pero abandonado 15 días → score 84", () => {
    const v = dealScoreView(CTX, { ajuste_manual: 0, stage_id: "s1", created_at: hace(30), actividades: acts([{ tipo: "reu", res: "ok", dias: 15 }]) }, AHORA);
    expect(v.score).toBe(84);
    expect(v.temperatura).toBe("MUY_CALIENTE");
  });
});
