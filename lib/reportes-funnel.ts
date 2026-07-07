/**
 * Helpers compartidos de los reportes de Funnel/Conversión (deal-based).
 * Periodo (semana/mes/semestre) + scope por vendedor (VENDEDOR = lo suyo;
 * ADMIN/GERENTE = todos, o un vendedor puntual si lo eligen).
 */
import type { SessionPayload } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";

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
