import { limiteDiaNegocio } from "@/lib/tz";

// Bloque B — los límites de día de los reportes se resuelven en la TZ del negocio,
// no en la del proceso. México (America/Mexico_City) hoy es UTC-6 fijo (sin DST).
describe("limiteDiaNegocio", () => {
  it("inicio de día en México = 06:00 UTC", () => {
    const d = limiteDiaNegocio("2026-07-13", "inicio", "America/Mexico_City");
    expect(d?.toISOString()).toBe("2026-07-13T06:00:00.000Z");
  });

  it("fin de día en México = 05:59:59.999 UTC del día siguiente", () => {
    const d = limiteDiaNegocio("2026-07-13", "fin", "America/Mexico_City");
    expect(d?.toISOString()).toBe("2026-07-14T05:59:59.999Z");
  });

  it("respeta una TZ distinta (UTC)", () => {
    expect(limiteDiaNegocio("2026-07-13", "inicio", "UTC")?.toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(limiteDiaNegocio("2026-07-13", "fin", "UTC")?.toISOString()).toBe("2026-07-13T23:59:59.999Z");
  });

  it("una zona al este de UTC adelanta el inicio (Madrid, verano UTC+2)", () => {
    // 2026-07-13 está en horario de verano europeo → Europe/Madrid = UTC+2
    expect(limiteDiaNegocio("2026-07-13", "inicio", "Europe/Madrid")?.toISOString()).toBe("2026-07-12T22:00:00.000Z");
  });

  it("rechaza fechas mal formadas", () => {
    expect(limiteDiaNegocio("13/07/2026", "inicio", "UTC")).toBeNull();
    expect(limiteDiaNegocio("", "inicio", "UTC")).toBeNull();
  });
});
