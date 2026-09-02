export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PipelineData } from "@/types/reportes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { sumaNetaMxn } from "@/lib/net-amounts";
import { getAllParam, parseNumberList, wherePeriodoOrden } from "@/lib/filter-utils";
import { calcularPipeline } from "@/lib/kpis";

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
    where.OR = wherePeriodoOrden({ ano, q, mes }, "fecha_efectiva_estricta");
  }

  try {
    const ordenes = await prisma.ordenVenta.findMany({
      where: scopeOrdenWhere(session, where),
      select: { estatus: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
    });

    const result: PipelineData = calcularPipeline(ordenes);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener pipeline" }, { status: 500 });
  }
}
