import {
  EXTRACTORES_CONDICION, EXTRACTORES_TIPO, EXTRACTORES_USUARIO, EXTRACTORES_VENDEDOR,
  type CampoCondicion, type CampoVendedor,
} from "@/lib/configuracion-orden";
import { ordenarFilas, ordenarPorTramos } from "@/lib/tabla-orden";
import type {
  CondicionComercial, TipoCotizacion, Usuario, Vendedor,
} from "@/types/configuracion";

const AHORA = "2026-01-01T00:00:00.000Z";

const condicion = (p: Partial<CondicionComercial> & { nombre: string }): CondicionComercial => ({
  id: p.nombre, dias_credito: null, descripcion: null, activo: true, created_at: AHORA, ...p,
});
const tipo = (p: Partial<TipoCotizacion> & { nombre: string }): TipoCotizacion => ({
  id: p.nombre, descripcion: null, texto_contrato: null, color: "#000", activo: true,
  created_at: AHORA, ...p,
});
const usuario = (p: Partial<Usuario> & { nombre: string }): Usuario => ({
  id: p.nombre, email: `${p.nombre}@newsoft.mx`, activo: true, rol: "VENDEDOR",
  vendedor_id: null, created_at: AHORA, updated_at: AHORA, ...p,
});
const vendedor = (p: Partial<Vendedor> & { nombre: string }): Vendedor => ({
  id: p.nombre, email: null, telefono: null, activo: true, created_at: AHORA,
  updated_at: AHORA, ...p,
});

const nombresCond = (filas: CondicionComercial[], campo: CampoCondicion, sentido: "asc" | "desc") =>
  ordenarFilas(filas, { campo, sentido }, EXTRACTORES_CONDICION).map((c) => c.nombre);

describe("Condiciones comerciales", () => {
  it("ordena por días de crédito como número, no como texto", () => {
    // Como texto, "100" iría antes que "30". Es justo el error que el cimiento evita.
    const filas = [
      condicion({ nombre: "Cien", dias_credito: 100 }),
      condicion({ nombre: "Treinta", dias_credito: 30 }),
      condicion({ nombre: "Contado", dias_credito: 0 }),
    ];
    expect(nombresCond(filas, "dias_credito", "asc")).toEqual(["Contado", "Treinta", "Cien"]);
  });

  it("null y 0 ordenan JUNTOS, porque la celda muestra 'Contado' para los dos", () => {
    // La tabla colapsa los dos casos en la misma etiqueta (TabCondiciones, `diasLabel`). Si el
    // extractor los separara, ordenar por esta columna dejaría filas que se leen idénticas
    // arriba de todo y abajo de todo, con los 30/60 en el medio: se ve como orden roto.
    const filas = [
      condicion({ nombre: "Sesenta", dias_credito: 60 }),
      condicion({ nombre: "Sin plazo", dias_credito: null }),
      condicion({ nombre: "Treinta", dias_credito: 30 }),
      condicion({ nombre: "Contado", dias_credito: 0 }),
    ];
    // Los dos "Contado" (null y 0) quedan pegados en las dos primeras posiciones.
    expect(nombresCond(filas, "dias_credito", "asc").slice(0, 2).sort())
      .toEqual(["Contado", "Sin plazo"]);
    expect(nombresCond(filas, "dias_credito", "asc").slice(2)).toEqual(["Treinta", "Sesenta"]);
    // Y en descendente quedan pegados al final, no uno arriba y otro abajo.
    expect(nombresCond(filas, "dias_credito", "desc").slice(0, 2)).toEqual(["Sesenta", "Treinta"]);
    expect(nombresCond(filas, "dias_credito", "desc").slice(2).sort())
      .toEqual(["Contado", "Sin plazo"]);
  });

  it("las condiciones sin descripción quedan al final, no primeras", () => {
    const filas = [
      condicion({ nombre: "A", descripcion: null }),
      condicion({ nombre: "B", descripcion: "Pago diferido" }),
    ];
    expect(nombresCond(filas, "descripcion", "asc")).toEqual(["B", "A"]);
    expect(nombresCond(filas, "descripcion", "desc")).toEqual(["B", "A"]);
  });
});

describe("La partición activos/inactivos no se puede cruzar", () => {
  it("un inactivo nunca se trepa arriba de un activo, ordene por lo que ordene", () => {
    // Es LA invariante de estas cuatro tablas: la partición es el orden por estado, y el
    // encabezado solo reordena dentro de cada tramo.
    const activos = [tipo({ nombre: "Zafiro" }), tipo({ nombre: "Ámbar" })];
    const inactivos = [tipo({ nombre: "Alfa", activo: false }), tipo({ nombre: "Beta", activo: false })];

    for (const sentido of ["asc", "desc"] as const) {
      const [act, inact] = ordenarPorTramos([activos, inactivos], { campo: "nombre", sentido }, EXTRACTORES_TIPO);
      expect(act.every((t) => t.activo)).toBe(true);
      expect(inact.every((t) => !t.activo)).toBe(true);
      expect(act).toHaveLength(2);
      expect(inact).toHaveLength(2);
    }
  });

  it("dentro de cada tramo sí ordena", () => {
    const activos = [tipo({ nombre: "Zafiro" }), tipo({ nombre: "Ámbar" })];
    const inactivos = [tipo({ nombre: "Beta", activo: false }), tipo({ nombre: "Alfa", activo: false })];
    const tramos = ordenarPorTramos([activos, inactivos], { campo: "nombre", sentido: "asc" }, EXTRACTORES_TIPO);
    expect(tramos.flat().map((t) => t.nombre)).toEqual(["Ámbar", "Zafiro", "Alfa", "Beta"]);
  });
});

describe("Usuarios", () => {
  it("ordena por el nombre, que es lo que encabeza la celda", () => {
    const filas = [usuario({ nombre: "Zoe" }), usuario({ nombre: "Ana" })];
    expect(ordenarFilas(filas, { campo: "usuario", sentido: "asc" }, EXTRACTORES_USUARIO)
      .map((u) => u.nombre)).toEqual(["Ana", "Zoe"]);
  });
});

describe("Vendedores", () => {
  const porContacto = (filas: Vendedor[], campo: CampoVendedor, sentido: "asc" | "desc") =>
    ordenarFilas(filas, { campo, sentido }, EXTRACTORES_VENDEDOR).map((v) => v.nombre);

  it("la columna Contacto cae al teléfono cuando no hay correo", () => {
    const filas = [
      vendedor({ nombre: "Solo tel", telefono: "5511" }),
      vendedor({ nombre: "Con mail", email: "ana@newsoft.mx" }),
    ];
    // "5511" empieza con dígito y va antes que "ana@..." con numeric:true.
    expect(porContacto(filas, "contacto", "asc")).toEqual(["Solo tel", "Con mail"]);
  });

  it("sin correo ni teléfono va al final en los dos sentidos", () => {
    const filas = [
      vendedor({ nombre: "Sin nada" }),
      vendedor({ nombre: "Con mail", email: "ana@newsoft.mx" }),
      vendedor({ nombre: "Otro mail", email: "zoe@newsoft.mx" }),
    ];
    expect(porContacto(filas, "contacto", "asc").at(-1)).toBe("Sin nada");
    expect(porContacto(filas, "contacto", "desc").at(-1)).toBe("Sin nada");
  });
});
