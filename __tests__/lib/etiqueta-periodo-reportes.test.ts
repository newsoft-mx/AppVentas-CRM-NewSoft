import { etiquetaPeriodo } from "@/lib/etiqueta-periodo-reportes";
import { serializeReporteFiltros } from "@/lib/reportes-filtros";
import type { FiltroReportes } from "@/types/reportes";

const filtros = (p: Partial<FiltroReportes> = {}): FiltroReportes => ({ ano: [], q: [], mes: [], ...p });

describe("etiquetaPeriodo", () => {
  it("sin filtros dice que son todos los años, no un período inventado", () => {
    expect(etiquetaPeriodo(filtros())).toBe("Todos los años");
  });

  it("un año", () => {
    expect(etiquetaPeriodo(filtros({ ano: [2026] }))).toBe("2026");
  });

  it("un mes con su año", () => {
    expect(etiquetaPeriodo(filtros({ ano: [2026], mes: [8] }))).toBe("agosto · 2026");
  });

  it("varios meses se enumeran en castellano", () => {
    expect(etiquetaPeriodo(filtros({ ano: [2026], mes: [1, 7, 12] }))).toBe("enero, julio y diciembre · 2026");
  });

  it("trimestres", () => {
    expect(etiquetaPeriodo(filtros({ ano: [2026], q: [1, 3] }))).toBe("Q1 y Q3 · 2026");
  });

  it("el mes gana sobre el trimestre, igual que en el filtro del server", () => {
    // Elegir un mes vacía el trimestre en la barra de filtros; la etiqueta refleja el mismo
    // criterio para no describir un período distinto del que se consultó.
    expect(etiquetaPeriodo(filtros({ ano: [2026], q: [1], mes: [8] }))).toBe("agosto · 2026");
  });

  it("sin año elegido lo dice, en vez de suponer el actual", () => {
    expect(etiquetaPeriodo(filtros({ mes: [8] }))).toBe("agosto · todos los años");
  });

  it("una cifra histórica NO se rotula con el período de los filtros", () => {
    // Es la mitad menos obvia: en esta pantalla conviven cifras filtradas por período con
    // otras que suman todo. Ponerles la misma etiqueta mentiría sobre una de las dos.
    expect(etiquetaPeriodo(filtros({ ano: [2026], mes: [8] }), "historico")).toBe("Histórico completo");
  });
});

describe("la etiqueta no puede desfasarse de los datos", () => {
  it("cambiar los filtros cambia la etiqueta Y la query, siempre juntas", () => {
    // Las dos derivan del MISMO objeto. Este test se rompería si alguien calculara la
    // etiqueta por su cuenta (de un estado aparte, del reloj, de la URL), que es exactamente
    // cómo una pantalla termina diciendo "julio" con datos de agosto.
    const a = filtros({ ano: [2026], mes: [7] });
    const b = filtros({ ano: [2026], mes: [8] });
    expect(etiquetaPeriodo(a)).not.toBe(etiquetaPeriodo(b));
    expect(serializeReporteFiltros(a)).not.toBe(serializeReporteFiltros(b));
  });
});
