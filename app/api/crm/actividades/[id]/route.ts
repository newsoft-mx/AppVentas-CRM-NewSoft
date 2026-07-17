import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { resolveActividadInput, serializeActividad, ACTIVIDAD_INCLUDE } from "@/lib/actividad-input";
import { MAX_CONTENIDO, MSG_CONTENIDO_LARGO } from "@/lib/actividad";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/actividades/:id ──────────────────────────────
// Actualiza el estado de una acción/seguimiento de la bitácora.
// Acepta cualquier combinación de:
//   - completada: boolean — ÚNICO campo de estado (Pendiente ⇄ Listo, SOL-21/23)
//   - resultado_id: id del catálogo | null — desenlace, se pide al marcar Listo (SOL-23)
//   - fecha_tarea: ISO datetime | null (reprogramar)
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

  const bodyObj = (body ?? {}) as Record<string, unknown>;

  try {
    // Scoping por vendedor (evita IDOR): la actividad debe pertenecer a un deal accesible.
    const act = await prisma.dealActividad.findUnique({ where: { id }, select: { deal_id: true } });
    if (!act) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id: act.deal_id }),
      select: { id: true, stage_id: true, ajuste_manual: true, created_at: true },
    });
    if (!deal) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });

    // ── Edición completa: el compositor envía `tipo` → se editan todos los campos
    // capturados reusando la validación del alta (SSOT). Deja marca "editada" y
    // recalcula el score (editar tipo/resultado/fecha puede mover el termómetro).
    if (bodyObj.tipo !== undefined) {
      const resuelto = await resolveActividadInput(body, deal.id);
      if (!resuelto.ok) {
        return NextResponse.json({ error: resuelto.error, campo: resuelto.campo }, { status: resuelto.status });
      }
      const actualizada = await prisma.dealActividad.update({
        where: { id },
        data: { ...resuelto.data, editada: true, editada_at: new Date() },
        include: ACTIVIDAD_INCLUDE,
      });
      const ctx = await getScoringContext();
      const actsAll = await prisma.dealActividad.findMany({
        where: { deal_id: deal.id, eliminada: false },
        select: { id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
      });
      const view = dealScoreView(
        ctx,
        { ajuste_manual: deal.ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at, actividades: actsAll },
        new Date()
      );
      return NextResponse.json({
        ok: true,
        actividad: serializeActividad(actualizada),
        score: view.score,
        temperatura: view.temperatura,
        probabilidad: view.probabilidad,
        sugerir_reagendar: resuelto.sugiereReagendar,
      });
    }

    // ── Actualización parcial: completada / resultado / fecha_tarea / destacada / contenido.
    const { completada, resultado_id, fecha_tarea, hora_definida, destacada, contenido } = bodyObj as {
      completada?: unknown; resultado_id?: unknown; fecha_tarea?: unknown; hora_definida?: unknown;
      destacada?: unknown; contenido?: unknown;
    };
    const data: {
      completada?: boolean; resultado_id?: string | null; fecha_tarea?: Date | null;
      hora_definida?: boolean;
      destacada?: boolean; contenido?: string; editada?: boolean; editada_at?: Date;
    } = {};

    // Editar solo el contenido (compat) → deja marca "editada". La nota puede quedar
    // vacía (SOL-21: nunca bloquea).
    if (contenido !== undefined) {
      const c = typeof contenido === "string" ? contenido.trim() : "";
      if (c.length > MAX_CONTENIDO) return NextResponse.json({ error: MSG_CONTENIDO_LARGO }, { status: 422 });
      data.contenido = c;
      data.editada = true;
      data.editada_at = new Date();
    }
    // Destacar/pin (bookmark)
    if (destacada !== undefined) {
      if (typeof destacada !== "boolean") {
        return NextResponse.json({ error: "destacada (boolean) requerido" }, { status: 422 });
      }
      data.destacada = destacada;
    }
    // Estado (SOL-21/23): Pendiente ⇄ Listo. `completada` es el ÚNICO campo de estado;
    // el resto (Pendiente/Listo) se DERIVA con es_tarea (lib/tareas → estadoTarea).
    if (completada !== undefined) {
      if (typeof completada !== "boolean") {
        return NextResponse.json({ error: "completada (boolean) requerido" }, { status: 422 });
      }
      data.completada = completada;
    }
    // Desenlace (SOL-23): se pide al marcar Listo, nunca al agendar. Valida contra el catálogo.
    if (resultado_id !== undefined) {
      if (resultado_id === null || resultado_id === "") {
        data.resultado_id = null;
      } else {
        const r = await prisma.resultadoAccion.findFirst({
          where: { id: String(resultado_id), activo: true },
          select: { id: true },
        });
        if (!r) return NextResponse.json({ error: "Desenlace inválido", campo: "resultado_id" }, { status: 422 });
        data.resultado_id = r.id;
      }
    }
    // Reprogramar. `hora_definida` viaja con la fecha: reprogramar puede quitarle la hora
    // a un pendiente (o ponérsela), y sin ese dato el instante guardado —fin del día— se
    // mostraría como si fuera una hora elegida (SOL-22).
    if (fecha_tarea !== undefined) {
      if (fecha_tarea === null) {
        data.fecha_tarea = null;
      } else if (typeof fecha_tarea === "string" && !Number.isNaN(new Date(fecha_tarea).getTime())) {
        data.fecha_tarea = new Date(fecha_tarea);
      } else {
        return NextResponse.json({ error: "fecha_tarea inválida" }, { status: 422 });
      }
    }
    if (typeof hora_definida === "boolean") data.hora_definida = hora_definida;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 422 });
    }
    await prisma.dealActividad.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar la tarea" }, { status: 500 });
  }
}

// ── DELETE /api/crm/actividades/:id ─────────────────────────────
// Soft-delete (SOL-02): marca eliminada=true; NO borra en duro, para no romper
// el rastro auditable que consumen termómetro, probabilidad e IA (Fase 2).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    // Mismo scoping que el PATCH: la actividad debe pertenecer a un deal accesible.
    const act = await prisma.dealActividad.findUnique({ where: { id }, select: { deal_id: true } });
    if (!act) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    const deal = await prisma.deal.findFirst({ where: scopeDealWhere(session, { id: act.deal_id }), select: { id: true } });
    if (!deal) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    await prisma.dealActividad.update({ where: { id }, data: { eliminada: true, eliminada_at: new Date() } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar la entrada" }, { status: 500 });
  }
}
