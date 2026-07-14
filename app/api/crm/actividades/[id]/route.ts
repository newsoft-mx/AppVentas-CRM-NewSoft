import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { MAX_CONTENIDO, MSG_CONTENIDO_LARGO } from "@/lib/actividad";
import { ESTADO_ACCION_CICLO, type EstadoAccion } from "@/types/crm";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/actividades/:id ──────────────────────────────
// Actualiza el estado de una acción/seguimiento de la bitácora.
// Acepta cualquier combinación de:
//   - estado_accion: PENDIENTE | EN_PROCESO | TERMINADO (toggle de color)
//   - completada: boolean (compat; se mantiene en sync con estado_accion)
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

  const { estado_accion, completada, fecha_tarea, destacada, contenido } = (body ?? {}) as {
    estado_accion?: unknown;
    completada?: unknown;
    fecha_tarea?: unknown;
    destacada?: unknown;
    contenido?: unknown;
  };

  const data: {
    estado_accion?: EstadoAccion;
    completada?: boolean;
    fecha_tarea?: Date | null;
    destacada?: boolean;
    contenido?: string;
    editada?: boolean;
    editada_at?: Date;
  } = {};

  // Editar el contenido de la entrada (SOL-02) → deja marca "editada"
  if (contenido !== undefined) {
    const c = typeof contenido === "string" ? contenido.trim() : "";
    if (!c) return NextResponse.json({ error: "El contenido no puede estar vacío" }, { status: 422 });
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

  // Estado de acción (fuente de verdad); sincroniza completada
  if (estado_accion !== undefined) {
    if (!ESTADO_ACCION_CICLO.includes(estado_accion as EstadoAccion)) {
      return NextResponse.json({ error: "estado_accion inválido" }, { status: 422 });
    }
    data.estado_accion = estado_accion as EstadoAccion;
    data.completada = estado_accion === "TERMINADO";
  } else if (completada !== undefined) {
    // Compat: solo llega completada → derivar estado
    if (typeof completada !== "boolean") {
      return NextResponse.json({ error: "completada (boolean) requerido" }, { status: 422 });
    }
    data.completada = completada;
    data.estado_accion = completada ? "TERMINADO" : "PENDIENTE";
  }

  // Reprogramar
  if (fecha_tarea !== undefined) {
    if (fecha_tarea === null) {
      data.fecha_tarea = null;
    } else if (typeof fecha_tarea === "string") {
      const d = new Date(fecha_tarea);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "fecha_tarea inválida" }, { status: 422 });
      }
      data.fecha_tarea = d;
    } else {
      return NextResponse.json({ error: "fecha_tarea inválida" }, { status: 422 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 422 });
  }

  try {
    // Scoping por vendedor (evita IDOR): la actividad debe pertenecer a un deal accesible.
    const act = await prisma.dealActividad.findUnique({ where: { id }, select: { deal_id: true } });
    if (!act) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    const deal = await prisma.deal.findFirst({ where: scopeDealWhere(session, { id: act.deal_id }), select: { id: true } });
    if (!deal) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
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
