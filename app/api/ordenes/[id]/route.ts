export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularOrden, transicionOrdenPermitida } from "@/lib/utils";
import { serializeOrden } from "@/lib/serializers";
import { OrdenUpdateSchema } from "@/lib/validations/ordenes";
import type { ZodIssue } from "zod";
import Decimal from "decimal.js";
import { canWrite, requireAuth } from "@/lib/session";
import { canAccessOrden, canMutateOrden } from "@/lib/access-control";
import { logger } from "@/lib/logger";

// ── GET /api/ordenes/:id ──────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const orden = await prisma.ordenVenta.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true, rfc: true, contacto: true, email: true, ciudad: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        condicion_pago: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        partidas: { orderBy: { orden_display: "asc" } },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canAccessOrden(session, orden)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    return NextResponse.json(serializeOrden(orden));
  } catch {
    return NextResponse.json({ error: "Error al obtener la orden" }, { status: 500 });
  }
}

// ── PUT /api/ordenes/:id ──────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = OrdenUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.errors.map((e: ZodIssue) => ({
      campo: e.path.join("."),
      mensaje: e.message,
    }));
    return NextResponse.json({ error: "Datos inválidos", details }, { status: 422 });
  }

  const data = parsed.data;

  try {
    // Verificar que la orden exista
    const ordenExistente = await prisma.ordenVenta.findUnique({
      where: { id },
      include: { partidas: true },
    });

    if (!ordenExistente) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canMutateOrden(session, ordenExistente)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Máquina de estados (Bloque F): el PUT general también valida la transición,
    // para que no haya una puerta paralela que evite la de /estatus.
    if (data.estatus && data.estatus !== ordenExistente.estatus) {
      if (!transicionOrdenPermitida(ordenExistente.estatus, data.estatus)) {
        return NextResponse.json(
          { error: `Transición no permitida: ${ordenExistente.estatus} → ${data.estatus}`, campo: "estatus" },
          { status: 409 }
        );
      }
      const fechaVentaFinal = data.fecha_venta ?? ordenExistente.fecha_venta;
      if (data.estatus === "VENTA" && !fechaVentaFinal) {
        return NextResponse.json(
          { error: "Se requiere la fecha de venta al confirmar como VENTA", campo: "fecha_venta" },
          { status: 422 }
        );
      }
    }

    if (session.rol === "VENDEDOR") {
      data.vendedor_id = session.vendedorId ?? undefined;
    }

    if (data.vendedor_id) {
      const vendedor = await prisma.vendedor.findFirst({
        where: { id: data.vendedor_id, activo: true },
      });
      if (!vendedor) {
        return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
      }
    }

    // Determinar partidas a usar para calcular
    const partidasParaCalculo = data.partidas ?? ordenExistente.partidas.map((p) => ({
      cantidad: p.cantidad.toNumber(),
      precio_unitario: p.precio_unitario.toNumber(),
      descripcion: p.descripcion,
      orden_display: p.orden_display,
    }));

    // Calcular con los nuevos datos (mezclando actuales + nuevos)
    const calculo = calcularOrden({
      partidas: partidasParaCalculo,
      descuento_porcentaje: data.descuento_porcentaje ?? ordenExistente.descuento_porcentaje?.toNumber(),
      aplica_iva: data.aplica_iva ?? ordenExistente.aplica_iva,
      tasa_iva: data.tasa_iva ?? ordenExistente.tasa_iva?.toNumber(),
      moneda: data.moneda ?? ordenExistente.moneda,
      tipo_cambio: data.tipo_cambio ?? ordenExistente.tipo_cambio?.toNumber(),
    });

    const orden = await prisma.$transaction(async (tx) => {
      // Actualizar partidas si se enviaron
      if (data.partidas) {
        await tx.partida.deleteMany({ where: { orden_id: id } });
        await tx.partida.createMany({
          data: data.partidas.map((p) => ({
            orden_id: id,
            descripcion: p.descripcion,
            cantidad: new Decimal(p.cantidad),
            precio_unitario: new Decimal(p.precio_unitario),
            total_partida: new Decimal(p.cantidad).times(new Decimal(p.precio_unitario)).toDecimalPlaces(2),
            orden_display: p.orden_display,
          })),
        });
      }

      // Actualizar la orden
      const actualizada = await tx.ordenVenta.update({
        where: { id },
        data: {
          ...(data.cliente_id && { cliente_id: data.cliente_id }),
          ...(data.tipo_cotizacion_id && { tipo_cotizacion_id: data.tipo_cotizacion_id }),
          ...(data.condicion_pago_id && { condicion_pago_id: data.condicion_pago_id }),
          ...(data.vendedor_id !== undefined && { vendedor_id: data.vendedor_id }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
          ...(data.estatus && { estatus: data.estatus }),
          ...(data.moneda && { moneda: data.moneda }),
          tipo_cambio: data.tipo_cambio !== undefined
            ? (data.tipo_cambio ? new Decimal(data.tipo_cambio) : null)
            : undefined,
          fecha_venta: data.fecha_venta !== undefined
            ? (data.fecha_venta ? new Date(data.fecha_venta) : null)
            : undefined,
          ...(data.vigencia !== undefined && {
            vigencia: data.vigencia ? new Date(data.vigencia) : null,
          }),
          ...(data.aplica_iva !== undefined && { aplica_iva: data.aplica_iva }),
          tasa_iva: data.tasa_iva !== undefined
            ? (data.tasa_iva ? new Decimal(data.tasa_iva) : null)
            : undefined,
          descuento_porcentaje: data.descuento_porcentaje !== undefined
            ? (data.descuento_porcentaje ? new Decimal(data.descuento_porcentaje) : null)
            : undefined,
          ...(data.descuento_descripcion !== undefined && { descuento_descripcion: data.descuento_descripcion ?? null }),
          ...(data.notas !== undefined && { notas: data.notas ?? null }),
          subtotal: calculo.subtotal,
          monto_descuento: calculo.monto_descuento,
          subtotal_con_descuento: calculo.subtotal_con_descuento,
          monto_iva: calculo.monto_iva,
          total: calculo.total,
          total_mxn: calculo.total_mxn,
        },
        include: {
          cliente: { select: { id: true, nombre: true, rfc: true, contacto: true, email: true, ciudad: true } },
          tipo_cotizacion: { select: { id: true, nombre: true } },
          condicion_pago: { select: { id: true, nombre: true } },
          vendedor: { select: { id: true, nombre: true } },
        },
      });

      const partidas = await tx.partida.findMany({
        where: { orden_id: id },
        orderBy: { orden_display: "asc" },
      });

      return { ...actualizada, partidas };
    });

    return NextResponse.json(serializeOrden(orden));
  } catch (err) {
    logger.error("Error al actualizar orden", "PUT /api/ordenes/:id", err);
    return NextResponse.json({ error: "Error al actualizar la orden" }, { status: 500 });
  }
}

// ── DELETE /api/ordenes/:id ───────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const orden = await prisma.ordenVenta.findUnique({
      where: { id },
      select: { estatus: true, folio: true, vendedor_id: true },
    });

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canMutateOrden(session, orden)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    // Invariante financiero (Bloque F): una orden VENTA/COTIZADO es un registro
    // auditable; NO se borra en duro. Solo los BORRADOR se eliminan; el resto se
    // "archiva" cambiando su estatus por la máquina de estados.
    if (orden.estatus !== "BORRADOR") {
      return NextResponse.json(
        {
          error:
            `Solo se pueden eliminar órdenes en BORRADOR. ` +
            `Una orden ${orden.estatus} no se borra: cambiá su estatus.`,
        },
        { status: 409 }
      );
    }

    // Cascade delete (partidas se eliminan por FK constraint)
    await prisma.ordenVenta.delete({ where: { id } });

    return NextResponse.json({ ok: true, folio: orden.folio });
  } catch (err) {
    logger.error("Error al eliminar la orden", "DELETE /api/ordenes/:id", err);
    return NextResponse.json({ error: "Error al eliminar la orden" }, { status: 500 });
  }
}
