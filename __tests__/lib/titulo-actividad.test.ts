import { tituloActividad } from "@/lib/actividad-tipos";

// SOL-21 volvió opcional la nota, y quien la usaba de título quedó sin nada: tarjetas sin
// encabezado en la agenda y tooltips cortados en el calendario. La regla vive en un solo
// lugar; esto la fija.
describe("tituloActividad — título de un movimiento en una lista", () => {
  it("usa la nota cuando hay", () => {
    expect(tituloActividad({ contenido: "Agendar llamada de cierre", tipo: "LLAMADA" })).toBe(
      "Agendar llamada de cierre"
    );
  });

  it("sin nota, el tipo ES el movimiento", () => {
    expect(tituloActividad({ contenido: "", tipo: "LLAMADA" })).toBe("Llamada");
    expect(tituloActividad({ contenido: "", tipo: "WHATSAPP" })).toBe("WhatsApp");
  });

  it("una nota en blanco no es una nota", () => {
    expect(tituloActividad({ contenido: "   \n  ", tipo: "EMAIL" })).toBe("Email");
  });

  it("nunca devuelve vacío (era el bug: tarjeta sin título)", () => {
    const tipos = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP", "SISTEMA"] as const;
    for (const tipo of tipos) {
      expect(tituloActividad({ contenido: "", tipo }).length).toBeGreaterThan(0);
    }
  });
});
