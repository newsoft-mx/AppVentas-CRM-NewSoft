export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { nivelDesdeScore } from "@/lib/scoring";

// GET /api/admin/audit-score — auditoría read-only del scoring.
// Recomputa el score de cada deal abierto con el MISMO adaptador que usa la app
// (dealScoreView) y reporta distribución + anomalías. No escribe nada.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const ahora = new Date();
  const ctx = await getScoringContext();
  const tiposIds = new Set(ctx.tipos.map((t) => t.id));
  const resIds = new Set(ctx.resultados.map((r) => r.id));

  const deals = await prisma.deal.findMany({
    where: { resultado: { in: ["ABIERTO", "SUSPENDIDO"] } },
    select: { id: true, nombre: true, ajuste_manual: true, stage_id: true, created_at: true },
  });
  const acts = await prisma.dealActividad.findMany({
    where: { deal_id: { in: deals.map((d) => d.id) }, eliminada: false },
    select: { deal_id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
  });
  const byDeal = new Map<string, typeof acts>();
  for (const a of acts) byDeal.set(a.deal_id, [...(byDeal.get(a.deal_id) ?? []), a]);

  const distribucion: Record<string, number> = { MUY_FRIO: 0, FRIO: 0, TIBIO: 0, CALIENTE: 0, MUY_CALIENTE: 0 };
  const candidatos_avance: { deal: string; score: number }[] = [];
  const referencias_huerfanas: { deal: string; campo: string; id: string }[] = [];

  for (const d of deals) {
    const actividades = byDeal.get(d.id) ?? [];
    const view = dealScoreView(ctx, { ajuste_manual: d.ajuste_manual, stage_id: d.stage_id, created_at: d.created_at, actividades }, ahora);
    distribucion[nivelDesdeScore(view.score, ctx.config.niveles_umbral)]++;
    if (view.cruzaAvance) candidatos_avance.push({ deal: d.nombre, score: view.score });
    for (const a of actividades) {
      if (a.tipo_accion_id && !tiposIds.has(a.tipo_accion_id)) referencias_huerfanas.push({ deal: d.nombre, campo: "tipo_accion_id", id: a.tipo_accion_id });
      if (a.resultado_id && !resIds.has(a.resultado_id)) referencias_huerfanas.push({ deal: d.nombre, campo: "resultado_id", id: a.resultado_id });
    }
  }

  return NextResponse.json({
    deals_auditados: deals.length,
    distribucion,
    candidatos_avance,
    referencias_huerfanas,
    sano: referencias_huerfanas.length === 0,
  });
}
