import { ACCIONES_FILTROS, emptyAccionesFiltros } from "@/lib/acciones-filtros";
import { FUNNEL_FILTROS, emptyFunnelFiltros, serializeFunnelMemoria } from "@/lib/funnel-filtros";
import {
  PIPELINE_FILTROS,
  emptyPipelineFiltros,
  serializePipelineMemoria,
} from "@/lib/pipeline-filtros";
import { cookieDeMemoria, type ContratoFiltros } from "@/lib/filtros-memoria";

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

describe("qué recuerda cada pantalla (las exclusiones son la decisión de producto)", () => {
  it("pipeline NO recuerda la búsqueda, pero sí el resto", () => {
    const f = { ...emptyPipelineFiltros(), q: "acme", vendedor: "v-1" };
    const qs = serializePipelineMemoria(f);
    expect(qs).not.toContain("q=");
    expect(qs).toContain("vendedor=v-1");
  });

  it("funnel recuerda el preset relativo pero NUNCA las fechas absolutas", () => {
    const qs = serializeFunnelMemoria({
      preset: "semana",
      desde: "2026-01-01",
      hasta: "2026-01-31",
      vendedor: "v-1",
    });
    expect(qs).toContain("preset=semana");
    expect(qs).not.toContain("desde");
    expect(qs).not.toContain("hasta");
  });

  it("un preset 'custom' no se recuerda: sin sus fechas no significa nada", () => {
    const qs = serializeFunnelMemoria({ preset: "custom", desde: "2026-01-01", hasta: "", vendedor: "" });
    expect(qs).toBe("");
  });
});
