import { estadoTarea, esTareaPendiente } from "@/lib/tareas";

// SOL-21/23: el estado es DERIVADO de es_tarea + completada. Solo dos valores, y solo
// para agendadas. Reemplaza a estado_accion (3 estados) y estado_plan (2), que eran el
// mismo concepto por triplicado.
describe("estadoTarea — estado derivado (SSOT)", () => {
  it("agendada sin completar → Pendiente", () => {
    expect(estadoTarea({ es_tarea: true, completada: false })).toBe("PENDIENTE");
  });

  it("agendada y completada → Listo", () => {
    expect(estadoTarea({ es_tarea: true, completada: true })).toBe("LISTO");
  });

  it("lo que NO es tarea no tiene estado (es un registro de algo ya ocurrido)", () => {
    expect(estadoTarea({ es_tarea: false, completada: false })).toBeNull();
    expect(estadoTarea({ es_tarea: false, completada: true })).toBeNull();
  });

  it("coincide con esTareaPendiente: PENDIENTE ⟺ es tarea pendiente", () => {
    const pendiente = { es_tarea: true, completada: false, fecha_tarea: "2026-07-20T15:00:00.000Z" };
    const lista = { es_tarea: true, completada: true, fecha_tarea: "2026-07-20T15:00:00.000Z" };
    expect(estadoTarea(pendiente) === "PENDIENTE").toBe(esTareaPendiente(pendiente));
    expect(estadoTarea(lista) === "PENDIENTE").toBe(esTareaPendiente(lista));
  });
});
