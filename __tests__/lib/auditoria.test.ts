import { diffCampos, normalizarValor, CAMPOS_AUDITADOS } from "@/lib/auditoria";

// El corazón de la bitácora: qué se considera un cambio y qué se ignora.
// La regla de negocio es "solo lo importante": si el diff mete ruido, nadie lee la bitácora.

describe("normalizarValor", () => {
  it("vacíos → null (null, undefined y string vacío son lo mismo para el usuario)", () => {
    expect(normalizarValor(null)).toBeNull();
    expect(normalizarValor(undefined)).toBeNull();
    expect(normalizarValor("")).toBeNull();
  });

  it("fecha → YYYY-MM-DD (sin hora: la bitácora no compara milisegundos)", () => {
    expect(normalizarValor(new Date("2026-07-22T18:30:00Z"))).toBe("2026-07-22");
  });

  it("booleano → Sí/No y número → texto", () => {
    expect(normalizarValor(true)).toBe("Sí");
    expect(normalizarValor(false)).toBe("No");
    expect(normalizarValor(12500)).toBe("12500");
  });
});

describe("diffCampos", () => {
  it("detecta solo los campos que cambiaron", () => {
    const cambios = diffCampos(
      "orden_venta",
      { total: 10000, cliente: "ACME", estatus: "COTIZADO" },
      { total: 12500, cliente: "ACME", estatus: "COTIZADO" }
    );
    expect(cambios).toHaveLength(1);
    expect(cambios[0]).toMatchObject({ campo: "total", label: "Total", antes: "10000", despues: "12500" });
  });

  it("ignora campos que NO están en la lista blanca (nada de ruido)", () => {
    const cambios = diffCampos(
      "orden_venta",
      { total: 100, notas: "algo", updated_at: new Date("2026-01-01") },
      { total: 100, notas: "otra cosa", updated_at: new Date("2026-07-22") }
    );
    expect(cambios).toEqual([]); // notas/updated_at no se auditan
  });

  it("ignora los campos que el update no tocó (PATCH parcial)", () => {
    // "después" solo trae estatus → el total no se evalúa aunque difiera en "antes"
    const cambios = diffCampos("orden_venta", { total: 100, estatus: "BORRADOR" }, { estatus: "COTIZADO" });
    expect(cambios).toHaveLength(1);
    expect(cambios[0].campo).toBe("estatus");
  });

  it("registra el paso de vacío a con valor y viceversa", () => {
    expect(diffCampos("orden_venta", { fecha_venta: null }, { fecha_venta: new Date("2026-07-22") })[0])
      .toMatchObject({ antes: null, despues: "2026-07-22" });
    expect(diffCampos("orden_venta", { fecha_venta: new Date("2026-07-22") }, { fecha_venta: null })[0])
      .toMatchObject({ antes: "2026-07-22", despues: null });
  });

  it("compara valores legibles, no ids (el usuario lee nombres)", () => {
    const cambios = diffCampos("orden_venta", { cliente: "ACME" }, { cliente: "Globex" });
    expect(cambios[0]).toMatchObject({ label: "Cliente", antes: "ACME", despues: "Globex" });
  });

  it("sin cambios reales devuelve vacío (el caller no escribe entrada)", () => {
    expect(diffCampos("orden_venta", { total: 100, estatus: "VENTA" }, { total: 100, estatus: "VENTA" })).toEqual([]);
  });

  it("cubre las 4 entidades acordadas con el negocio", () => {
    expect(Object.keys(CAMPOS_AUDITADOS).sort())
      .toEqual(["cliente", "configuracion", "orden_venta", "usuario"]);
    // Los campos pedidos para la orden: total, cliente, estatus, tipo y fechas
    expect(Object.keys(CAMPOS_AUDITADOS.orden_venta))
      .toEqual(expect.arrayContaining(["total", "cliente", "estatus", "tipo", "fecha_venta"]));
  });
});
