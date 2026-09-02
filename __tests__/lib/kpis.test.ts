import { calcularPipeline } from "@/lib/kpis";
import type { EstatusOrden } from "@/types/ordenes";

// Fila mínima: lo que necesita para sumar plata (NetAmountFields) más el estatus.
const fila = (
  estatus: EstatusOrden,
  subtotal_con_descuento: number,
  moneda: "MXN" | "USD" = "MXN",
  tipo_cambio?: number
) => ({ estatus, moneda, subtotal_con_descuento, tipo_cambio });

describe("calcularPipeline", () => {
  it("cuenta por estatus y suma solo el estatus que corresponde", () => {
    const r = calcularPipeline([
      fila("BORRADOR", 100),
      fila("BORRADOR", 200),
      fila("COTIZADO", 1000),
      fila("VENTA", 5000),
      fila("VENTA", 2500),
    ]);

    expect(r).toEqual({
      borradores_count: 2,
      cotizaciones_count: 1,
      ventas_count: 2,
      cotizaciones_mxn: 1000,
      ventas_mxn: 7500,
      total_ordenes: 5,
    });
  });

  // El motivo de tener esto en un solo lugar: los dólares se convierten, no se suman 1 a 1.
  // Cuando había dos copias de esta cuenta, arreglar una y no la otra no rompía nada visible.
  it("convierte los dólares con su tipo de cambio", () => {
    const r = calcularPipeline([fila("VENTA", 1000, "USD", 20), fila("VENTA", 500)]);

    expect(r.ventas_mxn).toBe(20500);
  });

  it("una orden en USD sin tipo de cambio no inventa pesos: no suma", () => {
    const r = calcularPipeline([fila("VENTA", 1000, "USD"), fila("VENTA", 300)]);

    expect(r.ventas_count).toBe(2);
    expect(r.ventas_mxn).toBe(300);
  });

  it("sin órdenes devuelve ceros, no NaN", () => {
    expect(calcularPipeline([])).toEqual({
      borradores_count: 0,
      cotizaciones_count: 0,
      ventas_count: 0,
      cotizaciones_mxn: 0,
      ventas_mxn: 0,
      total_ordenes: 0,
    });
  });
});
