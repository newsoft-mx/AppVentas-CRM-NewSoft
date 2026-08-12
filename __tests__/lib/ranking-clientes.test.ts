import { agruparPorCliente, rankingClientes, type OrdenAgrupable } from "@/lib/ranking-clientes";

const orden = (p: {
  cliente: string;
  estatus?: string;
  monto?: number;
  moneda?: string;
  tc?: number | null;
}): OrdenAgrupable => ({
  estatus: p.estatus ?? "VENTA",
  moneda: p.moneda ?? "MXN",
  tipo_cambio: p.tc ?? null,
  subtotal_con_descuento: p.monto ?? 0,
  cliente: { id: p.cliente, nombre: p.cliente },
});

describe("facturado significa VENTA, y solo VENTA", () => {
  it("borradores y cotizaciones cuentan como órdenes pero no como plata", () => {
    const grupos = agruparPorCliente(
      [
        orden({ cliente: "ACME", monto: 100000 }),
        orden({ cliente: "ACME", monto: 50000, estatus: "COTIZADO" }),
        orden({ cliente: "ACME", monto: 9000, estatus: "BORRADOR" }),
      ],
      { incluirSinVenta: true }
    );
    expect(grupos[0].facturado_mxn).toBe(100000);
    expect(grupos[0].ordenes_venta).toBe(1);
    expect(grupos[0].ordenes_totales).toBe(3);
    // El header muestra las dos cosas justamente por esto: el monto baja respecto de "sumar
    // todo", pero el conteo explica por qué.
  });

  it("un cliente con solo cotizaciones factura cero", () => {
    const grupos = agruparPorCliente([orden({ cliente: "ACME", monto: 50000, estatus: "COTIZADO" })], {
      incluirSinVenta: true,
    });
    expect(grupos[0].facturado_mxn).toBe(0);
    expect(grupos[0].ordenes_venta).toBe(0);
  });
});

describe("incluirSinVenta: la misma función, dos pantallas", () => {
  const ORDENES = [
    orden({ cliente: "Vende", monto: 100000 }),
    orden({ cliente: "Solo cotiza", monto: 80000, estatus: "COTIZADO" }),
  ];

  it("Órdenes lo incluye: esconderlo haría desaparecer filas que se están viendo", () => {
    const grupos = agruparPorCliente(ORDENES, { incluirSinVenta: true });
    expect(grupos.map((g) => g.nombre)).toEqual(["Vende", "Solo cotiza"]);
  });

  it("Reportes lo excluye: un cliente en $0 arriba del ranking no dice nada", () => {
    const grupos = agruparPorCliente(ORDENES, { incluirSinVenta: false });
    expect(grupos.map((g) => g.nombre)).toEqual(["Vende"]);
  });
});

