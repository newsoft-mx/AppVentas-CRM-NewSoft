import { calcularOrden } from "@/lib/utils";

/**
 * El motor de montos de las órdenes no tenía una sola prueba, y es el que decide cada peso
 * que la empresa cotiza y factura. Estos tests fijan su comportamiento, y en particular el
 * caso que produjo una orden inconsistente en producción: BORRAR el descuento.
 *
 * `null` y `undefined` significan cosas distintas en la ruta que llama a este motor:
 * `undefined` es "no me lo mandaron" (conservar) y `null` es "borrámelo". Acá se fija que
 * el motor trate `null` como "sin descuento", que es la mitad de la regla; la otra mitad
 * —que la ruta no confunda los dos— vive en __tests__/api/orden-descuento.test.ts.
 */
const partidas = [{ cantidad: 1, precio_unitario: 150000 }];

describe("calcularOrden", () => {
  it("sin descuento y sin IVA, el total es el subtotal", () => {
    const r = calcularOrden({ partidas, aplica_iva: false, moneda: "MXN" });
    expect(r.subtotal.toNumber()).toBe(150000);
    expect(r.monto_descuento.toNumber()).toBe(0);
    expect(r.subtotal_con_descuento.toNumber()).toBe(150000);
    expect(r.monto_iva.toNumber()).toBe(0);
    expect(r.total.toNumber()).toBe(150000);
  });

  it("aplica el descuento antes del IVA", () => {
    const r = calcularOrden({ partidas, descuento_porcentaje: 10, aplica_iva: true, tasa_iva: 16, moneda: "MXN" });
    expect(r.monto_descuento.toNumber()).toBe(15000);
    expect(r.subtotal_con_descuento.toNumber()).toBe(135000);
    expect(r.monto_iva.toNumber()).toBe(21600); // 16% de 135.000, no de 150.000
    expect(r.total.toNumber()).toBe(156600);
  });

  it("descuento null = SIN descuento (el caso de 'borrámelo')", () => {
    const r = calcularOrden({ partidas, descuento_porcentaje: null, aplica_iva: true, tasa_iva: 16, moneda: "MXN" });
    expect(r.monto_descuento.toNumber()).toBe(0);
    expect(r.subtotal_con_descuento.toNumber()).toBe(150000);
    expect(r.total.toNumber()).toBe(174000);
  });

  it("descuento 0 y descuento null dan exactamente lo mismo", () => {
    const cero = calcularOrden({ partidas, descuento_porcentaje: 0, aplica_iva: false, moneda: "MXN" });
    const nulo = calcularOrden({ partidas, descuento_porcentaje: null, aplica_iva: false, moneda: "MXN" });
    expect(cero.total.toNumber()).toBe(nulo.total.toNumber());
  });

  it("el total persistido cuadra con la suma de las filas que se muestran", () => {
    // Invariante contable: no puede haber un peso de diferencia entre lo que se ve
    // sumando las líneas y el total guardado. Con redondeo a 2 decimales en cada paso,
    // esto se rompe si se redondea en el orden equivocado.
    const r = calcularOrden({
      partidas: [
        { cantidad: 3, precio_unitario: 333.33 },
        { cantidad: 7, precio_unitario: 11.11 },
      ],
      descuento_porcentaje: 7.5,
      aplica_iva: true,
      tasa_iva: 16,
      moneda: "MXN",
    });
    expect(r.subtotal_con_descuento.plus(r.monto_iva).toNumber()).toBe(r.total.toNumber());
    expect(r.subtotal.minus(r.monto_descuento).toNumber()).toBe(r.subtotal_con_descuento.toNumber());
  });

  it("una orden en USD con tipo de cambio se expresa en pesos", () => {
    const r = calcularOrden({ partidas: [{ cantidad: 1, precio_unitario: 1000 }], aplica_iva: false, moneda: "USD", tipo_cambio: 17 });
    expect(r.total.toNumber()).toBe(1000);
    expect(r.total_mxn?.toNumber()).toBe(17000);
  });

  it("USD sin tipo de cambio: total_mxn queda igual al total, o sea 1 a 1", () => {
    // Esto NO es lo deseable y el test lo fija tal como es hoy, a propósito, para que el día
    // que se cambie se vea en el diff. `lib/net-amounts.netAmountMxn` devuelve null en este
    // caso —"omitir es honesto, inventar 1:1 no"— y `calcularOrden` hace lo contrario.
    //
    // Hoy no se manifiesta porque las tres puertas de escritura (POST, PUT e import) exigen
    // tipo de cambio cuando la moneda es USD, así que el valor 1:1 no llega a persistirse.
    // Pero las dos funciones responden distinto a la misma pregunta, y hay un consumidor que
    // lee la columna cruda en vez de pasar por net-amounts:
    // app/(dashboard)/pipeline/[id]/page.tsx:104 ("Total facturado" de la ficha del deal).
    const r = calcularOrden({ partidas: [{ cantidad: 1, precio_unitario: 1000 }], aplica_iva: false, moneda: "USD" });
    expect(r.total_mxn?.toNumber()).toBe(1000);
  });

  it("sin partidas todo es cero, no NaN", () => {
    const r = calcularOrden({ partidas: [], aplica_iva: true, tasa_iva: 16, moneda: "MXN" });
    expect(r.subtotal.toNumber()).toBe(0);
    expect(r.total.toNumber()).toBe(0);
  });
});
