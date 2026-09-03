import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { rangoFechas, filtroRango, dealWhereReporte } from "@/lib/reportes-funnel";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ── GET /api/reportes/funnel?periodo=&vendedor= ─────────────────
// Embudo de conversión: de los leads que INGRESARON en el periodo, cuántos
// alcanzaron cada etapa (usa el historial DealStageEvent) + tasa etapa→etapa.
//
// El corte es por fecha_ingreso (cuándo llegó el lead), no por created_at (cuándo se tecleó
// el registro). Con leads cargados a mano en lote son días distintos, y filtrando por el
// tecleo el reporte contaba el lead del viernes dentro de la semana siguiente: los números
// del embudo no cerraban contra el mismo período visto en el pipeline.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rango = rangoFechas(sp, new Date());
  const where = dealWhereReporte(session, sp.get("vendedor"), {
    fecha_ingreso: filtroRango(rango),
  });
  // Pausados EN el período: corta por cuándo se pausó (fecha_suspension), no por cuándo
  // ingresó el lead — es la pregunta "¿cuántos pausamos este mes?" (reunión 2026-09-02).
  const wherePausados = dealWhereReporte(session, sp.get("vendedor"), {
    resultado: "SUSPENDIDO",
    fecha_suspension: filtroRango(rango),
  });

  try {
    const [stages, deals, pausados_en_periodo] = await Promise.all([
      prisma.pipelineStage.findMany({
        where: { activo: true },
        orderBy: { orden: "asc" },
        select: { id: true, nombre: true, orden: true, color: true },
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
      prisma.deal.count({ where: wherePausados as Prisma.DealWhereInput }),
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
    // Desglose del total por estado ACTUAL: la suma da exactamente `total`, así el
    // encabezado del embudo explica de dónde sale el número (antes 14+13 ≠ 31 y nadie
    // sabía dónde estaban los otros — eran los pausados/ganados sin desglosar).
    const desglose = {
      activos: deals.filter((d) => d.resultado === "ABIERTO").length,
      ganados,
      perdidos,
      pausados: deals.filter((d) => d.resultado === "SUSPENDIDO").length,
    };
    const valor_total = deals.reduce((s, d) => s + Number(d.valor), 0);

    const etapas = stages.map((s, i) => {
      const count = alcanzo[i];
      const prev = i === 0 ? total : alcanzo[i - 1];
      return {
        stage_id: s.id,
        nombre: s.nombre,
        orden: s.orden,
        color: s.color,
        count,
        // % que pasó desde la etapa anterior (desde el total en la primera)
        conversion: prev > 0 ? Math.round((count / prev) * 100) : 0,
      };
    });

    return NextResponse.json({
      total,
      desglose,
      pausados_en_periodo,
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