describe("el orden del ranking", () => {
  it("ordena por monto facturado, descendente", () => {
    const grupos = agruparPorCliente(
      [
        orden({ cliente: "Chico", monto: 1000 }),
        orden({ cliente: "Grande", monto: 900000 }),
        orden({ cliente: "Medio", monto: 50000 }),
      ],
      { incluirSinVenta: true }
    );
    expect(grupos.map((g) => g.nombre)).toEqual(["Grande", "Medio", "Chico"]);
    expect(grupos.map((g) => g.posicion)).toEqual([1, 2, 3]);
  });

  it("empate: desempata por nombre, no por el orden en que llegaron", () => {
    // Sin este desempate el orden lo decidía la inserción en el Map, o sea el orden en que el
    // server devolvió las órdenes: el ranking "saltaba" entre renders sin cambiar ningún dato.
    const conUnOrden = agruparPorCliente(
      [orden({ cliente: "Zeta", monto: 5000 }), orden({ cliente: "Alfa", monto: 5000 })],
      { incluirSinVenta: true }
    );
    const conElOtro = agruparPorCliente(
      [orden({ cliente: "Alfa", monto: 5000 }), orden({ cliente: "Zeta", monto: 5000 })],
      { incluirSinVenta: true }
    );
    expect(conUnOrden.map((g) => g.nombre)).toEqual(["Alfa", "Zeta"]);
    expect(conElOtro.map((g) => g.nombre)).toEqual(["Alfa", "Zeta"]);
  });

  it("la posición es la de la lista que se ve, no la del universo", () => {
    // Con incluirSinVenta:false, el que no facturó desaparece — y el siguiente pasa a ser #1,
    // no #2. Si el ranking dice "#1" tiene que ser la primera fila de la pantalla.
    const grupos = agruparPorCliente(
      [
        orden({ cliente: "Solo cotiza", monto: 999999, estatus: "COTIZADO" }),
        orden({ cliente: "Vende", monto: 100 }),
      ],
      { incluirSinVenta: false }
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({ nombre: "Vende", posicion: 1 });
  });
});

describe("USD sin tipo de cambio", () => {
  it("queda fuera del monto y se cuenta, en vez de sumarse 1:1", () => {
    const grupos = agruparPorCliente(
      [
        orden({ cliente: "ACME", monto: 100000 }),
        orden({ cliente: "ACME", monto: 2160, moneda: "USD", tc: null }),
      ],
      { incluirSinVenta: true }
    );
    expect(grupos[0].facturado_mxn).toBe(100000);
    expect(grupos[0].facturado_mxn).not.toBe(102160); // lo que daba el bug de #115
    expect(grupos[0].sin_tipo_cambio).toBe(1);
    expect(grupos[0].ordenes_venta).toBe(2); // la orden existe, solo que no se pudo convertir
  });

  it("con tipo de cambio, convierte", () => {
    const grupos = agruparPorCliente(
      [orden({ cliente: "ACME", monto: 2160, moneda: "USD", tc: 17.15 })],
      { incluirSinVenta: true }
    );
    expect(grupos[0].facturado_mxn).toBeCloseTo(37044, 2);
    expect(grupos[0].sin_tipo_cambio).toBe(0);
  });
});

describe("rankingClientes: el mismo cálculo, con dos decisiones fijas", () => {
  const MUCHOS = Array.from({ length: 15 }, (_, i) =>
    orden({ cliente: `C${String(i).padStart(2, "0")}`, monto: (i + 1) * 1000 })
  );

  it("corta en 10 por defecto y respeta el límite que se le pase", () => {
    expect(rankingClientes(MUCHOS)).toHaveLength(10);
    expect(rankingClientes(MUCHOS, 3)).toHaveLength(3);
  });

  it("es agruparPorCliente con incluirSinVenta:false — no un cálculo aparte", () => {
    // CRITERIO DE ACEPTACIÓN DEL REQUERIMIENTO: sin filtros, el ranking de /ventas y el
    // "Top clientes" de /reportes tienen que dar el MISMO número. Antes no coincidían porque
    // eran dos implementaciones. Este test ata las dos superficies a la misma función.
    const ordenes = [
      orden({ cliente: "ACME", monto: 100000 }),
      orden({ cliente: "ACME", monto: 40000, estatus: "COTIZADO" }),
      orden({ cliente: "Beta", monto: 250000 }),
    ];
    const enVentas = agruparPorCliente(ordenes, { incluirSinVenta: false });
    const enReportes = rankingClientes(ordenes);
    expect(enReportes.map((g) => [g.nombre, g.facturado_mxn]))
      .toEqual(enVentas.map((g) => [g.nombre, g.facturado_mxn]));
  });

  it("no muta la lista que recibe", () => {
    const copia = [...MUCHOS];
    rankingClientes(MUCHOS);
    expect(MUCHOS).toEqual(copia);
  });

  it("lista vacía: no explota", () => {
    expect(rankingClientes([])).toEqual([]);
    expect(agruparPorCliente([], { incluirSinVenta: true })).toEqual([]);
  });
});
