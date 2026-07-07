import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/deals/:id/stage ──────────────────────────────
// Mueve un deal a otra etapa del pipeline. Reinicia "días en etapa"
// y registra una actividad de SISTEMA en la bitácora.
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

  const stageId = (body as { stage_id?: string })?.stage_id;
  if (!stageId || typeof stageId !== "string") {
    return NextResponse.json({ error: "stage_id requerido", campo: "stage_id" }, { status: 422 });
  }

  try {
    const [deal, nuevoStage] = await Promise.all([
      prisma.deal.findUnique({
        where: { id },
        select: { id: true, stage_id: true, stage: { select: { nombre: true } } },
      }),
      prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { id: true, nombre: true, activo: true, probabilidad_base: true },
      }),
    ]);

    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    if (!nuevoStage || !nuevoStage.activo) {
      return NextResponse.json({ error: "Etapa inválida" }, { status: 422 });
    }
    if (deal.stage_id === nuevoStage.id) {
      return NextResponse.json({ ok: true, sin_cambio: true });
    }

    await prisma.$transaction([
      prisma.deal.update({
        where: { id },
        data: {
          stage_id: nuevoStage.id,
          fecha_entrada_stage: new Date(),
          // Probabilidad automática: se ajusta a la de la nueva etapa
          probabilidad: nuevoStage.probabilidad_base,
        },
      }),
      prisma.dealActividad.create({
        data: {
          deal_id: id,
          tipo: "SISTEMA",
          autor: session.email,
          contenido: `Movió el deal de "${deal.stage?.nombre ?? "—"}" a "${nuevoStage.nombre}".`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al mover el deal" }, { status: 500 });
  }
}
