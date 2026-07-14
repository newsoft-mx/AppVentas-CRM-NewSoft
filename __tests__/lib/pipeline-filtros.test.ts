import {
  emptyPipelineFiltros,
  serializePipelineFiltros,
  parsePipelineFiltros,
  type PipelineFiltros,
} from "@/lib/pipeline-filtros";

// Convierte el query string serializado al shape de searchParams del server component
// (claves repetidas → string[]), para probar el roundtrip serialize → parse.
function toParamMap(qs: string): Record<string, string | string[]> {
  const p = new URLSearchParams(qs);
  const m: Record<string, string | string[]> = {};
  for (const k of new Set(p.keys())) {
    const all = p.getAll(k);
    m[k] = all.length > 1 ? all : all[0];
  }
  return m;
}

describe("pipeline-filtros", () => {
  it("el estado por defecto serializa a vacío (URL limpia)", () => {
    expect(serializePipelineFiltros(emptyPipelineFiltros())).toBe("");
  });

  it("parsea searchParams vacío al default (activos, sin orden)", () => {
    expect(parsePipelineFiltros({})).toEqual(emptyPipelineFiltros());
  });

  it("roundtrip: serialize → parse conserva filtros no-default", () => {
    const f: PipelineFiltros = {
      q: "acme",
      estados: ["GANADO", "PERDIDO"],
      orden: "valor",
      vendedor: "v-1",
      tipo: "t-2",
      vista: "lista",
    };
    expect(parsePipelineFiltros(toParamMap(serializePipelineFiltros(f)))).toEqual(f);
  });

  it("descarta valores inválidos (orden y estado) cayendo al default", () => {
    const r = parsePipelineFiltros({ orden: "hackeado", estado: ["ABIERTO", "XXX"] });
    expect(r.orden).toBe("none");
    expect(r.estados).toEqual(["ABIERTO"]); // XXX se filtra
  });

  it("estados = default no se escriben en la URL", () => {
    const f = emptyPipelineFiltros();
    f.q = "hola";
    // solo q, no 'estado'
    expect(serializePipelineFiltros(f)).toBe("q=hola");
  });
});
