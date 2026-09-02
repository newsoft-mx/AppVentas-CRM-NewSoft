import { aCsv, filaDeOrden, filasDeOrdenes, nombreDeArchivo, COLUMNAS_ORDENES } from "@/lib/exportar-ordenes";
import type { OrdenResumen } from "@/types/ordenes";

const orden = (extra: Partial<OrdenResumen> = {}): OrdenResumen => ({
  id: "1",
  folio: "NS00042",
  descripcion: "Licencia anual",
  estatus: "VENTA",
  moneda: "MXN",
  tipo_cambio: null,
  fecha_venta: "2026-03-15T00:00:00.000Z",
  subtotal_con_descuento: 12500,
  total: 14500,
  total_mxn: 14500,
  created_at: "2026-01-02T00:00:00.000Z",
  cliente: { id: "c1", nombre: "TechCorp México" },
  tipo_cotizacion: { id: "t1", nombre: "Proyecto Fijo" },
  condicion_pago: { id: "p1", nombre: "30 días" },
  vendedor: { id: "v1", nombre: "Gabriela García" },
  ...extra,
});

describe("filaDeOrden", () => {
  it("saca una columna por encabezado, sin desalinearse", () => {
    expect(filaDeOrden(orden())).toHaveLength(COLUMNAS_ORDENES.length);
  });

  // La regla del repo: los montos de cara al usuario en vistas agregadas van NETOS sin IVA.
  // Si el archivo sumara con IVA, no cuadraría con el total que la pantalla muestra arriba.
  it("exporta el neto sin IVA, igual que la pantalla", () => {
    const fila = filaDeOrden(orden());

    expect(fila).toContain("12500");
    expect(fila).not.toContain("14500");
  });

  it("usa la fecha de venta cuando la hay", () => {
    expect(filaDeOrden(orden())[1]).toBe("2026-03-15");
  });

  it("y la de alta cuando la venta no tiene fecha", () => {
    expect(filaDeOrden(orden({ fecha_venta: null }))[1]).toBe("2026-01-02");
  });

  it("convierte los dólares con su tipo de cambio", () => {
    const fila = filaDeOrden(orden({ moneda: "USD", tipo_cambio: 17, subtotal_con_descuento: 1000 }));

    expect(fila).toContain("1000");   // neto en la moneda original
    expect(fila).toContain("17000");  // el equivalente en pesos
  });

  // Un cero se suma y miente; una celda vacía se ve. Es la misma regla que `lib/net-amounts`
  // aplica en pantalla: no inventar pesos que no se pueden calcular.
  it("una orden en USD sin tipo de cambio deja la celda de pesos VACÍA, no en cero", () => {
    const fila = filaDeOrden(orden({ moneda: "USD", tipo_cambio: null, subtotal_con_descuento: 1000 }));

    expect(fila[fila.length - 1]).toBe("");
  });

  it("un vendedor sin asignar no rompe la fila", () => {
    expect(filaDeOrden(orden({ vendedor: null }))).toHaveLength(COLUMNAS_ORDENES.length);
  });
});

describe("filasDeOrdenes", () => {
  it("la primera fila son los encabezados", () => {
    expect(filasDeOrdenes([orden()])[0]).toEqual([...COLUMNAS_ORDENES]);
  });

  it("sin órdenes queda solo el encabezado", () => {
    expect(filasDeOrdenes([])).toHaveLength(1);
  });
});

describe("aCsv", () => {
  // El caso que rompe planillas en silencio: una coma en el nombre del cliente corre todas las
  // columnas de esa fila y nadie lo nota hasta que un total no cuadra.
  it("cita todo, así una coma en el nombre no corre las columnas", () => {
    const csv = aCsv([["Cliente", "Total"], ["ACME, S.A. de C.V.", "100"]]);

    expect(csv).toBe('"Cliente","Total"\r\n"ACME, S.A. de C.V.","100"');
  });

  it("escapa las comillas duplicándolas, como manda el formato", () => {
    expect(aCsv([['Proyecto "Fénix"']])).toBe('"Proyecto ""Fénix"""');
  });

  it("un salto de línea adentro de una celda queda contenido por las comillas", () => {
    const csv = aCsv([["linea1\nlinea2"], ["ok"]]);

    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

describe("nombreDeArchivo", () => {
  it("lleva la fecha para que no se pisen en la carpeta", () => {
    expect(nombreDeArchivo("2026-08-31T18:05:00.000Z")).toBe("ventas-2026-08-31.csv");
  });
});
