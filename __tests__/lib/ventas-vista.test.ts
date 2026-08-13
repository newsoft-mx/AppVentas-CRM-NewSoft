import {
  MODO_VISTA_DEFAULT, MODOS_VISTA, parseModoVista, serializeModoVista,
} from "@/lib/ventas-vista";
import { parseOrdenFiltros, serializeOrdenFiltros } from "@/lib/ordenes-filtros";
import { emptyOrdenFilters } from "@/lib/filter-utils";

describe("parseModoVista", () => {
  it("acepta los modos válidos", () => {
    for (const m of MODOS_VISTA) expect(parseModoVista(m)).toBe(m);
  });

  it("cae al default ante basura, en vez de romper la pantalla", () => {
    // La URL la escribe cualquiera: un `?vista=` inventado no puede dejar la tabla en un
    // estado que el componente no sepa pintar.
    for (const basura of ["", "AGRUPADO", "kanban", "null", "0", undefined]) {
      expect(parseModoVista(basura)).toBe(MODO_VISTA_DEFAULT);
    }
  });
});

describe("serializeModoVista", () => {
  it("el default no se escribe: deja la URL limpia", () => {
    expect(serializeModoVista(MODO_VISTA_DEFAULT)).toBe("");
  });

  it("el modo no-default sí", () => {
    expect(serializeModoVista("lista")).toBe("lista");
  });
});

describe("la vista viaja con los filtros", () => {
  it("agrupado no ensucia el query string", () => {
    const qs = serializeOrdenFiltros({ ...emptyOrdenFilters(), vista: "agrupado" });
    expect(qs).toBe("");
  });

  it("lista sí aparece en la URL — es un link que se comparte", () => {
    const qs = serializeOrdenFiltros({ ...emptyOrdenFilters(), vista: "lista" });
    expect(qs).toBe("vista=lista");
  });

  it("ida y vuelta: lo que se serializa se vuelve a parsear igual", () => {
    const original = {
      ...emptyOrdenFilters(),
      estatus: ["VENTA" as const],
      vista: "lista" as const,
    };
    const qs = serializeOrdenFiltros(original);
    const sp = Object.fromEntries(new URLSearchParams(qs));
    const devuelta = parseOrdenFiltros(sp);
    expect(devuelta.vista).toBe("lista");
    expect(devuelta.estatus).toEqual(["VENTA"]);
  });

  it("sin `vista` en la URL, arranca agrupado — la pantalla de siempre", () => {
    expect(parseOrdenFiltros({}).vista).toBe("agrupado");
  });
});
