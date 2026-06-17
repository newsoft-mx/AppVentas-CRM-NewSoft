export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularOrden, generarFolio } from "@/lib/utils";
import { serializeOrden } from "@/lib/serializers";
import { OrdenCreateSchema } from "@/lib/validations/ordenes";
import Decimal from "decimal.js";
import { canWrite, requireAuth } from "@/lib/session";
import { assignedVendedorId, scopeOrdenWhere } from "@/lib/access-control";
import { logger } from "@/lib/logger";
import {
  buildDateOrFilters,
  getAllParam,
  parseEstatusList,
  parseNumberList,
  parseStringList,
} from "@/lib/filter-utils";

// ── Helpers de filtro ─────────────────────────────────────────

function buildWhere(filtros: {
  ano: number[];
  q: number[];
  mes: number[];
  estatus: string[];
  cliente_id: string[];
  tipo_cotizacion_id: string[];
  vendedor_id: string[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filtros.estatus.length) where.estatus = { in: filtros.estatus };
  if (filtros.cliente_id.length) where.cliente_id = { in: filtros.cliente_id };
  if (filtros.tipo_cotizacion_id.length) where.tipo_cotizacion_id = { in: filtros.tipo_cotizacion_id };
  if (filtros.vendedor_id.length) where.vendedor_id = { in: filtros.vendedor_id };

  if (filtros.ano.length || filtros.q.length || filtros.mes.length) {
    where.OR = buildDateOrFilters(filtros).flatMap((range) => [
      { fecha_venta: range },
      { fecha_venta: null, created_at: range },
    ]);
  }

  return where;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ── GET /api/ordenes ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filtros = {
    ano: parseNumberList(getAllParam(searchParams, "ano")).filter((value) => value >= 2020 && value <= 2099),
    q: parseNumberList(getAllParam(searchParams, "q")).filter((value) => value >= 1 && value <= 4),
    mes: parseNumberList(getAllParam(searchParams, "mes")).filter((value) => value >= 1 && value <= 12),
    estatus: parseEstatusList(getAllParam(searchParams, "estatus")),
    cliente_id: parseStringList(getAllParam(searchParams, "cliente_id")),
    tipo_cotizacion_id: parseStringList(getAllParam(searchParams, "tipo_cotizacion_id")),
    vendedor_id: parseStringList(getAllParam(searchParams, "vendedor_id")),
  };

  try {
    const ordenes = await prisma.ordenVenta.findMany({
      where: scopeOrdenWhere(session, buildWhere(filtros)),
      include: {
        cliente: { select: { id: true, nombre: true, rfc: true, contacto: true, email: true, ciudad: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        condicion_pago: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const serialized = ordenes.map((o) => serializeOrden({ ...o, partidas: [] }));
    return NextResponse.json(serialized);
  } catch {
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 });
  }
}

// ── POST /api/ordenes ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = OrdenCreateSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.errors.map((e) => ({
      campo: e.path.join("."),
      mensaje: e.message,
    }));
    return NextResponse.json({ error: "Datos inválidos", details }, { status: 422 });
  }

  const data = parsed.data;
  const vendedorId = assignedVendedorId(session, data.vendedor_id);
  if (!vendedorId) {
    return NextResponse.json({ error: "Usuario sin vendedor asignado" }, { status: 403 });
  }

  try {
    // Verificar que cliente, tipo y condición existan y estén activos
    const [cliente, tipo, condicion, vendedor] = await Promise.all([
      prisma.cliente.findFirst({ where: { id: data.cliente_id, activo: true } }),
      prisma.tipoCotizacion.findFirst({ where: { id: data.tipo_cotizacion_id, activo: true } }),
      prisma.condicionComercial.findFirst({ where: { id: data.condicion_pago_id, activo: true } }),
      prisma.vendedor.findFirst({ where: { id: vendedorId, activo: true } }),
    ]);

    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    if (!tipo) return NextResponse.json({ error: "Tipo de cotización no encontrado" }, { status: 404 });
    if (!condicion) return NextResponse.json({ error: "Condición de pago no encontrada" }, { status: 404 });
    if (!vendedor) return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });

    // Calcular montos
    const calculo = calcularOrden({
      partidas: data.partidas,
      descuento_porcentaje: data.descuento_porcentaje,
      aplica_iva: data.aplica_iva,
      tasa_iva: data.tasa_iva,
      moneda: data.moneda,
      tipo_cambio: data.tipo_cambio,
    });

    // Transacción: folio + crear orden + crear partidas
    const orden = await prisma.$transaction(async (tx) => {
      // 1. Leer y bloquear empresa para consecutivo
      const empresa = await tx.empresa.findFirst();
      if (!empresa) throw new Error("Empresa no configurada");

      const folio = generarFolio(empresa.prefijo_folio, empresa.siguiente_folio);
      const vigencia = data.vigencia
        ? new Date(data.vigencia)
        : addDays(new Date(), empresa.vigencia_cotizacion_dias);

      // 2. Incrementar consecutivo
      await tx.empresa.update({
        where: { id: empresa.id },
        data: { siguiente_folio: empresa.siguiente_folio + 1 },
      });

      // 3. Crear la orden
      const nuevaOrden = await tx.ordenVenta.create({
        data: {
          folio,
          cliente_id: data.cliente_id,
          tipo_cotizacion_id: data.tipo_cotizacion_id,
          condicion_pago_id: data.condicion_pago_id,
          vendedor_id: vendedorId,
          descripcion: data.descripcion,
          estatus: data.estatus,
          moneda: data.moneda,
          tipo_cambio: data.tipo_cambio ? new Decimal(data.tipo_cambio) : null,
          fecha_venta: data.fecha_venta ? new Date(data.fecha_venta) : null,
          vigencia,
          aplica_iva: data.aplica_iva,
          tasa_iva: data.tasa_iva ? new Decimal(data.tasa_iva) : null,
          descuento_porcentaje: data.descuento_porcentaje
            ? new Decimal(data.descuento_porcentaje)
            : null,
          descuento_descripcion: data.descuento_descripcion ?? null,
          notas: data.notas ?? null,
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

      // 4. Crear partidas
      await tx.partida.createMany({
        data: data.partidas.map((p) => ({
          orden_id: nuevaOrden.id,
          descripcion: p.descripcion,
          cantidad: new Decimal(p.cantidad),
          precio_unitario: new Decimal(p.precio_unitario),
          total_partida: new Decimal(p.cantidad).times(new Decimal(p.precio_unitario)).toDecimalPlaces(2),
          orden_display: p.orden_display,
        })),
      });

      // Recuperar con partidas para devolver completo
      const partidas = await tx.partida.findMany({
        where: { orden_id: nuevaOrden.id },
        orderBy: { orden_display: "asc" },
      });

      return { ...nuevaOrden, partidas };
    });

    return NextResponse.json(serializeOrden(orden), { status: 201 });
  } catch (err) {
    logger.error("Error al crear orden", "POST /api/ordenes", err);
    return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
  }
}
