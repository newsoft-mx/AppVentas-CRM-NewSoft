import { etiquetaDelTablero, emptyPipelineFiltros } from "@/lib/pipeline-filtros";
import type { PipelineFiltros } from "@/lib/pipeline-filtros";

const base = (extra: Partial<PipelineFiltros> = {}): PipelineFiltros => ({
  ...emptyPipelineFiltros(),
  ...extra,
});

describe("etiquetaDelTablero", () => {
  it("con el filtro por defecto dice lo que el equipo ya dice", () => {
    expect(etiquetaDelTablero(base())).toBe("Prospectos activos");
  });

  // El bug: el encabezado afirmaba "Prospectos activos" pasara lo que pasara.
  it("al filtrar por otro estado deja de decir 'activos'", () => {
    expect(etiquetaDelTablero(base({ estados: ["GANADO"] }))).toBe("Ganado");
    expect(etiquetaDelTablero(base({ estados: ["GANADO", "PERDIDO"] }))).toBe("Ganado y Perdido");
  });

  it("nombra al vendedor, no su id", () => {
    const f = base({ vendedor: "v-1" });

    expect(etiquetaDelTablero(f, { vendedor: "Gabriela García" })).toBe(
      "Prospectos activos · Gabriela García"
    );
  });

  it("sin el nombre a mano, no muestra el id crudo", () => {
    expect(etiquetaDelTablero(base({ vendedor: "v-1" }))).toBe("Prospectos activos · un vendedor");
  });

  it("suma la línea de producto y el texto buscado", () => {
    const f = base({ tipo: "t-1", q: "  portal " });

    expect(etiquetaDelTablero(f, { tipo: "TrackPoint" })).toBe(
      "Prospectos activos · TrackPoint · «portal»"
    );
  });

  it("apila los tres filtros en el orden en que se leen", () => {
    const f = base({ estados: ["GANADO"], vendedor: "v-1", tipo: "t-1", q: "flota" });

    expect(etiquetaDelTablero(f, { vendedor: "Frania", tipo: "TrackPoint" })).toBe(
      "Ganado · Frania · TrackPoint · «flota»"
    );
  });

  // Se puede destildar todo en el panel de filtros: el tablero queda vacío y el encabezado
  // tiene que explicar por qué, no seguir prometiendo prospectos.
  it("sin ningún estado tildado lo dice, en vez de mentir", () => {
    expect(etiquetaDelTablero(base({ estados: [] }))).toBe("Sin estados seleccionados");
  });

  it("una búsqueda de solo espacios no ensucia la etiqueta", () => {
    expect(etiquetaDelTablero(base({ q: "   " }))).toBe("Prospectos activos");
  });
});
