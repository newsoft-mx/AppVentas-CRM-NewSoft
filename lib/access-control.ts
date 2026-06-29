import type { SessionPayload } from "@/lib/session";

type WhereInput = Record<string, unknown>;

function andWhere(where: WhereInput, extra: WhereInput): WhereInput {
  if (!Object.keys(where).length) return extra;
  return { AND: [where, extra] };
}

export function scopeOrdenWhere(session: SessionPayload | null, where: WhereInput = {}): WhereInput {
  if (!session) return { id: "__no-session__" };

  if (session.rol === "VENDEDOR") {
    return andWhere(where, { vendedor_id: session.vendedorId ?? "__sin-vendedor-asignado__" });
  }

  if (session.rol === "ADMINISTRATIVO") {
    return andWhere(where, { estatus: "VENTA" });
  }

  return where;
}

export function canAccessOrden(session: SessionPayload | null, orden: { vendedor_id: string | null; estatus: string }) {
  if (!session) return false;
  if (session.rol === "ADMIN" || session.rol === "GERENTE_COMERCIAL") return true;
  if (session.rol === "ADMINISTRATIVO") return orden.estatus === "VENTA";
  return Boolean(session.vendedorId && orden.vendedor_id === session.vendedorId);
}

export function canMutateOrden(session: SessionPayload | null, orden?: { vendedor_id: string | null }) {
  if (!session) return false;
  if (session.rol === "ADMIN" || session.rol === "GERENTE_COMERCIAL") return true;
  if (session.rol === "VENDEDOR") {
    if (!session.vendedorId) return false;
    return orden ? orden.vendedor_id === session.vendedorId : true;
  }
  return false;
}

export function assignedVendedorId(session: SessionPayload, requestedVendedorId: string) {
  return session.rol === "VENDEDOR" ? session.vendedorId : requestedVendedorId;
}

// Scope de deals "por vendedor en sesión": el VENDEDOR solo ve los suyos;
// ADMIN/GERENTE/ADMINISTRATIVO ven todos (filtran con el dropdown de la UI).
export function scopeDealWhere(session: SessionPayload | null, where: WhereInput = {}): WhereInput {
  if (!session) return { id: "__no-session__" };
  if (session.rol === "VENDEDOR") {
    return andWhere(where, { vendedor_id: session.vendedorId ?? "__sin-vendedor-asignado__" });
  }
  return where;
}
