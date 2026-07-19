import { calcularPlataforma, costoServicio, type CalculadoraInputs } from "@/lib/calculadora-plataformas";

// Motor puro de la Calculadora de Plataformas: verificamos las ramas del cálculo (upfront vs
// financiado, interés sobre saldo promedio, consumo fijo vs variable, margen y totales).

const base: CalculadoraInputs = {
  hrsDesarrollo: 100, tarifaHora: 1000, // valorDev = 100_000
  antiPct: 50, meses: 10, tasa: 0,
  hrsSoporte: 8, tarifaSoporte: 1000, // sop = 8_000
  costoVercel: 350, margenConsumo: 20, servicios: [],
};

describe("calcularPlataforma", () => {
  it("100% upfront: sin financiamiento ni amortización", () => {
    const r = calcularPlataforma({ ...base, antiPct: 100 });
    expect(r.valorDev).toBe(100_000);
    expect(r.anticipo).toBe(100_000);
    expect(r.financiado).toBe(0);
    expect(r.hayFin).toBe(false);
    expect(r.amort).toBe(0);
    expect(r.interes).toBe(0);
    // cuota fija = soporte + infra (sin dev financiado)
    expect(r.cuotaMensual).toBe(8_000 + 350);
  });

  it("con anticipo parcial: amortiza el financiado en el plazo", () => {
    const r = calcularPlataforma(base); // financiado 50_000 / 10 = 5_000
    expect(r.financiado).toBe(50_000);
    expect(r.amort).toBe(5_000);
    expect(r.interes).toBe(0); // tasa 0
    expect(r.cuotaMensual).toBe(5_000 + 8_000 + 350);
    // total contrato = anticipo + cuota × meses
    expect(r.totalContrato).toBe(50_000 + (5_000 + 8_000 + 350) * 10);
  });

  it("interés = tasa sobre el saldo promedio (financiado / 2)", () => {
    const r = calcularPlataforma({ ...base, tasa: 2 }); // (50_000/2) × 2% = 500
    expect(r.interes).toBe(500);
    expect(r.totalIntereses).toBe(500 * 10);
    expect(r.cuotaMensual).toBe(5_000 + 500 + 8_000 + 350);
  });

  it("consumo variable: volumen × precio, con margen; suma al total mensual", () => {
    const r = calcularPlataforma({
      ...base, antiPct: 100, margenConsumo: 20,
      servicios: [{ id: "ai", nombre: "IA", tipo: "variable", unidad: "k", volumen: 1000, precioUnit: 0.01, activo: true }],
    });
    // costo = 1000 × 0.01 = 10 ; cobro = 10 × 1.2 = 12
    expect(r.totalConsumoCosto).toBe(10);
    expect(r.totalConsumoCobro).toBeCloseTo(12);
    expect(r.margenConsumoMXN).toBeCloseTo(2);
    expect(r.totalMensualCliente).toBeCloseTo(r.cuotaMensual + 12);
  });

  it("consumo fijo: usa costoFijo (no volumen) y aplica margen", () => {
    const r = calcularPlataforma({
      ...base, antiPct: 100, margenConsumo: 10,
      servicios: [{ id: "wa", nombre: "Línea WA", tipo: "fijo", costoFijo: 874, activo: true }],
    });
    expect(r.totalConsumoCosto).toBe(874);
    expect(r.totalConsumoCobro).toBeCloseTo(874 * 1.1);
  });

  it("ignora servicios inactivos", () => {
    const r = calcularPlataforma({
      ...base, antiPct: 100,
      servicios: [{ id: "x", nombre: "SMS", tipo: "variable", volumen: 500, precioUnit: 1, activo: false }],
    });
    expect(r.consumoDetalle).toHaveLength(0);
    expect(r.totalConsumoCobro).toBe(0);
  });

  it("costoServicio distingue fijo de variable", () => {
    expect(costoServicio({ id: "a", nombre: "", tipo: "fijo", costoFijo: 500, activo: true })).toBe(500);
    expect(costoServicio({ id: "b", nombre: "", tipo: "variable", volumen: 3, precioUnit: 7, activo: true })).toBe(21);
  });
});
