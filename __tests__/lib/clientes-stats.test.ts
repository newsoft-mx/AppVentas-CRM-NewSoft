import { statsDeOrdenes } from "@/lib/clientes-stats";

const mxn = (monto: number) => ({ moneda: "MXN", subtotal_con_descuento: monto });
const usd = (monto: number, tc: number | null) => ({
  moneda: "USD",
  subtotal_con_descuento: monto,
  tipo_cambio: tc,
});

describe("statsDeOrdenes", () => {
  it("separa por moneda sin convertir, y convierte solo el gran total", () => {
    const s = statsDeOrdenes([mxn(150000), usd(2160, 17.15)]);
    expect(s.num_ordenes).toBe(2);
    expect(s.total_mxn).toBe(150000);
    expect(s.total_usd).toBe(2160); // en dólares, NO convertido
    expect(s.grand_total_mxn).toBeCloseTo(150000 + 2160 * 17.15, 2);
    expect(s.ordenes_sin_tipo_cambio).toBe(0);
  });

  it("una orden USD sin tipo de cambio queda fuera del gran total y se cuenta", () => {
    // Es el caso que hacía que la tarjeta del cliente dijera "≈ $0.00 MXN" debajo de
    // "USD 2,160.00": sin el contador, el 0 se lee como una equivalencia, no como una omisión.
    const s = statsDeOrdenes([usd(2160, null)]);
    expect(s.total_usd).toBe(2160);
    expect(s.grand_total_mxn).toBe(0);
    expect(s.ordenes_sin_tipo_cambio).toBe(1);
  });

  it("mezcla: el gran total es solo lo convertible, y avisa lo que falta", () => {
    const s = statsDeOrdenes([mxn(150000), usd(2160, null)]);
    expect(s.grand_total_mxn).toBe(150000);
    expect(s.grand_total_mxn).not.toBe(152160); // lo que daba antes, sumando USD como pesos
    expect(s.ordenes_sin_tipo_cambio).toBe(1);
  });

  it("un cliente sin órdenes da todo en cero", () => {
    expect(statsDeOrdenes([])).toEqual({
      num_ordenes: 0,
      total_mxn: 0,
      total_usd: 0,
      grand_total_mxn: 0,
      ordenes_sin_tipo_cambio: 0,
    });
  });
});
