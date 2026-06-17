export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PipelineData } from "@/types/reportes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmountMxn } from "@/lib/net-amounts";
import { buildDateOrFilters, getAllParam, parseNumberList } from "@/lib/filter-utils";

// ── GET /api/reportes/pipeline ────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ano = parseNumberList(getAllParam(sp, "ano"));
  const q = parseNumberList(getAllParam(sp, "q")).filter((value) => value >= 1 && value <= 4);
  const mes = parseNumberList(getAllParam(sp, "mes")).filter((value) => value >= 1 && value <= 12);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (ano.length || q.length || mes.length) {
    where.OR = buildDateOrFilters({ ano, q, mes }).flatMap((range) => [
      { fecha_venta: range },
      { estatus: { not: "VENTA" }, fecha_venta: null, created_at: range },
    ]);
  }

  try {
    const ordenes = await prisma.ordenVenta.findMany({
      where: scopeOrdenWhere(session, where),
      select: { estatus: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
    });

    const borradores_count = ordenes.filter((o) => o.estatus === "BORRADOR").length;
    const cotizaciones_count = ordenes.filter((o) => o.estatus === "COTIZADO").length;
    const ventas_count = ordenes.filter((o) => o.estatus === "VENTA").length;

    const cotizaciones_mxn = ordenes
      .filter((o) => o.estatus === "COTIZADO")
      .reduce((s, o) => s + netAmountMxn(o), 0);

    const ventas_mxn = ordenes
      .filter((o) => o.estatus === "VENTA")
      .reduce((s, o) => s + netAmountMxn(o), 0);

    const result: PipelineData = {
      borradores_count,
      cotizaciones_count,
      ventas_count,
      cotizaciones_mxn,
      ventas_mxn,
      total_ordenes: ordenes.length,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener pipeline" }, { status: 500 });
  }
}
