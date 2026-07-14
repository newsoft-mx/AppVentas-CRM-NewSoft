/**
 * Helpers compartidos de los reportes de Funnel/Conversión (deal-based).
 * Periodo (semana/mes/semestre) + scope por vendedor (VENDEDOR = lo suyo;
 * ADMIN/GERENTE = todos, o un vendedor puntual si lo eligen).
 */
import type { SessionPayload } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { limiteDiaNegocio } from "@/lib/tz";

export type Periodo = "semana" | "mes" | "semestre";
const PERIODOS: Periodo[] = ["semana", "mes", "semestre"];

export function normalizarPeriodo(v: string | null): Periodo {
  return PERIODOS.includes(v as Periodo) ? (v as Periodo) : "mes";
}

// Fecha "desde" del periodo (hasta = ahora).
export function desdePeriodo(periodo: Periodo, ahora: Date): Date {
  const d = new Date(ahora);
  if (periodo === "semana") d.setDate(d.getDate() - 7);
  else if (periodo === "semestre") d.setMonth(d.getMonth() - 6);
  else d.setMonth(d.getMonth() - 1); // mes
  return d;
}

// Solo ADMIN/GERENTE pueden elegir ver un vendedor puntual o el agregado.
export function puedeElegirVendedor(session: SessionPayload | null): boolean {
  return session?.rol === "ADMIN" || session?.rol === "GERENTE_COMERCIAL";
}

// Rango de fechas del reporte: rango personalizado (desde/hasta, formato YYYY-MM-DD)
// tiene prioridad; si no, cae al preset de periodo. hasta = null → abierto hasta ahora.
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
  return { desde: desdePeriodo(normalizarPeriodo(sp.get("periodo")), ahora), hasta: null };
}

// Filtro Prisma de rango sobre un campo de fecha.
export function filtroRango(r: { desde: Date; hasta: Date | null }) {
  return r.hasta ? { gte: r.desde, lte: r.hasta } : { gte: r.desde };
}

type WhereInput = Record<string, unknown>;

// where de deals para reportes: scope por rol + filtro opcional de vendedor.
export function dealWhereReporte(
  session: SessionPayload | null,
  vendedorParam: string | null,
  extra: WhereInput = {}
): WhereInput {
  const base: WhereInput = { ...extra };
  if (puedeElegirVendedor(session) && vendedorParam) base.vendedor_id = vendedorParam;
  return scopeDealWhere(session, base);
}
