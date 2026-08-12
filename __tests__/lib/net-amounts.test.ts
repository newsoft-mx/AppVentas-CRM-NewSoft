import {
  netAmount, netAmountMxn, sumaNetaMxn, ticketPromedioMxn, tieneTipoCambio,
} from "@/lib/net-amounts";

const mxn = (monto: number) => ({ moneda: "MXN", subtotal_con_descuento: monto });
const usd = (monto: number, tc: number | null) => ({
  moneda: "USD",
  subtotal_con_descuento: monto,
  tipo_cambio: tc,
});

describe("netAmount: el neto sin IVA, en la moneda original", () => {
  it("devuelve el subtotal con descuento tal cual", () => {
    expect(netAmount(mxn(1500))).toBe(1500);
    expect(netAmount(usd(100, 20))).toBe(100);
  });
});

describe("netAmountMxn: no inventa una paridad 1:1", () => {
  it("MXN pasa derecho", () => {
    expect(netAmountMxn(mxn(1500))).toBe(1500);
  });

  it("USD con tipo de cambio convierte", () => {
    expect(netAmountMxn(usd(100, 20))).toBe(2000);
  });

  it("USD SIN tipo de cambio devuelve null — es EL bug", () => {
    // Antes: `net * (toNumber(null) || 1)` → toNumber(null) = 0 → `|| 1` → 100 * 1 = 100.
    // Cien dólares se sumaban como cien pesos, en silencio, en todos los agregados.
    expect(netAmountMxn(usd(100, null))).toBeNull();
    expect(netAmountMxn(usd(100, 0))).toBeNull();
    expect(netAmountMxn({ moneda: "USD", subtotal_con_descuento: 100 })).toBeNull();
  });
});

describe("tieneTipoCambio", () => {
  it("solo una orden USD sin TC no es convertible", () => {
    expect(tieneTipoCambio(mxn(1500))).toBe(true);
    expect(tieneTipoCambio(usd(100, 20))).toBe(true);
    expect(tieneTipoCambio(usd(100, null))).toBe(false);
  });
});

describe("sumaNetaMxn: la única forma correcta de sumar monedas mezcladas", () => {
  it("suma lo convertible y CUENTA lo que quedó afuera", () => {
    const r = sumaNetaMxn([mxn(1000), usd(100, 20), usd(50, null)]);
    expect(r.mxn).toBe(3000); // 1000 + 2000
    expect(r.sin_tipo_cambio).toBe(1);
  });

  it("una lista vacía da cero, no NaN", () => {
    expect(sumaNetaMxn([])).toEqual({ mxn: 0, sin_tipo_cambio: 0 });
  });

  it("omitir es honesto: el faltante no se suma como si fuera pesos", () => {
    // El total de esta lista NO puede ser 1050 (que es lo que daba antes).
    const r = sumaNetaMxn([mxn(1000), usd(50, null)]);
    expect(r.mxn).toBe(1000);
    expect(r.mxn).not.toBe(1050);
  });

  it("todo sin tipo de cambio: total en cero y el conteo completo", () => {
    expect(sumaNetaMxn([usd(100, null), usd(200, null)])).toEqual({ mxn: 0, sin_tipo_cambio: 2 });
  });
});

describe("ticketPromedioMxn: el denominador son las convertibles, no todas", () => {
  it("no le imputa cero pesos a la orden que no se pudo convertir", () => {
    // Con denominador = ordenes.length daría 50.000: la orden omitida arrastraría el promedio
    // hacia abajo como si hubiera vendido $0. Omitir del numerador obliga a omitir del
    // denominador; si no, el promedio no es de nada.
    const r = ticketPromedioMxn([mxn(100000), usd(2160, null)]);
    expect(r.promedio).toBe(100000);
    expect(r.promedio).not.toBe(50000);
    expect(r.sin_tipo_cambio).toBe(1);
  });

  it("sin órdenes convertibles no divide por cero", () => {
    expect(ticketPromedioMxn([usd(100, null)])).toEqual({ promedio: 0, sin_tipo_cambio: 1 });
    expect(ticketPromedioMxn([])).toEqual({ promedio: 0, sin_tipo_cambio: 0 });
  });

  it("el caso normal sigue siendo el promedio de siempre", () => {
    expect(ticketPromedioMxn([mxn(100), mxn(200), usd(10, 20)]).promedio).toBe(500 / 3);
  });
});
