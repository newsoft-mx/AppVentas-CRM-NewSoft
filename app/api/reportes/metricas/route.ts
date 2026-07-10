import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { rangoFechas, filtroRango, dealWhereReporte } from "@/lib/reportes-funnel";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { metricasPipeline } from "@/lib/pipeline-metrics";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── GET /api/reportes/metricas?periodo=&desde=&hasta=&vendedor= ──
// Métricas de salud del pipeline (SOL-19) para el reporte de funnel: valor
// activo, deals activos, calientes y promedio — calculadas con la MISMA función
// (metricasPipeline) que alimenta el encabezado del pipeline, sobre los deals
// del período/vendedor. La temperatura se deriva del score (SSOT dealScoreView).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const where = dealWhereReporte(session, sp.get("vendedor"), {
    created_at: filtroRango(rangoFechas(sp, new Date())),
  });

  try {
    const deals = await prisma.deal.findMany({
      where: where as Prisma.DealWhereInput,
      select: { id: true, valor: true, resultado: true, ajuste_manual: true, stage_id: true, created_at: true },
    });

    const ctx = await getScoringContext();
    const acts = await prisma.dealActividad.findMany({
      where: { deal_id: { in: deals.map((d) => d.id) }, eliminada: false },
      select: { deal_id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
    });
    const actsByDeal = new Map<string, typeof acts>();
    for (const a of acts) actsByDeal.set(a.deal_id, [...(actsByDeal.get(a.deal_id) ?? []), a]);

    const ahora = new Date();
    const dealsMetrica = deals.map((d) => {
      const view = dealScoreView(
        ctx,
        {
          ajuste_manual: d.ajuste_manual,
          stage_id: d.stage_id,
          created_at: d.created_at,
          actividades: actsByDeal.get(d.id) ?? [],
        },
        ahora
      );
      return { valor: Number(d.valor), resultado: d.resultado, temperatura: view.temperatura };
    });

    return NextResponse.json(metricasPipeline(dealsMetrica));
  } catch (error) {
    logger.error("Error al calcular las métricas", "GET /api/reportes/metricas", error);
    return NextResponse.json({ error: "Error al calcular las métricas" }, { status: 500 });
  }
}
