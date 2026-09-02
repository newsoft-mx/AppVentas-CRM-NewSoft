import {
  buildDateOrFilters,
  matchPeriod,
  wherePeriodoOrden,
  CURRENT_YEAR,
} from "@/lib/filter-utils";

describe("filter-utils date filters", () => {
  it("uses UTC boundaries so Jan 1 UTC does not match the previous year", () => {
    expect(matchPeriod("2026-01-01T00:00:00.000Z", { ano: [2025], q: [], mes: [] })).toBe(false);
    expect(matchPeriod("2026-01-01T00:00:00.000Z", { ano: [2026], q: [], mes: [] })).toBe(true);
  });

  it("builds year ranges at UTC midnight", () => {
    const [range] = buildDateOrFilters({ ano: [2025], q: [], mes: [] });

    expect(range.gte.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

// La forma exacta del `OR` que cada pantalla venía armando a mano. Estos tests existen para que
// el refactor sea demostrablemente idéntico: si alguien "simplifica" una de las tres semánticas
// creyendo que son la misma, se mueve plata y acá se ve.
describe("wherePeriodoOrden · las tres semánticas del período", () => {
  const soloAno2025 = { ano: [2025], q: [], mes: [] };
  const rango2025 = {
    gte: new Date("2025-01-01T00:00:00.000Z"),
    lt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("venta_cerrada mira SOLO fecha_venta — un reporte de ingresos cuenta lo cerrado", () => {
    expect(wherePeriodoOrden(soloAno2025, "venta_cerrada")).toEqual([{ fecha_venta: rango2025 }]);
  });

  it("fecha_efectiva cae a created_at cuando no hay fecha de venta", () => {
    expect(wherePeriodoOrden(soloAno2025, "fecha_efectiva")).toEqual([
      { fecha_venta: rango2025 },
      { fecha_venta: null, created_at: rango2025 },
    ]);
  });

  it("fecha_efectiva_estricta deja afuera una VENTA sin fecha en vez de fecharla por su alta", () => {
    expect(wherePeriodoOrden(soloAno2025, "fecha_efectiva_estricta")).toEqual([
      { fecha_venta: rango2025 },
      { estatus: { not: "VENTA" }, fecha_venta: null, created_at: rango2025 },
    ]);
  });

  it("las dos variantes de fecha efectiva difieren SOLO en la VENTA sin fecha", () => {
    const laxa = wherePeriodoOrden(soloAno2025, "fecha_efectiva");
    const estricta = wherePeriodoOrden(soloAno2025, "fecha_efectiva_estricta");

    // Misma cantidad de cláusulas y misma primera cláusula: la diferencia es una sola.
    expect(estricta).toHaveLength(laxa.length);
    expect(estricta[0]).toEqual(laxa[0]);
    expect(estricta[1]).not.toEqual(laxa[1]);
  });

  it("un trimestre abre una cláusula por rango, no una sola", () => {
    const q1yq3 = { ano: [2025], q: [1, 3], mes: [] };

    expect(wherePeriodoOrden(q1yq3, "venta_cerrada")).toEqual([
      { fecha_venta: { gte: new Date("2025-01-01T00:00:00.000Z"), lt: new Date("2025-04-01T00:00:00.000Z") } },
      { fecha_venta: { gte: new Date("2025-07-01T00:00:00.000Z"), lt: new Date("2025-10-01T00:00:00.000Z") } },
    ]);
  });

  // El default que se puede romper sin darse cuenta: "sin filtros" NO significa "toda la
  // historia", significa "el año en curso". Si esta función devolviera vacío sin filtros, los
  // tres reportes de ventas pasarían a sumar todos los años.
  it("sin filtros acota al año en curso, nunca a la historia entera", () => {
    const sinFiltros = { ano: [], q: [], mes: [] };
    const or = wherePeriodoOrden(sinFiltros, "venta_cerrada");

    expect(or).toHaveLength(1);
    expect(or[0]).toEqual({
      fecha_venta: {
        gte: new Date(Date.UTC(CURRENT_YEAR, 0, 1)),
        lt: new Date(Date.UTC(CURRENT_YEAR + 1, 0, 1)),
      },
    });
  });
});
