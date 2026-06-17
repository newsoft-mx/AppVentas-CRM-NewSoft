export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { KpisData } from "@/types/ordenes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";
import {
  buildDateOrFilters,
  getAllParam,
  parseNumberList,
  parseStringList,
} from "@/lib/filter-utils";

function buildWhere(filtros: {
  ano: number[];
  q: number[];
  mes: number[];
  cliente_id: string[];
  tipo_cotizacion_id: string[];
  vendedor_id: string[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

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

// ── GET /api/ordenes/kpis ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filtros = {
    ano: parseNumberList(getAllParam(searchParams, "ano")).filter((value) => value >= 2020 && value <= 2099),
    q: parseNumberList(getAllParam(searchParams, "q")).filter((value) => value >= 1 && value <= 4),
    mes: parseNumberList(getAllParam(searchParams, "mes")).filter((value) => value >= 1 && value <= 12),
    cliente_id: parseStringList(getAllParam(searchParams, "cliente_id")),
    tipo_cotizacion_id: parseStringList(getAllParam(searchParams, "tipo_cotizacion_id")),
    vendedor_id: parseStringList(getAllParam(searchParams, "vendedor_id")),
  };

  try {
    const where = scopeOrdenWhere(session, buildWhere(filtros));

    const ordenes = await prisma.ordenVenta.findMany({
      where,
      select: {
        estatus: true,
        moneda: true,
        tipo_cambio: true,
        subtotal_con_descuento: true,
      },
    });

    const total_ordenes = ordenes.length;
    const borradores = ordenes.filter((o) => o.estatus === "BORRADOR").length;
    const cotizadas = ordenes.filter((o) => o.estatus === "COTIZADO").length;
    const ventas = ordenes.filter((o) => o.estatus === "VENTA").length;

    const ventas_mxn = ordenes
      .filter((o) => o.estatus === "VENTA")
      .reduce((s, o) => s + netAmountMxn(o), 0);

    const pipeline_mxn = ordenes
      .filter((o) => o.estatus === "COTIZADO")
      .reduce((s, o) => s + netAmountMxn(o), 0);

    // Fórmula correcta según doc funcional: ventas / total_ordenes * 100
    const tasa_conversion =
      total_ordenes > 0 ? Math.round((ventas / total_ordenes) * 100) : 0;

    const suma_total_mxn = ordenes
      .filter((o) => o.moneda === "MXN")
      .reduce((s, o) => s + netAmount(o), 0);

    const suma_total_usd = ordenes
      .filter((o) => o.moneda === "USD")
      .reduce((s, o) => s + netAmount(o), 0);

    const kpis: KpisData = {
      total_ordenes,
      borradores,
      cotizadas,
      ventas,
      ventas_mxn,
      pipeline_mxn,
      tasa_conversion,
      suma_total_mxn,
      suma_total_usd,
    };

    return NextResponse.json(kpis);
  } catch {
    return NextResponse.json({ error: "Error al calcular KPIs" }, { status: 500 });
  }
}
