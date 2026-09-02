import {
  contraste,
  luminancia,
  mezclar,
  oscurecerHasta,
  textoSobre,
  TEXTO_CLARO,
  TEXTO_OSCURO,
} from "@/lib/contraste";

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

describe("mezclar", () => {
  it("un color al 0% es el fondo, al 100% es el color", () => {
    expect(mezclar("#F5A623", "#FFFFFF", 0)).toBe("#ffffff");
    expect(mezclar("#F5A623", "#FFFFFF", 1)).toBe("#f5a623");
  });

  it("compone el alfa como lo hace el navegador", () => {
    // El chip del tablero: color al 10% sobre blanco. Sin componer, medir contra #F5A623
    // devuelve un número inventado — ese fue el bug del primer medidor.
    const tinte = mezclar("#F5A623", "#FFFFFF", 0.1);
    expect(contraste("#F5A623", tinte)).toBeLessThan(2);
  });
});

describe("oscurecerHasta", () => {
  const TEMPERATURAS = ["#E8330A", "#F47920", "#F5A623", "#4A90D9", "#2A5298"];

  it("deja legible el texto de los cinco chips de temperatura sobre su propio 10%", () => {
    for (const color of TEMPERATURAS) {
      const tinte = mezclar(color, "#FFFFFF", 0.1);
      expect(contraste(oscurecerHasta(color, tinte), tinte)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("no toca un color que ya alcanza el mínimo", () => {
    // Muy frío ya daba 6.52:1; oscurecerlo sería empeorar el diseño sin motivo.
    const tinte = mezclar("#2A5298", "#FFFFFF", 0.1);
    expect(oscurecerHasta("#2A5298", tinte)).toBe("#2a5298");
  });

  it("respeta un mínimo distinto", () => {
    const tinte = mezclar("#F5A623", "#FFFFFF", 0.1);
    expect(contraste(oscurecerHasta("#F5A623", tinte, 7), tinte)).toBeGreaterThanOrEqual(7);
  });
});
