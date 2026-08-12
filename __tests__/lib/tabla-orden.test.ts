import {
  compararValores,
  ordenarFilas,
  ordenarPorTramos,
  parseOrden,
  serializeOrden,
  siguienteOrden,
  type ExtractoresOrden,
  type OrdenTabla,
} from "@/lib/tabla-orden";

type Campo = "nombre" | "monto" | "fecha" | "activo";

interface Fila {
  nombre: string;
  monto: number | null;
  fecha: Date | null;
  activo: boolean;
}

const EXTRACTORES: ExtractoresOrden<Fila, Campo> = {
  nombre: (f) => f.nombre,
  monto: (f) => f.monto,
  fecha: (f) => f.fecha,
  activo: (f) => f.activo,
};

const asc = (campo: Campo): OrdenTabla<Campo> => ({ campo, sentido: "asc" });
const desc = (campo: Campo): OrdenTabla<Campo> => ({ campo, sentido: "desc" });

function filas(...nombres: (readonly [string, number | null])[]): Fila[] {
  return nombres.map(([nombre, monto]) => ({ nombre, monto, fecha: null, activo: true }));
}

describe("compararValores", () => {
  it("números por valor, incluidos 0 y negativos", () => {
    expect(compararValores(1, 2)).toBeLessThan(0);
    expect(compararValores(0, -5)).toBeGreaterThan(0);
  });

  it("booleanos: false antes que true", () => {
    expect(compararValores(false, true)).toBeLessThan(0);
  });

  it("fechas por instante", () => {
    expect(compararValores(new Date("2026-01-01"), new Date("2026-06-01"))).toBeLessThan(0);
  });

  it("strings con numeric: 'OV-2' antes que 'OV-10'", () => {
    // Sin `numeric: true` el orden sería alfabético y "OV-10" quedaría antes.
    expect(compararValores("OV-2", "OV-10")).toBeLessThan(0);
  });

  it("acentos con locale español", () => {
    expect(compararValores("Ángel", "Beto")).toBeLessThan(0);
  });

  it("no adivina fechas desde strings: un folio se compara como texto", () => {
    // "2024-001" parece ISO pero es un folio. Tratarlo como fecha rompería el orden.
    expect(compararValores("2024-001", "2024-002")).toBeLessThan(0);
  });
});

describe("los vacíos van al final, en los DOS sentidos", () => {
  // Este es el test que hoy fallaría contra el comparador viejo: con `String(null)` = "null",
  // una fila sin dato aterrizaba entre las que empiezan con N.
  const conHuecos = filas(["a", 30], ["b", null], ["c", 10]);

  it("ascendente", () => {
    expect(ordenarFilas(conHuecos, asc("monto"), EXTRACTORES).map((f) => f.nombre)).toEqual(["c", "a", "b"]);
  });

  it("descendente: el vacío NO se va arriba al invertir", () => {
    expect(ordenarFilas(conHuecos, desc("monto"), EXTRACTORES).map((f) => f.nombre)).toEqual(["a", "c", "b"]);
  });

  it("0 y false NO son vacíos: son valores reales", () => {
    const r = ordenarFilas(filas(["cero", 0], ["nulo", null], ["diez", 10]), asc("monto"), EXTRACTORES);
    expect(r.map((f) => f.nombre)).toEqual(["cero", "diez", "nulo"]);
  });
});

describe("ordenarFilas", () => {
  it("no muta la entrada", () => {
    const original = filas(["b", 2], ["a", 1]);
    const copia = [...original];
    ordenarFilas(original, asc("nombre"), EXTRACTORES);
    expect(original).toEqual(copia);
  });

  it("sin orden devuelve la MISMA referencia (para no romper los useMemo)", () => {
    const original = filas(["b", 2], ["a", 1]);
    expect(ordenarFilas(original, { campo: null, sentido: "asc" }, EXTRACTORES)).toBe(original);
  });

  it("es estable: los empates conservan el orden del server", () => {
    const empatados = filas(["primero", 5], ["segundo", 5], ["tercero", 5]);
    expect(ordenarFilas(empatados, asc("monto"), EXTRACTORES).map((f) => f.nombre)).toEqual([
      "primero", "segundo", "tercero",
    ]);
  });
});

describe("ordenarPorTramos: el orden NUNCA cruza un límite estructural", () => {
  it("cada tramo se ordena por dentro y los tramos no se mezclan", () => {
    // Es el caso de Órdenes (grupos por cliente) y de Configuración (activos/inactivos con
    // una fila separadora en el medio).
    const tramos = [filas(["b", 2], ["a", 1]), filas(["z", 26], ["y", 25])];
    const r = ordenarPorTramos(tramos, asc("nombre"), EXTRACTORES);
    expect(r).toHaveLength(2);
    expect(r[0].map((f) => f.nombre)).toEqual(["a", "b"]);
    expect(r[1].map((f) => f.nombre)).toEqual(["y", "z"]);
  });

  it("la cantidad y el orden de los tramos no cambian", () => {
    const tramos = [filas(["z", 26]), filas(["a", 1]), []];
    const r = ordenarPorTramos(tramos, asc("nombre"), EXTRACTORES);
    expect(r.map((t) => t.length)).toEqual([1, 1, 0]);
    expect(r[0][0].nombre).toBe("z"); // el tramo de "z" sigue primero
  });
});

describe("siguienteOrden: ciclo de tres estados", () => {
  it("columna nueva → asc; asc → desc; desc → sin orden", () => {
    let o: OrdenTabla<Campo> = { campo: null, sentido: "asc" };
    o = siguienteOrden(o, "nombre");
    expect(o).toEqual({ campo: "nombre", sentido: "asc" });
    o = siguienteOrden(o, "nombre");
    expect(o).toEqual({ campo: "nombre", sentido: "desc" });
    o = siguienteOrden(o, "nombre");
    expect(o).toEqual({ campo: null, sentido: "asc" });
  });

  it("cambiar de columna reinicia en ascendente", () => {
    expect(siguienteOrden(desc("nombre"), "monto")).toEqual({ campo: "monto", sentido: "asc" });
  });
});

describe("serialize / parse", () => {
  const CAMPOS: Campo[] = ["nombre", "monto", "fecha", "activo"];

  it("roundtrip", () => {
    expect(parseOrden(serializeOrden(desc("monto")), CAMPOS)).toEqual(desc("monto"));
  });

  it("sin orden serializa a vacío", () => {
    expect(serializeOrden({ campo: null, sentido: "asc" })).toBe("");
  });

  it("descarta entradas inválidas sin lanzar", () => {
    for (const malo of ["", "inexistente:asc", "nombre:xx", "'; DROP TABLE", "::"]) {
      const r = parseOrden(malo, CAMPOS);
      if (malo === "nombre:xx") expect(r).toEqual({ campo: "nombre", sentido: "asc" }); // sentido inválido → asc
      else expect(r.campo).toBeNull();
    }
  });
});
