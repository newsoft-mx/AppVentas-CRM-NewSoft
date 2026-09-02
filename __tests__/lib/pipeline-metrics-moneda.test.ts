import { metricasPipeline } from "@/lib/pipeline-metrics";

/**
 * El valor del pipeline no puede sumar dólares como si fueran pesos.
 *
 * El encabezado del tablero rotula ese número "MXN en pipeline". Con un tipo de cambio de ~17,
 * un deal cargado en USD 50.000 entraba como $50.000: casi un millón de subvaluación por cada
 * uno, en silencio. Es el mismo bug que `lib/net-amounts` ya había erradicado del lado de las
 * órdenes; del lado de los deals seguía vivo.
 */
const activo = (valor: number, extra: Record<string, unknown> = {}) => ({
  valor,
  resultado: "ABIERTO" as const,
  temperatura: "TIBIO" as const,
  ...extra,
});

describe("metricasPipeline — monedas mezcladas", () => {
  it("un deal en USD se convierte con su tipo de cambio", () => {
    const m = metricasPipeline([activo(50000, { moneda: "USD", tipo_cambio: 17 })]);
    expect(m.valor_pipeline).toBe(850000);
    expect(m.sin_tipo_cambio).toBe(0);
  });

  it("suma MXN y USD en la misma moneda, no uno a uno", () => {
    const m = metricasPipeline([
      activo(100000), // MXN por defecto
      activo(1000, { moneda: "USD", tipo_cambio: 17 }),
    ]);
    expect(m.valor_pipeline).toBe(117000); // 100.000 + 17.000
    expect(m.deals_activos).toBe(2);
  });

  it("un deal en USD SIN tipo de cambio queda fuera del total y se declara", () => {
    const m = metricasPipeline([
      activo(100000),
      activo(50000, { moneda: "USD" }),
    ]);
    expect(m.valor_pipeline).toBe(100000); // no inventa una paridad
    expect(m.sin_tipo_cambio).toBe(1); // …y lo dice
    expect(m.deals_activos).toBe(2); // sigue siendo un deal activo
  });

  it("el promedio NO le imputa cero pesos al no convertible", () => {
    // Con 100.000 MXN y un USD sin tipo de cambio, el promedio es 100.000 — no 50.000.
    const m = metricasPipeline([activo(100000), activo(50000, { moneda: "USD" })]);
    expect(m.promedio_deal).toBe(100000);
  });

  it("acepta el Decimal que devuelve Prisma, no solo números", () => {
    const m = metricasPipeline([
      activo(1000, { moneda: "USD", tipo_cambio: { toNumber: () => 17 } }),
    ]);
    expect(m.valor_pipeline).toBe(17000);
  });

  it("sin deals activos no divide por cero", () => {
    const m = metricasPipeline([{ valor: 5, resultado: "GANADO", temperatura: "TIBIO" }]);
    expect(m.deals_activos).toBe(0);
    expect(m.promedio_deal).toBe(0);
    expect(m.valor_pipeline).toBe(0);
  });

  it("los deals cerrados no entran en ninguna cifra", () => {
    const m = metricasPipeline([
      activo(100000),
      { valor: 999999, resultado: "GANADO", temperatura: "TIBIO" },
      { valor: 888888, resultado: "PERDIDO", temperatura: "TIBIO", moneda: "USD" },
    ]);
    expect(m.valor_pipeline).toBe(100000);
    expect(m.sin_tipo_cambio).toBe(0); // el USD sin TC estaba cerrado: no cuenta como omitido
  });
});
