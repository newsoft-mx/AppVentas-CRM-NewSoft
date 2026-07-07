import {
  subirTemperatura,
  enfriarPorInactividad,
  cruzaUmbralAvance,
  actividadExitosa,
  type ParametrosTermometro,
} from "@/lib/termometro";

const PARAMS: ParametrosTermometro = {
  puntos_actividad: { LLAMADA: 1, EMAIL: 1, WHATSAPP: 1, NOTA: 0 },
  enfriamiento_nivel: 1,
};

describe("termometro — subir", () => {
  it("sube un nivel con actividad exitosa", () => {
    expect(subirTemperatura("TIBIO", "LLAMADA", PARAMS)).toBe("CALIENTE");
  });

  it("una NOTA (0 puntos) no mueve el termómetro", () => {
    expect(subirTemperatura("TIBIO", "NOTA", PARAMS)).toBe("TIBIO");
  });

  it("no supera el tope MUY_CALIENTE (clamp)", () => {
    expect(subirTemperatura("MUY_CALIENTE", "EMAIL", PARAMS)).toBe("MUY_CALIENTE");
  });
});

describe("termometro — enfriar por inactividad", () => {
  it("enfría un nivel si supera el umbral de días", () => {
    expect(enfriarPorInactividad("CALIENTE", 10, 7, PARAMS)).toBe("TIBIO");
  });

  it("no enfría si la inactividad está dentro del umbral", () => {
    expect(enfriarPorInactividad("CALIENTE", 5, 7, PARAMS)).toBe("CALIENTE");
  });

  it("no baja de MUY_FRIO (clamp)", () => {
    expect(enfriarPorInactividad("MUY_FRIO", 30, 7, PARAMS)).toBe("MUY_FRIO");
  });
});

describe("termometro — avance de etapa", () => {
  it("cruza el umbral cuando la temperatura lo alcanza o supera", () => {
    expect(cruzaUmbralAvance("CALIENTE", "CALIENTE")).toBe(true);
    expect(cruzaUmbralAvance("MUY_CALIENTE", "CALIENTE")).toBe(true);
  });

  it("no cruza si la temperatura está por debajo del umbral", () => {
    expect(cruzaUmbralAvance("TIBIO", "CALIENTE")).toBe(false);
  });

  it("sin umbral configurado, nunca dispara avance", () => {
    expect(cruzaUmbralAvance("MUY_CALIENTE", null)).toBe(false);
  });
});

describe("termometro — actividad exitosa", () => {
  it("la llamada solo cuenta si contestó", () => {
    expect(actividadExitosa("LLAMADA", true)).toBe(true);
    expect(actividadExitosa("LLAMADA", false)).toBe(false);
    expect(actividadExitosa("LLAMADA", null)).toBe(false);
  });

  it("email/whatsapp/nota cuentan como éxito", () => {
    expect(actividadExitosa("EMAIL", null)).toBe(true);
    expect(actividadExitosa("WHATSAPP", null)).toBe(true);
    expect(actividadExitosa("NOTA", null)).toBe(true);
  });
});
