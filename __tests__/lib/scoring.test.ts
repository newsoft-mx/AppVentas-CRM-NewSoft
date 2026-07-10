import {
  computeScore,
  nivelDesdeScore,
  probabilidadDesdeScore,
  cruzaUmbral,
  type ScoringConfig,
  type CatalogoTipo,
  type CatalogoResultado,
} from "@/lib/scoring";

const CONFIG: ScoringConfig = {
  score_inicial: 50,
  decay_por_dia: 2,
  umbral_inactividad_dias: 7,
  niveles_umbral: [20, 40, 60, 80],
  sensibilidad_prob: 0.4,
};

// Catálogo con los pesos ilustrativos de los ejemplos documentados
const TIPOS: CatalogoTipo[] = [
  { id: "reu", peso: 40 }, // Reunión
  { id: "wa", peso: 10 }, // WhatsApp
  { id: "nota", peso: 0 }, // Nota (sin señal)
];
const RESULTADOS: CatalogoResultado[] = [
  { id: "ok", factor: 1.0 }, // Se concretó
  { id: "nc", factor: -0.3 }, // No contestó
  { id: "no", factor: -1.0 }, // No le interesó
];

const AHORA = new Date("2026-07-10T12:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

function base(actividades: { tipo: string; res: string; dias?: number }[], extra?: Partial<Parameters<typeof computeScore>[0]>) {
  const acts = actividades.map((a) => ({ tipo_accion_id: a.tipo, resultado_id: a.res, created_at: hace(a.dias ?? 0) }));
  return computeScore({
    actividades: acts,
    tipos: TIPOS,
    resultados: RESULTADOS,
    ajuste_manual: 0,
    ultimoContacto: AHORA, // sin decay salvo que el test lo cambie
    config: CONFIG,
    ahora: AHORA,
    ...extra,
  });
}

describe("scoring — ejemplos documentados A/B/C", () => {
  it("A: una Reunión concretada → 100", () => {
    expect(base([{ tipo: "reu", res: "ok" }])).toBe(100);
  });

  it("B: + WhatsApp que no contestó → 87 (el WhatsApp pesa poco)", () => {
    expect(base([{ tipo: "reu", res: "ok" }, { tipo: "wa", res: "nc" }])).toBe(87);
  });

  it("C: la última Reunión sale 'no le interesó' → se desploma a 7", () => {
    // dos reuniones: la vieja concretó, la nueva 'no le interesó' → cuenta la última
    expect(
      base([
        { tipo: "reu", res: "ok", dias: 3 },
        { tipo: "reu", res: "no", dias: 1 },
        { tipo: "wa", res: "nc", dias: 1 },
      ])
    ).toBe(7);
  });
});

describe("scoring — reglas del motor", () => {
  it("sin señal (solo Nota peso 0) → score inicial", () => {
    expect(base([{ tipo: "nota", res: "ok" }])).toBe(50);
  });

  it("deal sin actividades → score inicial", () => {
    expect(base([])).toBe(50);
  });

  it("ajuste manual se suma", () => {
    expect(base([], { ajuste_manual: 20 })).toBe(70);
  });

  it("decay: un deal abandonado 15 días pierde puntos", () => {
    // Reunión concretada = base 100, pero último contacto hace 15 días → −(15−7)×2 = −16
    expect(base([{ tipo: "reu", res: "ok", dias: 15 }], { ultimoContacto: hace(15) })).toBe(84);
  });

  it("dentro del umbral de gracia no enfría", () => {
    expect(base([{ tipo: "reu", res: "ok", dias: 5 }], { ultimoContacto: hace(5) })).toBe(100);
  });

  it("clamp: no baja de 0 ni sube de 100", () => {
    expect(base([{ tipo: "reu", res: "no" }], { ultimoContacto: hace(60) })).toBe(0);
  });
});

describe("scoring — nivel desde score", () => {
  const cortes = [20, 40, 60, 80];
  it.each([
    [0, "MUY_FRIO"], [19, "MUY_FRIO"], [20, "FRIO"], [39, "FRIO"],
    [40, "TIBIO"], [59, "TIBIO"], [60, "CALIENTE"], [79, "CALIENTE"],
    [80, "MUY_CALIENTE"], [100, "MUY_CALIENTE"],
  ] as const)("score %i → %s", (score, nivel) => {
    expect(nivelDesdeScore(score, cortes)).toBe(nivel);
  });
});

describe("scoring — probabilidad", () => {
  it("interpola entre etapas según cercanía al umbral (score 64 → 66%)", () => {
    expect(probabilidadDesdeScore({ score: 64, baseActual: 50, baseSiguiente: 70, umbral: 80, sensibilidad: 0.4 })).toBe(66);
  });

  it("en el piso de la etapa cuando el score es 0", () => {
    expect(probabilidadDesdeScore({ score: 0, baseActual: 50, baseSiguiente: 70, umbral: 80, sensibilidad: 0.4 })).toBe(50);
  });

  it("etapa sin umbral: modelo aditivo alrededor del piso", () => {
    expect(probabilidadDesdeScore({ score: 30, baseActual: 50, baseSiguiente: null, umbral: null, sensibilidad: 0.4 })).toBe(42);
    expect(probabilidadDesdeScore({ score: 80, baseActual: 90, baseSiguiente: null, umbral: null, sensibilidad: 0.4 })).toBe(100); // clamp
  });
});

describe("scoring — cruce de umbral", () => {
  it("cruza al alcanzar o superar el umbral", () => {
    expect(cruzaUmbral(82, 80)).toBe(true);
    expect(cruzaUmbral(80, 80)).toBe(true);
    expect(cruzaUmbral(79, 80)).toBe(false);
  });
  it("sin umbral nunca cruza", () => {
    expect(cruzaUmbral(100, null)).toBe(false);
  });
});
