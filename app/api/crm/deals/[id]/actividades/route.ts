import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { resolveActividadInput, serializeActividad, ACTIVIDAD_INCLUDE } from "@/lib/actividad-input";

export const dynamic = "force-dynamic";

// ── POST /api/crm/deals/:id/actividades ─────────────────────────
// Registra una entrada en la bitácora del deal (nota/llamada/email/whatsapp),
// opcionalmente como tarea con fecha.
export async function POST(
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

  try {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: { id: true, stage_id: true, ajuste_manual: true, created_at: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // Validación + resolución de campos (SSOT compartido con la edición — PATCH)
    const resuelto = await resolveActividadInput(body, id);
    if (!resuelto.ok) {
      return NextResponse.json({ error: resuelto.error, campo: resuelto.campo }, { status: resuelto.status });
    }

    const actividad = await prisma.dealActividad.create({
      data: { deal_id: id, autor: session.email, ...resuelto.data },
      include: ACTIVIDAD_INCLUDE,
    });

    // ── Scoring: se RECALCULA on-read desde todo el historial (SSOT). Nada de temperatura persistida.
    const ctx = await getScoringContext();
    const actsAll = await prisma.dealActividad.findMany({
      where: { deal_id: id, eliminada: false },
      select: { id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
    });
    const dealBase = { ajuste_manual: deal.ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at };
    const ahora = new Date();
    const view = dealScoreView(ctx, { ...dealBase, actividades: actsAll }, ahora);
    // Score ANTES de esta actividad (para disparar avance solo al CRUZAR al alza, no en cada nota a tope)
    const scoreAntes = dealScoreView(
      ctx,
      { ...dealBase, actividades: actsAll.filter((a) => a.id !== actividad.id) },
      ahora
    ).score;
    const umbral = ctx.stageById.get(deal.stage_id)?.umbral_avance_score ?? null;
    const cruzoAlAlza = umbral != null && scoreAntes < umbral && view.score >= umbral && view.siguienteStageId !== null;

    let sugerirAvance = false;
    let avanzoEtapa = false;
    if (cruzoAlAlza && view.siguienteStageId) {
      if (ctx.avance_modo === "AUTOMATICO") {
        // Bloque E: los 3 writes van en UNA transacción. Si no, una falla parcial
        // dejaba el stage avanzado sin su DealStageEvent → el funnel (que reconstruye
        // la etapa alcanzada desde ese historial) divergía del pipeline real.
        await prisma.$transaction([
          prisma.deal.update({
            where: { id },
            data: { stage_id: view.siguienteStageId, fecha_entrada_stage: new Date() },
          }),
          prisma.dealActividad.create({
            data: {
              deal_id: id,
              tipo: "SISTEMA",
              autor: "Sistema",
              contenido: `Avance automático (score ${view.score}/100).`,
            },
          }),
          prisma.dealStageEvent.create({
            data: { deal_id: id, from_stage_id: deal.stage_id, to_stage_id: view.siguienteStageId },
          }),
        ]);
        avanzoEtapa = true;
      } else {
        sugerirAvance = true; // modo SUGERIR → el front muestra el banner
      }
    }

    return NextResponse.json(
      {
        actividad: serializeActividad(actividad),
        // Score y derivaciones recalculadas (SSOT). Si avanzó de etapa, el front refresca.
        score: view.score,
        temperatura: view.temperatura,
        probabilidad: view.probabilidad,
        sugerir_avance: sugerirAvance,
        avanzo_etapa: avanzoEtapa,
        // Cierre de ciclo (SOL-04): el resultado sugiere agendar la próxima acción
        sugerir_reagendar: resuelto.sugiereReagendar,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Error al registrar la actividad" }, { status: 500 });
  }
}
