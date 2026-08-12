import { CAMPOS_ORDEN, EXTRACTORES_ORDEN, type CampoOrden } from "@/lib/ventas-orden";
import { ordenarFilas } from "@/lib/tabla-orden";
import type { OrdenResumen } from "@/types/ordenes";

/**
 * PINNING de la tabla de Órdenes.
 *
 * Es la única tabla que ya ordenaba, y hasta ahora no tenía NI UN test: sus funciones eran
 * module-scope sin exportar dentro del `.tsx`. Estos casos fijan el comportamiento que la
 * pantalla tiene HOY, para que migrarla al cimiento compartido no la regresione.
 */

function orden(p: Partial<OrdenResumen> & { folio: string }): OrdenResumen {
  return {
    id: p.folio,
    folio: p.folio,
    descripcion: p.descripcion ?? "Sin descripción",
    estatus: p.estatus ?? "BORRADOR",
    moneda: p.moneda ?? "MXN",
    tipo_cambio: p.tipo_cambio ?? null,
    fecha_venta: p.fecha_venta ?? null,
    subtotal_con_descuento: p.subtotal_con_descuento ?? 0,
    total: p.total ?? 0,
    total_mxn: p.total_mxn ?? 0,
    created_at: p.created_at ?? "2026-01-01T00:00:00.000Z",
    cliente: p.cliente ?? { id: "c1", nombre: "Cliente" },
    tipo_cotizacion: p.tipo_cotizacion ?? { id: "t1", nombre: "Tipo" },
    condicion_pago: p.condicion_pago ?? { id: "p1", nombre: "Contado" },
    vendedor: p.vendedor ?? null,
  };
}

const FIXTURE: OrdenResumen[] = [
  orden({
    folio: "NS00010", descripcion: "Portal B2B", estatus: "VENTA",
    subtotal_con_descuento: 5000, fecha_venta: "2026-03-15",
    tipo_cotizacion: { id: "t2", nombre: "Zafiro" }, condicion_pago: { id: "p2", nombre: "30 días" },
  }),
  orden({
    folio: "NS00002", descripcion: "App móvil", estatus: "COTIZADO",
    subtotal_con_descuento: 12000, created_at: "2026-01-20T10:00:00.000Z",
    tipo_cotizacion: { id: "t1", nombre: "Ámbar" }, condicion_pago: { id: "p1", nombre: "Contado" },
  }),
  orden({
    folio: "NS00007", descripcion: "ERP", estatus: "BORRADOR",
    subtotal_con_descuento: 800, created_at: "2026-02-01T10:00:00.000Z",
    tipo_cotizacion: { id: "t3", nombre: "Rubí" }, condicion_pago: { id: "p3", nombre: "60 días" },
  }),
];

const porFolio = (campo: CampoOrden, sentido: "asc" | "desc") =>
  ordenarFilas(FIXTURE, { campo, sentido }, EXTRACTORES_ORDEN).map((o) => o.folio);

describe("pinning: las 7 columnas de Órdenes ordenan como hoy", () => {
  it("folio — numérico dentro del texto: NS00002 antes que NS00010", () => {
    expect(porFolio("folio", "asc")).toEqual(["NS00002", "NS00007", "NS00010"]);
    expect(porFolio("folio", "desc")).toEqual(["NS00010", "NS00007", "NS00002"]);
  });

  it("descripción — alfabético con acentos en español", () => {
    expect(porFolio("descripcion", "asc")).toEqual(["NS00002", "NS00007", "NS00010"]);
  });

  it("tipo — por el NOMBRE del tipo, no por su id", () => {
    // Ámbar < Rubí < Zafiro con locale es.
    expect(porFolio("tipo", "asc")).toEqual(["NS00002", "NS00007", "NS00010"]);
  });

  it("condición — '30 días' < '60 días' < 'Contado': los números van antes que las letras", () => {
    // Consecuencia de `numeric: true`, y es lo que la pantalla hace hoy.
    expect(porFolio("condicion", "asc")).toEqual(["NS00010", "NS00007", "NS00002"]);
  });

  it("total — numérico sobre el neto en MXN, no sobre el texto", () => {
    expect(porFolio("total", "asc")).toEqual(["NS00007", "NS00010", "NS00002"]);
    expect(porFolio("total", "desc")).toEqual(["NS00002", "NS00010", "NS00007"]);
  });

  it("estatus — alfabético del enum", () => {
    expect(porFolio("estatus", "asc")).toEqual(["NS00007", "NS00002", "NS00010"]);
  });

  it("fecha — cronológico, cayendo a created_at cuando no hay fecha de venta", () => {
    expect(porFolio("fecha", "asc")).toEqual(["NS00002", "NS00007", "NS00010"]);
  });

  it("todas las columnas declaradas tienen extractor (lo garantiza tsc, se fija acá)", () => {
    for (const campo of CAMPOS_ORDEN) {
      expect(typeof EXTRACTORES_ORDEN[campo]).toBe("function");
    }
  });
});

/**
 * La columna Total, con monedas mezcladas.
 *
 * El FIXTURE de arriba es todo MXN, y para una orden en MXN `netAmountMxn` y `netAmount` dan lo
 * mismo: esos casos NO pueden distinguir el extractor correcto de uno que compare montos
 * nominales de monedas distintas. Estos sí.
 */
describe("EXTRACTORES_ORDEN.total con USD", () => {
  const MEZCLA: OrdenResumen[] = [
    orden({ folio: "MXN-5K", subtotal_con_descuento: 5000 }),
    orden({ folio: "USD-500", moneda: "USD", tipo_cambio: 20, subtotal_con_descuento: 500 }),
    orden({ folio: "USD-SIN-TC", moneda: "USD", tipo_cambio: null, subtotal_con_descuento: 900 }),
  ];
  const porFolioMezcla = (sentido: "asc" | "desc") =>
    ordenarFilas(MEZCLA, { campo: "total", sentido }, EXTRACTORES_ORDEN).map((o) => o.folio);

  it("compara el valor convertido, no el número que trae la orden", () => {
    // USD 500 × 20 = 10.000 MXN, o sea MÁS que los 5.000 pesos, aunque 500 < 5000.
    expect(porFolioMezcla("asc").slice(0, 2)).toEqual(["MXN-5K", "USD-500"]);
    expect(porFolioMezcla("desc").slice(0, 2)).toEqual(["USD-500", "MXN-5K"]);
  });

  it("la que no se puede convertir queda última en los DOS sentidos", () => {
    // No es "la más chica": es que no hay monto con el cual compararla.
    expect(porFolioMezcla("asc")[2]).toBe("USD-SIN-TC");
    expect(porFolioMezcla("desc")[2]).toBe("USD-SIN-TC");
  });
});
