import { tipoMovimiento } from "@/lib/actividad-tipos";

// El tipo de un movimiento tiene dos fuentes: el catálogo (TipoAccion, configurable) y el
// tipo base del enum. La regla de cuál gana estaba repetida en cada consumidor y ya había
// divergido: el filtro "Ver" agrupaba por la FUENTE del dato, así que una nota con
// catálogo y otra sin él salían como dos chips distintos ("Nota" y "Notas").
describe("tipoMovimiento — qué tipo es un movimiento", () => {
  const conCatalogo = {
    tipo: "NOTA" as const,
    tipo_accion: { nombre: "Nota", color: "#111111" },
  };
  const sinCatalogo = { tipo: "NOTA" as const, tipo_accion: null };

  it("el catálogo gana cuando está", () => {
    expect(tipoMovimiento(conCatalogo)).toEqual({ nombre: "Nota", color: "#111111" });
  });

  it("sin catálogo, cae al tipo base", () => {
    expect(tipoMovimiento(sinCatalogo).nombre).toBe("Nota");
  });

  it("con y sin catálogo agrupan juntas si son el mismo tipo (era el bug)", () => {
    expect(tipoMovimiento(conCatalogo).nombre).toBe(tipoMovimiento(sinCatalogo).nombre);
  });

  it("usa el nombre del catálogo tal cual, aunque no exista en el enum", () => {
    const visita = { tipo: "NOTA" as const, tipo_accion: { nombre: "Visita", color: "#222222" } };
    expect(tipoMovimiento(visita).nombre).toBe("Visita");
  });

  it("nunca devuelve vacío: siempre hay con qué etiquetar la fila", () => {
    for (const tipo of ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP", "SISTEMA"] as const) {
      const r = tipoMovimiento({ tipo, tipo_accion: null });
      expect(r.nombre.length).toBeGreaterThan(0);
      expect(r.color).toMatch(/^#/);
    }
  });
});
