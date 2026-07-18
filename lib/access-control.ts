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

/**
 * Scope de deals: el VENDEDOR solo ve los suyos (ADMIN/GERENTE/ADMINISTRATIVO ven todos y
 * filtran con el dropdown), y **nadie ve los borrados**.
 *
 * El filtro de borrados vive acá y no en cada query a propósito: son ~15 lugares (pipeline,
 * Próximas Acciones, reportes, funnel, scoring, health) y alcanza con olvidarse de UNO para
 * que un lead borrado siga sumando en un reporte. Todo el acceso a deals ya pasa por esta
 * función, así que ponerlo acá lo hace imposible de saltear por descuido.
 *
 * Para verlos hay que pedirlos explícitamente (incluirEliminados) — hoy solo el filtro
 * "Eliminados" del pipeline, que es de ADMIN.
 */
export function scopeDealWhere(
  session: SessionPayload | null,
  where: WhereInput = {},
  opts: { incluirEliminados?: boolean } = {}
): WhereInput {
  if (!session) return { id: "__no-session__" };
  const base = opts.incluirEliminados ? where : andWhere(where, { eliminada: false });
  if (session.rol === "VENDEDOR") {
    return andWhere(base, { vendedor_id: session.vendedorId ?? "__sin-vendedor-asignado__" });
  }
  return base;
}

// Scope de clientes "por vendedor en sesión": el VENDEDOR solo ve clientes con
// órdenes o deals suyos; ADMIN/GERENTE/ADMINISTRATIVO ven todos.
export function scopeClienteWhere(session: SessionPayload | null, where: WhereInput = {}): WhereInput {
  if (!session) return { id: "__no-session__" };
  if (session.rol === "VENDEDOR") {
    const propios: WhereInput = session.vendedorId
      ? {
          OR: [
            { ordenes: { some: { vendedor_id: session.vendedorId } } },
            { deals: { some: { vendedor_id: session.vendedorId } } },
          ],
        }
      : { id: { in: [] } };
    return andWhere(where, propios);
  }
  return where;
}
