import { estadoAtencion, requiereAtencion, type ActividadAtencion } from "@/lib/atencion";

const AHORA = new Date("2026-06-29T12:00:00.000Z");

function tarea(fecha_tarea: string, completada = false): ActividadAtencion {
  return { es_tarea: true, completada, fecha_tarea, created_at: fecha_tarea };
}
function nota(created_at: string): ActividadAtencion {
  return { es_tarea: false, completada: false, fecha_tarea: null, created_at };
}

describe("estadoAtencion", () => {
  it("EN_SEGUIMIENTO cuando hay un seguimiento futuro pendiente (stand-by, no alerta)", () => {
    const r = estadoAtencion([tarea("2026-07-15T10:00:00.000Z")], AHORA);
    expect(r.estado).toBe("EN_SEGUIMIENTO");
    expect(r.vencido).toBe(false);
    expect(r.proximo_seguimiento).toBe("2026-07-15T10:00:00.000Z");
    expect(requiereAtencion(r)).toBe(false);
  });

  it("VENCIDO cuando el seguimiento pendiente ya pasó", () => {
    const r = estadoAtencion([tarea("2026-06-20T10:00:00.000Z")], AHORA);
    expect(r.estado).toBe("VENCIDO");
    expect(r.vencido).toBe(true);
    expect(requiereAtencion(r)).toBe(true);
  });

  it("toma el seguimiento pendiente más cercano e ignora los terminados", () => {
    const r = estadoAtencion(
      [
        tarea("2026-06-10T10:00:00.000Z", true), // terminado → ignorado
        tarea("2026-07-20T10:00:00.000Z"),
        tarea("2026-07-05T10:00:00.000Z"),
      ],
      AHORA
    );
    expect(r.estado).toBe("EN_SEGUIMIENTO");
    expect(r.proximo_seguimiento).toBe("2026-07-05T10:00:00.000Z");
  });

  it("SIN_PROXIMA y alerta cuando no hay seguimiento y la última actividad supera 7 días", () => {
    const r = estadoAtencion([nota("2026-06-18T10:00:00.000Z")], AHORA); // 11 días
    expect(r.estado).toBe("SIN_PROXIMA");
    expect(r.dias_inactivo).toBeGreaterThan(7);
    expect(requiereAtencion(r)).toBe(true);
  });

  it("SIN_PROXIMA sin alerta cuando la última actividad es reciente (≤7 días)", () => {
    const r = estadoAtencion([nota("2026-06-26T10:00:00.000Z")], AHORA); // 3 días
    expect(r.estado).toBe("SIN_PROXIMA");
    expect(r.dias_inactivo).toBeLessThanOrEqual(7);
    expect(requiereAtencion(r)).toBe(false);
  });

  it("un seguimiento futuro pendiente gana sobre la inactividad (resuelve el reclamo)", () => {
    const r = estadoAtencion(
      [nota("2026-05-01T10:00:00.000Z"), tarea("2026-07-10T10:00:00.000Z")],
      AHORA
    );
    expect(r.estado).toBe("EN_SEGUIMIENTO");
    expect(requiereAtencion(r)).toBe(false);
  });

  it("sin actividades → SIN_PROXIMA con alerta", () => {
    const r = estadoAtencion([], AHORA);
    expect(r.estado).toBe("SIN_PROXIMA");
    expect(requiereAtencion(r)).toBe(true);
  });
});
