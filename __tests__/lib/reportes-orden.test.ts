import {
  EXTRACTORES_CONVERSION, EXTRACTORES_VENTAS_VENDEDOR,
} from "@/lib/reportes-orden";
import { ordenarFilas } from "@/lib/tabla-orden";
import type { ConversionTipoItem, VentasVendedorItem } from "@/types/reportes";

const CONVERSION: ConversionTipoItem[] = [
  { tipo_id: "t1", tipo: "Proyecto Fijo", total: 10, ventas: 8, cotizadas: 2, tasa: 80 },
  { tipo_id: "t2", tipo: "Soporte", total: 3, ventas: 0, cotizadas: 3, tasa: 0 },
  { tipo_id: "t3", tipo: "SEC Plan", total: 100, ventas: 25, cotizadas: 75, tasa: 25 },
];

const VENDEDORES: VentasVendedorItem[] = [
  { vendedor_id: "v1", vendedor: "Ana Ruiz", ordenes_venta: 3, total_mxn: 150000 },
  { vendedor_id: null, vendedor: "Sin vendedor", ordenes_venta: 1, total_mxn: 8000 },
  { vendedor_id: "v2", vendedor: "Bruno Paz", ordenes_venta: 12, total_mxn: 90000 },
];

describe("Conversión por tipo", () => {
  const porTipo = (campo: "tipo" | "total" | "ventas" | "tasa", sentido: "asc" | "desc") =>
    ordenarFilas(CONVERSION, { campo, sentido }, EXTRACTORES_CONVERSION).map((c) => c.tipo);

  it("los conteos ordenan como números: 100 no va antes que 3", () => {
    expect(porTipo("total", "asc")).toEqual(["Soporte", "Proyecto Fijo", "SEC Plan"]);
    expect(porTipo("total", "desc")).toEqual(["SEC Plan", "Proyecto Fijo", "Soporte"]);
  });

  it("una tasa de 0% es un dato real, no un vacío: ordena primera en ascendente", () => {
    // Si `0` se tratara como vacío iría al final y el tipo que peor convierte quedaría
    // escondido, que es justo lo que uno va a buscar a este reporte.
    expect(porTipo("tasa", "asc")).toEqual(["Soporte", "SEC Plan", "Proyecto Fijo"]);
  });

  it("cero ventas también es un dato", () => {
    expect(porTipo("ventas", "asc")[0]).toBe("Soporte");
  });

  it("el nombre del tipo ordena alfabéticamente en español", () => {
    expect(porTipo("tipo", "asc")).toEqual(["Proyecto Fijo", "SEC Plan", "Soporte"]);
  });

  it("sin campo elegido devuelve la lista del server intacta", () => {
    const r = ordenarFilas(CONVERSION, { campo: null, sentido: "asc" }, EXTRACTORES_CONVERSION);
    expect(r.map((c) => c.tipo)).toEqual(["Proyecto Fijo", "Soporte", "SEC Plan"]);
  });
});

describe("Ventas por vendedor", () => {
  const porVendedor = (
    campo: "vendedor" | "ordenes_venta" | "total_mxn",
    sentido: "asc" | "desc"
  ) => ordenarFilas(VENDEDORES, { campo, sentido }, EXTRACTORES_VENTAS_VENDEDOR)
    .map((v) => v.vendedor);

  it("por monto y por cantidad de ventas dan órdenes DISTINTOS — por eso son dos columnas", () => {
    // Bruno cerró 12 órdenes pero factura menos que Ana, que cerró 3. Poder mirar las dos
    // cosas por separado es el punto de que el encabezado ordene.
    expect(porVendedor("total_mxn", "desc")).toEqual(["Ana Ruiz", "Bruno Paz", "Sin vendedor"]);
    expect(porVendedor("ordenes_venta", "desc")).toEqual(["Bruno Paz", "Ana Ruiz", "Sin vendedor"]);
  });

  it('"Sin vendedor" ordena por su etiqueta, no queda al final por ser null', () => {
    // El id es null, pero la columna muestra el texto "Sin vendedor" y por eso se ordena así:
    // el extractor toma lo que se ve, no la clave.
    expect(porVendedor("vendedor", "asc")).toEqual(["Ana Ruiz", "Bruno Paz", "Sin vendedor"]);
  });

  it("no muta la lista que recibe", () => {
    const copia = [...VENDEDORES];
    ordenarFilas(VENDEDORES, { campo: "total_mxn", sentido: "asc" }, EXTRACTORES_VENTAS_VENDEDOR);
    expect(VENDEDORES).toEqual(copia);
  });
});
