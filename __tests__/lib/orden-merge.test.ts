import { resolverCamposDeMonto } from "@/lib/orden-merge";
import { calcularOrden } from "@/lib/utils";

/** Orden guardada: 150.000 con 10% de descuento y 16% de IVA. */
const guardada = {
  descuento_porcentaje: { toNumber: () => 10 },
  tasa_iva: { toNumber: () => 16 },
  aplica_iva: true,
  moneda: "MXN",
  tipo_cambio: null,
};
const partidas = [{ cantidad: 1, precio_unitario: 150000 }];

describe("resolverCamposDeMonto — 'no vino' no es lo mismo que 'borrámelo'", () => {
  it("campo ausente: se conserva lo guardado", () => {
    const r = resolverCamposDeMonto({}, guardada);
    expect(r.descuento_porcentaje).toBe(10);
    expect(r.tasa_iva).toBe(16);
  });

  it("campo en null: se borra", () => {
    const r = resolverCamposDeMonto({ descuento_porcentaje: null }, guardada);
    expect(r.descuento_porcentaje).toBeNull();
  });

  it("campo con valor nuevo: gana el nuevo", () => {
    const r = resolverCamposDeMonto({ descuento_porcentaje: 20 }, guardada);
    expect(r.descuento_porcentaje).toBe(20);
  });

  it("un descuento de 0 no se confunde con 'no vino'", () => {
    // El caso que un `||` rompe y un `??` acierta: 0 es un valor, no una ausencia.
    const r = resolverCamposDeMonto({ descuento_porcentaje: 0 }, guardada);
    expect(r.descuento_porcentaje).toBe(0);
  });

  it("aplica_iva en false se respeta (no cae al true guardado)", () => {
    const r = resolverCamposDeMonto({ aplica_iva: false }, guardada);
    expect(r.aplica_iva).toBe(false);
  });
});

describe("el bug completo: borrar el descuento recalcula sin descuento", () => {
  it("los montos calculados coinciden con lo que se va a guardar", () => {
    const final = resolverCamposDeMonto({ descuento_porcentaje: null }, guardada);
    const calculo = calcularOrden({ partidas, ...final });

    // Lo que se guarda como descuento
    expect(final.descuento_porcentaje).toBeNull();
    // …y los montos, coherentes con eso
    expect(calculo.monto_descuento.toNumber()).toBe(0);
    expect(calculo.subtotal_con_descuento.toNumber()).toBe(150000);
    expect(calculo.total.toNumber()).toBe(174000);
  });

  it("INVARIANTE: descuento nulo ⇒ monto de descuento cero", () => {
    // Con el bug, esta orden quedaba con descuento_porcentaje = null y monto_descuento = 15.000
    // al mismo tiempo. La invariante lo vuelve imposible de escribir sin que se note.
    for (const entrada of [{}, { descuento_porcentaje: null }, { descuento_porcentaje: 0 }, { descuento_porcentaje: 25 }]) {
      const final = resolverCamposDeMonto(entrada, guardada);
      const calculo = calcularOrden({ partidas, ...final });
      if (final.descuento_porcentaje == null || final.descuento_porcentaje === 0) {
        expect(calculo.monto_descuento.toNumber()).toBe(0);
      } else {
        expect(calculo.monto_descuento.toNumber()).toBeGreaterThan(0);
      }
    }
  });

  it("sin tocar el descuento, la orden conserva sus montos", () => {
    const final = resolverCamposDeMonto({}, guardada);
    const calculo = calcularOrden({ partidas, ...final });
    expect(calculo.monto_descuento.toNumber()).toBe(15000);
    expect(calculo.subtotal_con_descuento.toNumber()).toBe(135000);
  });
});
