import { ACCIONES_FILTROS, emptyAccionesFiltros } from "@/lib/acciones-filtros";
import { FUNNEL_FILTROS, emptyFunnelFiltros, serializeFunnelMemoria } from "@/lib/funnel-filtros";
import {
  PIPELINE_FILTROS,
  emptyPipelineFiltros,
  serializePipelineMemoria,
} from "@/lib/pipeline-filtros";
import {
  cookieDeMemoria, esValorCookieSeguro, type ContratoFiltros,
} from "@/lib/filtros-memoria";
import { REPORTES_FILTROS } from "@/lib/reportes-filtros";
import { serializeOrdenMemoria } from "@/lib/ordenes-filtros";
import { emptyOrdenFilters } from "@/lib/filter-utils";

// Contratos con un objeto "todo distinto del default" para ejercitarlos de verdad.
const CASOS: { nombre: string; contrato: ContratoFiltros<never>; lleno: unknown; vacio: unknown }[] = [
  {
    nombre: "pipeline",
    contrato: PIPELINE_FILTROS as unknown as ContratoFiltros<never>,
    lleno: {
      q: "acme",
      estados: ["GANADO"],
      orden: "valor",
      vendedor: "v-1",
      tipo: "t-2",
      vista: "lista",
    },
    vacio: emptyPipelineFiltros(),
  },
  {
    nombre: "acciones",
    contrato: ACCIONES_FILTROS as unknown as ContratoFiltros<never>,
    lleno: { vista: "calendario", vendedor: "v-1", tipo: "LLAMADA" },
    vacio: emptyAccionesFiltros(),
  },
  {
    nombre: "funnel",
    contrato: FUNNEL_FILTROS as unknown as ContratoFiltros<never>,
    lleno: { preset: "semana", desde: "2026-01-01", hasta: "2026-01-31", vendedor: "v-1" },
    vacio: emptyFunnelFiltros(),
  },
];

describe.each(CASOS)("contrato de $nombre", ({ contrato, lleno, vacio }) => {
  const c = contrato as unknown as ContratoFiltros<unknown>;

  it("toda clave que emite serialize está declarada en `claves`", () => {
    // El olvido clásico: se agrega un filtro nuevo y no se suma a la lista. Sin esto, la
    // precedencia se rompe en silencio — la URL traería ese filtro y `hayFiltrosEnUrl`
    // devolvería false, así que la cookie pisaría el link que alguien compartió.
    const emitidas = [...new URLSearchParams(c.serialize(lleno)).keys()];
    expect(emitidas.length).toBeGreaterThan(0);
    for (const k of emitidas) expect(c.claves).toContain(k);
  });

  it("el default serializa a vacío (deja la URL limpia)", () => {
    expect(c.serialize(vacio)).toBe("");
  });

  it("limpiar los filtros BORRA la cookie, sin necesidad de una bandera", () => {
    const qs = c.serializeMemoria!(vacio);
    expect(qs).toBe("");
    expect(cookieDeMemoria(c.pantalla, qs)).toContain("Max-Age=0");
  });

  it("lo que se recuerda es un subconjunto de lo que se serializa a la URL", () => {
    const enUrl = new Set([...new URLSearchParams(c.serialize(lleno)).keys()]);
    for (const k of new URLSearchParams(c.serializeMemoria!(lleno)).keys()) {
      expect(enUrl.has(k)).toBe(true);
    }
  });
});

describe("qué recuerda cada pantalla: TODO lo seleccionable", () => {
  // La regla, después de que el período de Ventas no persistiera y se leyera como un bug:
  // se recuerda todo lo que se puede ELEGIR. La única exclusión es el texto libre, y no por
  // criterio de producto sino porque rompería el charset de la cookie.

  it("pipeline NO recuerda la búsqueda —es texto libre—, pero sí el resto", () => {
    const f = { ...emptyPipelineFiltros(), q: "acme", vendedor: "v-1" };
    const qs = serializePipelineMemoria(f);
    expect(qs).not.toContain("q=");
    expect(qs).toContain("vendedor=v-1");
  });

  it("ventas recuerda el período: era la exclusión que se leía como 'no persisten'", () => {
    const qs = serializeOrdenMemoria({
      ...emptyOrdenFilters(),
      ano: [2026],
      mes: [8],
      estatus: ["VENTA"],
    });
    expect(qs).toContain("ano=2026");
    expect(qs).toContain("mes=8");
    expect(qs).toContain("estatus=VENTA");
  });

  it("reportes recuerda: antes no declaraba memoria y era la única pantalla que no guardaba nada", () => {
    expect(REPORTES_FILTROS.serializeMemoria).toBeDefined();
    const qs = REPORTES_FILTROS.serializeMemoria!({ ano: [2026], q: [3], mes: [] });
    expect(qs).toContain("ano=2026");
    expect(qs).toContain("q=3");
  });

  it("funnel recuerda el rango personalizado: la pantalla lo muestra bajo el título", () => {
    const qs = serializeFunnelMemoria({
      preset: "custom",
      desde: "2026-01-01",
      hasta: "2026-01-31",
      vendedor: "v-1",
    });
    expect(qs).toContain("preset=custom");
    expect(qs).toContain("desde=2026-01-01");
    expect(qs).toContain("hasta=2026-01-31");
  });

  it("todo lo que se recuerda pasa el charset de la cookie, o la memoria se borraría sola", () => {
    // Es la restricción REAL detrás de la única exclusión que queda. Si un serializador de
    // memoria emitiera texto libre, `cookieDeMemoria` devolvería un borrado y la pantalla
    // perdería la memoria entera sin que nadie se entere.
    const casos = [
      serializeOrdenMemoria({ ...emptyOrdenFilters(), ano: [2026], estatus: ["VENTA"] }),
      REPORTES_FILTROS.serializeMemoria!({ ano: [2026], q: [1], mes: [12] }),
      serializeFunnelMemoria({ preset: "custom", desde: "2026-01-01", hasta: "2026-01-31", vendedor: "v-1" }),
      serializePipelineMemoria({ ...emptyPipelineFiltros(), q: "acme con acentós", vendedor: "v-1" }),
    ];
    for (const qs of casos) expect(esValorCookieSeguro(qs)).toBe(true);
  });
});
