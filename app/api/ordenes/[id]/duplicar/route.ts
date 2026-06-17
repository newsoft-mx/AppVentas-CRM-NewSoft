import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularOrden, generarFolio } from "@/lib/utils";
import { serializeOrden } from "@/lib/serializers";
import Decimal from "decimal.js";
import { canWrite, requireAuth } from "@/lib/session";
import { canMutateOrden } from "@/lib/access-control";
import { logger } from "@/lib/logger";

// ── POST /api/ordenes/:id/duplicar ────────────────────────────
// Crea una copia exacta de la orden con:
//   - Nuevo folio autogenerado
//   - estatus = BORRADOR
//   - fecha_venta = null
//   - duplicada_de_id → apunta a la orden original
//   - Todas las partidas copiadas

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    // 1. Buscar la orden original con sus partidas
    const original = await prisma.ordenVenta.findUnique({
      where: { id },
      include: {
        partidas: { orderBy: { orden_display: "asc" } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canMutateOrden(session, original)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // 2. Recalcular los montos (los copiamos del original, pero recalculamos
    //    por seguridad en caso de que las partidas hayan cambiado)
    const calculo = calcularOrden({
      partidas: original.partidas.map((p) => ({
        cantidad: p.cantidad.toString(),
        precio_unitario: p.precio_unitario.toString(),
      })),
      descuento_porcentaje: original.descuento_porcentaje?.toString(),
      aplica_iva: original.aplica_iva,
      tasa_iva: original.tasa_iva?.toString(),
      moneda: original.moneda,
      tipo_cambio: original.tipo_cambio?.toString(),
    });

    // 3. Transacción: generar folio + crear orden duplicada + copiar partidas
    const nuevaOrden = await prisma.$transaction(async (tx) => {
      // Leer empresa para el consecutivo de folio
      const empresa = await tx.empresa.findFirst();
      if (!empresa) throw new Error("Empresa no configurada");

      const folio = generarFolio(empresa.prefijo_folio, empresa.siguiente_folio);

      // Incrementar el consecutivo
      await tx.empresa.update({
        where: { id: empresa.id },
        data: { siguiente_folio: empresa.siguiente_folio + 1 },
      });

      // Crear la orden duplicada
      const copia = await tx.ordenVenta.create({
        data: {
          folio,
          cliente_id: original.cliente_id,
          tipo_cotizacion_id: original.tipo_cotizacion_id,
          condicion_pago_id: original.condicion_pago_id,
          vendedor_id: session.rol === "VENDEDOR" ? session.vendedorId : original.vendedor_id,
          descripcion: original.descripcion,
          // Siempre inicia como BORRADOR
          estatus: "BORRADOR",
          moneda: original.moneda,
          tipo_cambio: original.tipo_cambio ?? null,
          // fecha_venta vacía en la copia
          fecha_venta: null,
          vigencia: original.vigencia ?? null,
          aplica_iva: original.aplica_iva,
          tasa_iva: original.tasa_iva ?? null,
          descuento_porcentaje: original.descuento_porcentaje ?? null,
          descuento_descripcion: original.descuento_descripcion ?? null,
          notas: original.notas ?? null,
          // Referencia a la orden original
          duplicada_de_id: original.id,
          // Montos recalculados
          subtotal: calculo.subtotal,
          monto_descuento: calculo.monto_descuento,
          subtotal_con_descuento: calculo.subtotal_con_descuento,
          monto_iva: calculo.monto_iva,
          total: calculo.total,
          total_mxn: calculo.total_mxn,
        },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              rfc: true,
              contacto: true,
              email: true,
              ciudad: true,
            },
          },
          tipo_cotizacion: { select: { id: true, nombre: true } },
          condicion_pago: { select: { id: true, nombre: true } },
          vendedor: { select: { id: true, nombre: true } },
        },
      });

      // Copiar todas las partidas de la orden original
      await tx.partida.createMany({
        data: original.partidas.map((p) => ({
          orden_id: copia.id,
          descripcion: p.descripcion,
          cantidad: new Decimal(p.cantidad.toString()),
          precio_unitario: new Decimal(p.precio_unitario.toString()),
          total_partida: new Decimal(p.total_partida.toString()),
          orden_display: p.orden_display,
        })),
      });

      // Recuperar con partidas para devolver completo
      const partidas = await tx.partida.findMany({
        where: { orden_id: copia.id },
        orderBy: { orden_display: "asc" },
      });

      return { ...copia, partidas };
    });

    return NextResponse.json(serializeOrden(nuevaOrden), { status: 201 });
  } catch (err) {
    logger.error("Error al duplicar orden", "POST /api/ordenes/:id/duplicar", err);
    return NextResponse.json({ error: "Error al duplicar la orden" }, { status: 500 });
  }
}
