import { repartirDetalles, mensajeDeError } from "@/lib/errores-formulario";

// El formulario de órdenes: campos propios + una celda por partida.
const CAMPOS = new Set(["cliente_id", "tipo_cambio", "partidas"]);
const ubicar = (campo: string): string | null => {
  const partida = /^partidas\.(\d+)\.(descripcion|precio_unitario)$/.exec(campo);
  if (partida) {
    return `${partida[2] === "descripcion" ? "p_desc" : "p_precio"}_${partida[1]}`;
  }
  return CAMPOS.has(campo) ? campo : null;
};

describe("repartirDetalles", () => {
  it("manda cada campo conocido a su propia clave", () => {
    const r = repartirDetalles(
      [
        { campo: "cliente_id", mensaje: "Cliente requerido" },
        { campo: "tipo_cambio", mensaje: "Requerido para USD" },
      ],
      ubicar
    );
    expect(r).toEqual({
      cliente_id: "Cliente requerido",
      tipo_cambio: "Requerido para USD",
    });
  });

  // El fallo que motivó todo esto: el mensaje existía, pero quedaba en una clave que ningún
  // `<p>` renderiza. El usuario apretaba Guardar y la pantalla no se movía.
  it("manda al banner general lo que no tiene dónde mostrarse", () => {
    const r = repartirDetalles([{ campo: "telefono", mensaje: "Máximo 20 caracteres" }], ubicar);
    expect(r).toEqual({ general: "telefono: Máximo 20 caracteres" });
  });

  it("ubica el error de una partida en la celda de esa fila", () => {
    const r = repartirDetalles(
      [
        { campo: "partidas.0.descripcion", mensaje: "La descripción es requerida" },
        { campo: "partidas.2.precio_unitario", mensaje: "No puede ser negativo" },
      ],
      ubicar
    );
    expect(r).toEqual({
      p_desc_0: "La descripción es requerida",
      p_precio_2: "No puede ser negativo",
    });
  });

  it("una partida con un campo sin celda propia igual se ve, en el banner", () => {
    const r = repartirDetalles([{ campo: "partidas.1.orden_display", mensaje: "Orden inválido" }], ubicar);
    expect(r).toEqual({ general: "partidas.1.orden_display: Orden inválido" });
  });

  it("un refine global (path vacío) va al banner sin prefijo", () => {
    const r = repartirDetalles([{ campo: "", mensaje: "La orden no cierra" }], ubicar);
    expect(r).toEqual({ general: "La orden no cierra" });
  });

  it("acumula varias quejas del mismo campo en vez de pisarlas", () => {
    const r = repartirDetalles(
      [
        { campo: "rfc", mensaje: "Formato inválido" },
        { campo: "rfc", mensaje: "Ya existe otro cliente con ese RFC" },
      ],
      ubicar
    );
    expect(r).toEqual({ general: "rfc: Formato inválido. rfc: Ya existe otro cliente con ese RFC" });
  });

  it("devuelve null cuando no hay nada utilizable, para caer al error genérico", () => {
    expect(repartirDetalles(undefined, ubicar)).toBeNull();
    expect(repartirDetalles([], ubicar)).toBeNull();
    expect(repartirDetalles("Datos inválidos", ubicar)).toBeNull();
    expect(repartirDetalles([{ campo: "cliente_id" }, null, 7], ubicar)).toBeNull();
    expect(repartirDetalles([{ campo: "cliente_id", mensaje: "   " }], ubicar)).toBeNull();
  });
});

describe("mensajeDeError", () => {
  it("prefiere el detalle específico antes que el genérico del server", () => {
    const data = {
      error: "Datos inválidos",
      details: [{ campo: "fecha_venta", mensaje: "Formato de fecha inválido" }],
    };
    expect(mensajeDeError(data, "No se pudo guardar.")).toBe("Formato de fecha inválido");
  });

  it("junta varios detalles en una sola línea", () => {
    const data = {
      details: [{ mensaje: "Nombre requerido" }, { mensaje: "Días debe ser un número" }],
    };
    expect(mensajeDeError(data, "x")).toBe("Nombre requerido. Días debe ser un número");
  });

  it("cae al error de la respuesta cuando no hay detalles", () => {
    expect(mensajeDeError({ error: "Sin permisos" }, "x")).toBe("Sin permisos");
    expect(mensajeDeError({ error: "Sin permisos", details: [] }, "x")).toBe("Sin permisos");
  });

  it("cae al mensaje por defecto ante una respuesta vacía o rara", () => {
    expect(mensajeDeError({}, "No se pudo guardar.")).toBe("No se pudo guardar.");
    expect(mensajeDeError(null, "No se pudo guardar.")).toBe("No se pudo guardar.");
    expect(mensajeDeError({ error: "  " }, "No se pudo guardar.")).toBe("No se pudo guardar.");
    expect(mensajeDeError("boom", "No se pudo guardar.")).toBe("No se pudo guardar.");
  });
});
