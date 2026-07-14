import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { TEMPERATURAS, type Temperatura } from "@/types/crm";

export const dynamic = "force-dynamic";


// Score objetivo = punto medio del rango del nivel elegido (cortes configurables).
function scoreObjetivoParaNivel(nivel: Temperatura, cortes: number[]): number {
  const [c1, c2, c3, c4] = cortes;
  switch (nivel) {
    case "MUY_FRIO": return Math.round(c1 / 2);
    case "FRIO": return Math.round((c1 + c2) / 2);
    case "TIBIO": return Math.round((c2 + c3) / 2);
    case "CALIENTE": return Math.round((c3 + c4) / 2);
    case "MUY_CALIENTE": return Math.round((c4 + 100) / 2);
  }
}

// ── PATCH /api/crm/deals/:id/temperatura ────────────────────────
// Override manual del score: el vendedor fija el deal en un nivel/score. No pisa la
// fórmula — guarda `ajuste_manual` (delta sobre el score derivado) que sobrevive a los
// recálculos. Body: { temperatura: <nivel> } o { score: 0-100 }.
export async function PATCH(
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
  const { temperatura, score } = (body ?? {}) as { temperatura?: unknown; score?: unknown };

  try {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: { id: true, stage_id: true, created_at: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    const ctx = await getScoringContext();

    // Objetivo: un score directo o el punto medio del nivel elegido.
    let objetivo: number;
    if (typeof score === "number") {
      objetivo = Math.max(0, Math.min(100, Math.round(score)));
    } else if (TEMPERATURAS.includes(temperatura as Temperatura)) {
      objetivo = scoreObjetivoParaNivel(temperatura as Temperatura, ctx.config.niveles_umbral);
    } else {
      return NextResponse.json({ error: "Enviá 'temperatura' (nivel) o 'score' (0-100)" }, { status: 422 });
    }

    // Score derivado SIN ajuste (para calcular el delta que lo lleva al objetivo).
    const actividades = await prisma.dealActividad.findMany({
      where: { deal_id: id, eliminada: false },
      select: { tipo_accion_id: true, resultado_id: true, created_at: true },
    });
    const ahora = new Date();
    const scoreSinAjuste = dealScoreView(
      ctx,
      { ajuste_manual: 0, stage_id: deal.stage_id, created_at: deal.created_at, actividades },
      ahora
    ).score;
    const ajuste_manual = objetivo - scoreSinAjuste;

    await prisma.deal.update({ where: { id }, data: { ajuste_manual } });
    const view = dealScoreView(
      ctx,
      { ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at, actividades },
      ahora
    );
    // Rastro en la bitácora (transparencia del override manual)
    await prisma.dealActividad.create({
      data: { deal_id: id, tipo: "SISTEMA", autor: session.email, contenido: `Score ajustado manualmente a ${view.score}/100 (${view.temperatura}).` },
    });

    return NextResponse.json({ ok: true, score: view.score, temperatura: view.temperatura, probabilidad: view.probabilidad });
  } catch {
    return NextResponse.json({ error: "Error al ajustar el score" }, { status: 500 });
  }
}
