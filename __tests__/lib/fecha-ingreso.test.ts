import { fechaIngresoAInstante } from "@/lib/deals";
import { rangoFechas, filtroRango } from "@/lib/reportes-funnel";
import { limiteDiaNegocio } from "@/lib/tz";

/**
 * La fecha de registro de un lead (fecha_ingreso) contra el rango de los reportes.
 *
 * El caso que motiva todo (Gabriela, 17-ago): carga el lunes un lead que llegó el viernes,
 * le pone fecha del viernes, y el reporte de la semana pasada le muestra 3 leads en vez de 4.
 * Eran dos defectos encadenados —el filtro miraba created_at, y la fecha se guardaba con la
 * medianoche del server— así que los tests van sobre el viaje completo: lo que se guarda
 * tiene que caer dentro del rango que el reporte consulta.
 */

// El rango tal cual lo arma el endpoint, y la pregunta que de verdad importa.
function caeEnRango(guardado: Date, sp: string, ahora: Date): boolean {
  const r = filtroRango(rangoFechas(new URLSearchParams(sp), ahora));
  const desdeOk = guardado.getTime() >= r.gte.getTime();
  const hastaOk = !("lte" in r) || guardado.getTime() <= (r as { lte: Date }).lte.getTime();
  return desdeOk && hastaOk;
}

describe("fecha de registro del lead", () => {
  it("se guarda como el inicio del día en la TZ del negocio, no en la del proceso", () => {
    const guardado = fechaIngresoAInstante("2026-08-14")!;
    // México (UTC-6 en agosto): el día arranca a las 06:00 UTC. `new Date("…T00:00:00")` en
    // un server UTC daba las 00:00 UTC, que allá todavía es el 13 a las 18:00.
    expect(guardado.toISOString()).toBe("2026-08-14T06:00:00.000Z");
    expect(guardado.getTime()).toBe(limiteDiaNegocio("2026-08-14", "inicio")!.getTime());
  });

  it("un lead cargado el lunes con fecha del viernes cuenta en la semana del viernes", () => {
    // EL bug reportado. Antes el reporte filtraba por created_at (el lunes) y este lead
    // desaparecía del rango 10–14, que era el cuarto que no le aparecía.
    const guardado = fechaIngresoAInstante("2026-08-14")!;
    const elLunesSiguiente = new Date("2026-08-17T15:00:00Z");
    expect(caeEnRango(guardado, "desde=2026-08-10&hasta=2026-08-14", elLunesSiguiente)).toBe(true);
  });

  it("y NO cuenta en la semana en que se tecleó", () => {
    // La otra mitad: si contara en las dos, los totales seguirían sin cerrar.
    const guardado = fechaIngresoAInstante("2026-08-14")!;
    const ahora = new Date("2026-08-21T15:00:00Z");
    expect(caeEnRango(guardado, "desde=2026-08-17&hasta=2026-08-21", ahora)).toBe(false);
  });

  it("los bordes del rango son inclusivos en los dos extremos", () => {
    // Un lead del primer día y otro del último: con el corrimiento de TZ, el del día 10 caía
    // en el 9 y quedaba afuera por 6 horas — el error más difícil de ver a ojo.
    const ahora = new Date("2026-08-17T15:00:00Z");
    for (const dia of ["2026-08-10", "2026-08-14"]) {
      expect(caeEnRango(fechaIngresoAInstante(dia)!, "desde=2026-08-10&hasta=2026-08-14", ahora)).toBe(true);
    }
    expect(caeEnRango(fechaIngresoAInstante("2026-08-09")!, "desde=2026-08-10&hasta=2026-08-14", ahora)).toBe(false);
    expect(caeEnRango(fechaIngresoAInstante("2026-08-15")!, "desde=2026-08-10&hasta=2026-08-14", ahora)).toBe(false);
  });

  it("rechaza lo que no es una fecha en vez de inventar una", () => {
    // Un null acá hace que el endpoint conteste 422. Si en cambio cayera a "hoy", el lead
    // volvería a nacer con la fecha del tecleo: el bug de vuelta, y en silencio.
    for (const malo of ["", "  ", "14/08/2026", "2026-13-01", "hoy", null, undefined, 20260814]) {
      expect(fechaIngresoAInstante(malo)).toBeNull();
    }
  });

  it("acepta la fecha con espacios alrededor (lo que llega de un copy/paste)", () => {
    expect(fechaIngresoAInstante(" 2026-08-14 ")?.toISOString()).toBe("2026-08-14T06:00:00.000Z");
  });
});
