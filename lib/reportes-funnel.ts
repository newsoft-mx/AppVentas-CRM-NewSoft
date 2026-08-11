/**
 * Helpers compartidos de los reportes de Funnel/Conversión (deal-based).
 * Periodo (semana/mes/semestre) + scope por vendedor (VENDEDOR = lo suyo;
 * ADMIN/GERENTE = todos, o un vendedor puntual si lo eligen).
 */
import type { SessionPayload } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { hoyEnTZ, limiteDiaNegocio } from "@/lib/tz";
import { normalizarPreset, rangoDePreset } from "@/lib/rangos-reporte";

// Solo ADMIN/GERENTE pueden elegir ver un vendedor puntual o el agregado.
export function puedeElegirVendedor(session: SessionPayload | null): boolean {
  return session?.rol === "ADMIN" || session?.rol === "GERENTE_COMERCIAL";
}

/**
 * Rango de fechas del reporte. `desde`/`hasta` explícitos (YYYY-MM-DD) tienen prioridad; si
 * no vienen, se resuelve el preset con el MISMO motor que usa la pantalla (lib/rangos-reporte)
 * y se cierra con los mismos límites de día.
 *
 * Antes este camino tenía su propia definición de "mes" —rodante y con `hasta` abierto—, así
 * que `?periodo=mes` y `?desde=…&hasta=…` devolvían cosas distintas para el mismo período.
 * Eran dos verdades sobre la misma pregunta; ahora hay una.
 */
export function rangoFechas(
  sp: URLSearchParams,
  ahora: Date
): { desde: Date; hasta: Date | null } {
  const desdeStr = sp.get("desde");
  if (desdeStr) {
    // Límites de día en la TZ del negocio (no la del server/UTC). Bloque B.
    const desde = limiteDiaNegocio(desdeStr, "inicio");
    if (desde) {
      const hastaStr = sp.get("hasta");
      const hasta = hastaStr ? limiteDiaNegocio(hastaStr, "fin") : null;
      return { desde, hasta };
    }
  }
  const preset = normalizarPreset(sp.get("periodo"));
  const r = rangoDePreset(preset, hoyEnTZ(ahora));
  // `custom` sin fechas es el único caso sin rango; acá cae al default del negocio.
  const actual = r?.actual ?? rangoDePreset("mes", hoyEnTZ(ahora))!.actual;
  return {
    desde: limiteDiaNegocio(actual.desde, "inicio") ?? ahora,
    hasta: limiteDiaNegocio(actual.hasta, "fin"),
  };
}

// Filtro Prisma de rango sobre un campo de fecha.
export function filtroRango(r: { desde: Date; hasta: Date | null }) {
  return r.hasta ? { gte: r.desde, lte: r.hasta } : { gte: r.desde };
}

type WhereInput = Record<string, unknown>;

// where de deals para reportes: scope por rol + filtro opcional de vendedor.
//
// Alcance HISTORICO: un deal cerrado (ganado o perdido) sigue contando aunque después lo
// borren. Borrar saca al deal de la operación, no del pasado — si no, borrar un perdido le
// cambiaba la tasa de cierre a un mes que ya estaba cerrado. Es el único punto por donde
// pasan los cuatro reportes de deals (funnel, resultados, anatomía, métricas), así que la
// regla se fija acá y ninguna ruta la re-implementa.
export function dealWhereReporte(
  session: SessionPayload | null,
  vendedorParam: string | null,
  extra: WhereInput = {}
): WhereInput {
  const base: WhereInput = { ...extra };
  if (puedeElegirVendedor(session) && vendedorParam) base.vendedor_id = vendedorParam;
  return scopeDealWhere(session, base, { alcance: "HISTORICO" });
}
