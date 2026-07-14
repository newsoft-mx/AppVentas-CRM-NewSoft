import {
  esTareaPendiente,
  estaVencida,
  grupoUrgencia,
  WHERE_TAREA_PENDIENTE,
} from "@/lib/tareas";

// Ancla local (no UTC) para grupoUrgencia, que agrupa por día en hora local.
const AHORA = new Date(2026, 6, 14, 12, 0, 0); // 14-jul-2026 12:00 local
const DIA = 86_400_000;

describe("esTareaPendiente (predicado SSOT en memoria)", () => {
  it("es pendiente si es tarea agendada, no completada, con fecha", () => {
    expect(esTareaPendiente({ es_tarea: true, completada: false, fecha_tarea: "2026-07-20" })).toBe(true);
  });
  it("no es pendiente si está completada", () => {
    expect(esTareaPendiente({ es_tarea: true, completada: true, fecha_tarea: "2026-07-20" })).toBe(false);
  });
  it("no es pendiente si no es tarea (nota / registro)", () => {
    expect(esTareaPendiente({ es_tarea: false, completada: false, fecha_tarea: "2026-07-20" })).toBe(false);
  });
  it("no es pendiente si no tiene fecha agendada", () => {
    expect(esTareaPendiente({ es_tarea: true, completada: false, fecha_tarea: null })).toBe(false);
  });
});

describe("estaVencida (vencimiento al instante)", () => {
  const ahoraMs = AHORA.getTime();
  it("vencida si la fecha ya pasó", () => {
    expect(estaVencida(new Date(ahoraMs - 1), ahoraMs)).toBe(true);
    expect(estaVencida("2026-07-13T00:00:00.000Z", ahoraMs)).toBe(true);
  });
  it("no vencida si la fecha es futura o igual al instante", () => {
    expect(estaVencida(new Date(ahoraMs + 1), ahoraMs)).toBe(false);
    expect(estaVencida(new Date(ahoraMs), ahoraMs)).toBe(false);
  });
  it("acepta Date o string ISO indistintamente", () => {
    const iso = new Date(ahoraMs - DIA).toISOString();
    expect(estaVencida(iso, ahoraMs)).toBe(true);
  });
});

describe("grupoUrgencia (agrupamiento por día)", () => {
  it("null → DESPUES (sin fecha agendada)", () => {
    expect(grupoUrgencia(null, AHORA)).toBe("DESPUES");
  });
  it("día anterior a hoy → VENCIDAS", () => {
    expect(grupoUrgencia(new Date(2026, 6, 13, 23, 59), AHORA)).toBe("VENCIDAS");
  });
  it("cualquier hora de hoy (incluida ya pasada) → HOY", () => {
    expect(grupoUrgencia(new Date(2026, 6, 14, 0, 5), AHORA)).toBe("HOY");
    expect(grupoUrgencia(new Date(2026, 6, 14, 23, 30), AHORA)).toBe("HOY");
  });
  it("dentro de los próximos 7 días → SEMANA", () => {
    expect(grupoUrgencia(new Date(2026, 6, 18, 9, 0), AHORA)).toBe("SEMANA");
  });
  it("a 7+ días → DESPUES", () => {
    expect(grupoUrgencia(new Date(2026, 6, 25, 9, 0), AHORA)).toBe("DESPUES");
  });
});

describe("WHERE_TAREA_PENDIENTE (fragmento Prisma)", () => {
  it("codifica el mismo criterio que el predicado en memoria + eliminada:false", () => {
    expect(WHERE_TAREA_PENDIENTE).toEqual({
      es_tarea: true,
      completada: false,
      fecha_tarea: { not: null },
      eliminada: false,
    });
  });
});
