import { hayFiltrosDeOrdenes, limpiarFiltrosDeOrdenes } from "@/lib/ordenes-filtros";
import { emptyOrdenFilters } from "@/lib/filter-utils";
import type { FiltroOrdenes } from "@/types/ordenes";

const sinFiltros = (): FiltroOrdenes => emptyOrdenFilters();

describe("hayFiltrosDeOrdenes", () => {
  it("sin nada puesto, no hay filtros", () => {
    expect(hayFiltrosDeOrdenes(sinFiltros())).toBe(false);
  });

  // El bug que motivó esto: con la lista vacía y CERO filtros, /ventas decía "no coinciden con
  // los filtros seleccionados". El predicado tiene que ser falso acá para que el estado vacío
  // diga la verdad.
  it.each([
    ["ano", { ano: [2026] }],
    ["trimestre", { q: [1] }],
    ["mes", { mes: [3] }],
    ["estatus", { estatus: ["VENTA" as const] }],
    ["cliente", { cliente_id: ["x"] }],
    ["tipo", { tipo_cotizacion_id: ["x"] }],
    ["vendedor", { vendedor_id: ["x"] }],
  ])("detecta el filtro por %s", (_nombre, parcial) => {
    expect(hayFiltrosDeOrdenes({ ...sinFiltros(), ...parcial })).toBe(true);
  });

  // `vista` es cómo se mira la lista, no qué se filtra. Agrupar por cliente no esconde nada.
  it("cambiar la vista NO cuenta como filtro", () => {
    expect(hayFiltrosDeOrdenes({ ...sinFiltros(), vista: "lista" })).toBe(false);
  });
});

describe("limpiarFiltrosDeOrdenes", () => {
  it("deja todo en cero", () => {
    const sucio: FiltroOrdenes = {
      ...sinFiltros(),
      ano: [2026],
      q: [2],
      mes: [5],
      estatus: ["VENTA"],
      cliente_id: ["a"],
      tipo_cotizacion_id: ["b"],
      vendedor_id: ["c"],
    };

    expect(hayFiltrosDeOrdenes(limpiarFiltrosDeOrdenes(sucio))).toBe(false);
  });

  it("respeta la vista elegida: limpiar filtros no reagrupa la tabla de golpe", () => {
    const conVista: FiltroOrdenes = { ...sinFiltros(), vista: "lista", ano: [2026] };

    expect(limpiarFiltrosDeOrdenes(conVista).vista).toBe("lista");
  });
});
