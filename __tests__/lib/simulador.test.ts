import { computeSimulador, computeSide, resolverMejora, periodMult, type SimuladorState } from "@/lib/simulador";

// Motor puro del Simulador: embudo → ingreso, mensualización por periodicidad, modo % vs
// absoluto, e impacto (delta mensual/anual, % crecimiento, ventas adicionales).

const base: SimuladorState = {
  period: "mensual", mode: "absolute",
  pct: { leads: 50, precio: 0, cotiz: 55, cierre: 7 },
  actual: { leads: 120, precio: 4500, cotiz: 45, cierre: 28 },
  mejoraAbsolute: { leads: 180, precio: 4500, cotiz: 70, cierre: 35 },
};

describe("simulador", () => {
  it("computeSide: ventas = cotiz × %cierre; ingreso = ventas × precio (mensual)", () => {
    const r = computeSide({ leads: 120, precio: 4500, cotiz: 45, cierre: 28 }, "mensual");
    expect(r.ventasNative).toBeCloseTo(12.6); // 45 × 0.28
    expect(r.ingresoNative).toBeCloseTo(56_700); // 12.6 × 4500
    expect(r.ingreso).toBeCloseTo(56_700); // mensual → mult 1
    expect(r.tasaLeadCotiz).toBeCloseTo(37.5); // 45/120
  });

  it("mensualiza por periodicidad (semanal ×4.33, diario ×30)", () => {
    expect(periodMult("mensual")).toBe(1);
    const sem = computeSide({ leads: 10, precio: 100, cotiz: 10, cierre: 50 }, "semanal");
    expect(sem.ventasNative).toBeCloseTo(5); // nativo (semanal), no escalado
    expect(sem.ventas).toBeCloseTo(5 * 4.33); // mensualizado
  });

  it("impacto: delta mensual/anual, % crecimiento y ventas adicionales", () => {
    const r = computeSimulador(base);
    // actual 56 700, mejora = 70 × 0.35 × 4500 = 110 250
    expect(r.actual.ingreso).toBeCloseTo(56_700);
    expect(r.mejora.ingreso).toBeCloseTo(110_250);
    expect(r.deltaMensual).toBeCloseTo(53_550);
    expect(r.deltaAnual).toBeCloseTo(642_600); // × 12
    expect(r.pctCrecimiento).toBeCloseTo(94.44, 1);
    expect(r.deltaVentas).toBeCloseTo(24.5 - 12.6);
  });

  it("modo % resuelve la mejora sobre el actual (cierre en puntos)", () => {
    const m = resolverMejora({ ...base, mode: "percent" });
    expect(m.leads).toBeCloseTo(180); // 120 × 1.5
    expect(m.cotiz).toBeCloseTo(69.75); // 45 × 1.55
    expect(m.cierre).toBeCloseTo(35); // 28 + 7 puntos
    expect(m.precio).toBeCloseTo(4500); // +0%
  });

  it("cierre en modo % se topa en 100", () => {
    const m = resolverMejora({ ...base, mode: "percent", actual: { ...base.actual, cierre: 98 }, pct: { ...base.pct, cierre: 7 } });
    expect(m.cierre).toBe(100);
  });

  it("% crecimiento es NaN si el actual es 0", () => {
    const r = computeSimulador({ ...base, actual: { leads: 0, precio: 0, cotiz: 0, cierre: 0 } });
    expect(Number.isNaN(r.pctCrecimiento)).toBe(true);
  });
});
