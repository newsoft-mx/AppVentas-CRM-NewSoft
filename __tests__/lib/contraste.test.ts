import { contraste, luminancia, textoSobre, TEXTO_CLARO, TEXTO_OSCURO } from "@/lib/contraste";

/**
 * El texto sobre un color elegido por el usuario tiene que decidirse solo.
 * Los casos de acá son los colores REALES del sistema (marca, etapas del pipeline y
 * temperaturas), no ejemplos inventados.
 */
describe("contraste", () => {
  it("los extremos dan los valores canónicos de WCAG", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("acepta hex de 3 dígitos y con o sin almohadilla", () => {
    expect(luminancia("#fff")).toBeCloseTo(luminancia("#FFFFFF"), 6);
    expect(luminancia("1B2A4A")).toBeCloseTo(luminancia("#1B2A4A"), 6);
  });

  it("un color no interpretable se trata como claro (texto oscuro encima)", () => {
    // Ante la duda, texto oscuro sobre fondo asumido claro: es el caso que más veces se lee.
    expect(textoSobre("no-es-un-color")).toBe(TEXTO_OSCURO);
    expect(textoSobre("")).toBe(TEXTO_OSCURO);
  });

  it("sobre el naranja de marca elige el texto oscuro, no el blanco", () => {
    // El caso que motivó el módulo: blanco sobre #E8751A da 3.0:1 y el mínimo es 4.5.
    expect(contraste("#FFFFFF", "#E8751A")).toBeLessThan(4.5);
    expect(textoSobre("#E8751A")).toBe(TEXTO_OSCURO);
    expect(contraste(textoSobre("#E8751A"), "#E8751A")).toBeGreaterThan(4.5);
  });

  it("sobre el navy de marca elige blanco", () => {
    expect(textoSobre("#1B2A4A")).toBe(TEXTO_CLARO);
  });

  it("elige bien en los dos extremos que un admin puede configurar", () => {
    expect(textoSobre("#FEF08A")).toBe(TEXTO_OSCURO); // amarillo claro
    expect(textoSobre("#0B1422")).toBe(TEXTO_CLARO); // casi negro
  });

  it("el color elegido SIEMPRE gana o empata contra la alternativa", () => {
    // La invariante que hace innecesario revisar caso por caso: para cualquier fondo,
    // textoSobre() nunca devuelve el peor de los dos.
    const fondos = ["#E8751A", "#1B2A4A", "#22C55E", "#3B82F6", "#F59E0B", "#64748B",
                    "#A855F7", "#14B8A6", "#FFFFFF", "#000000", "#9BA5BE", "#E8330A"];
    for (const f of fondos) {
      const elegido = contraste(textoSobre(f), f);
      const otro = contraste(textoSobre(f) === TEXTO_CLARO ? TEXTO_OSCURO : TEXTO_CLARO, f);
      expect(elegido).toBeGreaterThanOrEqual(otro);
    }
  });
});
