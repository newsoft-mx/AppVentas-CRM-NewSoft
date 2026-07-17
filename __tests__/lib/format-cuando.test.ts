import { formatCuando } from "@/lib/utils";

// SOL-22: la fecha siempre está; la hora es opcional. fecha_tarea es un instante y siempre
// lleva hora, así que sin `hora_definida` habría que inventarle una y mostrarla como si la
// hubiera elegido el usuario — que es justo lo que hacía antes (09:00 por default).
describe("formatCuando — el 'cuándo' de una actividad", () => {
  // 2026-08-20 23:59 hora de pared CDMX (UTC-6) = 2026-08-21 05:59Z
  const finDelDia = "2026-08-21T05:59:00.000Z";
  // 2026-08-20 15:30 CDMX = 21:30Z
  const conHora = "2026-08-20T21:30:00.000Z";

  it("con hora elegida, muestra fecha y hora", () => {
    expect(formatCuando(conHora, true)).toMatch(/20-ago/);
    expect(formatCuando(conHora, true)).toMatch(/03:30/);
  });

  it("sin hora, muestra SOLO la fecha", () => {
    const salida = formatCuando(finDelDia, false);
    expect(salida).toMatch(/20-ago/);
    // Lo importante: no se filtra la hora interna (23:59) como si la hubieran elegido.
    expect(salida).not.toMatch(/\d{2}:\d{2}/);
  });

  it("sin hora, el fin del día no corre la fecha al día siguiente", () => {
    // El instante guardado cae en el 21 en UTC; en hora de pared CDMX sigue siendo el 20.
    expect(formatCuando(finDelDia, false)).toMatch(/20-ago/);
    expect(formatCuando(finDelDia, false)).not.toMatch(/21-ago/);
  });
});
