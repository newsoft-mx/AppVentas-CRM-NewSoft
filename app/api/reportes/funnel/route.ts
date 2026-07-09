import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { rangoFechas, filtroRango, dealWhereReporte } from "@/lib/reportes-funnel";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── GET /api/reportes/funnel?periodo=&vendedor= ─────────────────
// Embudo de conversión: de los deals creados en el periodo, cuántos
// alcanzaron cada etapa (usa el historial DealStageEvent) + tasa etapa→etapa.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const where = dealWhereReporte(session, sp.get("vendedor"), {
    created_at: filtroRango(rangoFechas(sp, new Date())),
  });

  try {
    const [stages, deals] = await Promise.all([
      prisma.pipelineStage.findMany({
        where: { activo: true },
        orderBy: { orden: "asc" },
        select: { id: true, nombre: true, orden: true },
      }),
      prisma.deal.findMany({
        where: where as Prisma.DealWhereInput,
        select: {
          id: true,
          stage_id: true,
          resultado: true,
          valor: true,
          stage_events: { select: { to_stage_id: true } },
        },
      }),
    ]);

    const ordenDe = new Map(stages.map((s) => [s.id, s.orden]));
    const alcanzo = stages.map(() => 0);

    for (const d of deals) {
      // Etapa más lejana alcanzada: eventos de historial + fallback al stage
      // actual (deals previos a DealStageEvent, sin historial retroactivo).
      let maxOrden = ordenDe.get(d.stage_id) ?? 1;
      for (const e of d.stage_events) {
        const o = ordenDe.get(e.to_stage_id);
        if (o && o > maxOrden) maxOrden = o;
      }
      stages.forEach((s, i) => {
        if (maxOrden >= s.orden) alcanzo[i]++;
      });
    }

    const total = deals.length;
    const ganados = deals.filter((d) => d.resultado === "GANADO").length;
    const perdidos = deals.filter((d) => d.resultado === "PERDIDO").length;
    const valor_total = deals.reduce((s, d) => s + Number(d.valor), 0);

    const etapas = stages.map((s, i) => {
      const count = alcanzo[i];
      const prev = i === 0 ? total : alcanzo[i - 1];
      return {
        stage_id: s.id,
        nombre: s.nombre,
        orden: s.orden,
        count,
        // % que pasó desde la etapa anterior (desde el total en la primera)
        conversion: prev > 0 ? Math.round((count / prev) * 100) : 0,
      };
    });

    return NextResponse.json({
      total,
      etapas,
      ganados,
      perdidos,
      valor_total,
      tasa_cierre: total > 0 ? Math.round((ganados / total) * 100) : 0,
    });
  } catch (error) {
    logger.error("Error al calcular el embudo", "GET /api/reportes/funnel", error);
    return NextResponse.json({ error: "Error al calcular el embudo" }, { status: 500 });
  }
}
