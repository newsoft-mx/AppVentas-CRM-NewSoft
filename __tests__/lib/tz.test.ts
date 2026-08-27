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

  it("rechaza fechas con la FORMA correcta que no existen en el calendario", () => {
    // El regex las dejaba pasar y la aritmética las desbordaba a otro mes en silencio:
    // "2026-13-01" daba el 1-ene-2027 y "2026-02-31" el 3-mar. Un ?desde= así devolvía
    // un período que nadie pidió, y sin error a la vista no había forma de notarlo.
    expect(limiteDiaNegocio("2026-13-01", "inicio", "UTC")).toBeNull();
    expect(limiteDiaNegocio("2026-02-31", "inicio", "UTC")).toBeNull();
    expect(limiteDiaNegocio("2026-00-10", "inicio", "UTC")).toBeNull();
    expect(limiteDiaNegocio("2026-07-32", "fin", "UTC")).toBeNull();
    // El 29 de febrero SÍ existe en año bisiesto: la validación no puede pasarse de celosa.
    expect(limiteDiaNegocio("2028-02-29", "inicio", "UTC")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
});
