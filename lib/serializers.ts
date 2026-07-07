/**
 * Serializers: convierten objetos de Prisma (con Decimal/Date) a
 * objetos JSON-safe para pasar de Server Components a Client Components.
 */

import type {
  Empresa as PrismaEmpresa,
  TipoCotizacion as PrismaTipo,
  CondicionComercial as PrismaCondicion,
  Vendedor as PrismaVendedor,
  User as PrismaUser,
  OrdenVenta as PrismaOrden,
  Partida as PrismaPartida,
  Cliente as PrismaCliente,
} from "@prisma/client";

export function serializeEmpresa(e: PrismaEmpresa) {
  return {
    ...e,
    tasa_iva: e.tasa_iva.toNumber(),
    created_at: e.created_at.toISOString(),
    updated_at: e.updated_at.toISOString(),
  };
}

export function serializeTipo(t: PrismaTipo) {
  return {
    ...t,
    texto_contrato:
      (t as PrismaTipo & { texto_contrato?: string | null }).texto_contrato ??
      null,
    created_at: t.created_at.toISOString(),
  };
}

export function serializeCondicion(c: PrismaCondicion) {
  return {
    ...c,
    created_at: c.created_at.toISOString(),
  };
}

export function serializeVendedor(v: PrismaVendedor) {
  return {
    ...v,
    created_at: v.created_at.toISOString(),
    updated_at: v.updated_at.toISOString(),
  };
}

export function serializeUsuario(u: Pick<PrismaUser, "id" | "nombre" | "email" | "activo" | "rol" | "vendedor_id" | "created_at" | "updated_at">) {
  return {
    ...u,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
  };
}

// ── Órdenes ───────────────────────────────────────────────────

export function serializePartida(p: PrismaPartida) {
  return {
    ...p,
    cantidad: p.cantidad.toNumber(),
    precio_unitario: p.precio_unitario.toNumber(),
    total_partida: p.total_partida.toNumber(),
    created_at: p.created_at.toISOString(),
  };
}

type OrdenConRelaciones = PrismaOrden & {
  partidas?: PrismaPartida[];
  cliente: Pick<PrismaCliente, "id" | "nombre" | "rfc" | "contacto" | "email" | "ciudad">;
  tipo_cotizacion: { id: string; nombre: string };
  condicion_pago: { id: string; nombre: string };
  vendedor?: { id: string; nombre: string } | null;
};

export function serializeOrden(o: OrdenConRelaciones) {
  return {
    ...o,
    tipo_cambio: o.tipo_cambio ? o.tipo_cambio.toNumber() : null,
    tasa_iva: o.tasa_iva ? o.tasa_iva.toNumber() : null,
    descuento_porcentaje: o.descuento_porcentaje
      ? o.descuento_porcentaje.toNumber()
      : null,
    subtotal: o.subtotal.toNumber(),
    monto_descuento: o.monto_descuento.toNumber(),
    subtotal_con_descuento: o.subtotal_con_descuento.toNumber(),
    monto_iva: o.monto_iva.toNumber(),
    total: o.total.toNumber(),
    total_mxn: o.total_mxn.toNumber(),
    fecha_venta: o.fecha_venta ? o.fecha_venta.toISOString() : null,
    vigencia: o.vigencia ? o.vigencia.toISOString() : null,
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
    partidas: o.partidas ? o.partidas.map(serializePartida) : [],
  };
}
