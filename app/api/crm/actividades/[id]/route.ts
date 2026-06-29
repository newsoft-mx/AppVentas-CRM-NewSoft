import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

const ESTADOS = ["PENDIENTE", "EN_PROCESO", "TERMINADO"] as const;
type EstadoAccion = (typeof ESTADOS)[number];

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

  const { estado_accion, completada, fecha_tarea } = (body ?? {}) as {
    estado_accion?: unknown;
    completada?: unknown;
    fecha_tarea?: unknown;
  };

  const data: {
    estado_accion?: EstadoAccion;
    completada?: boolean;
    fecha_tarea?: Date | null;
  } = {};

  // Estado de acción (fuente de verdad); sincroniza completada
  if (estado_accion !== undefined) {
    if (!ESTADOS.includes(estado_accion as EstadoAccion)) {
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
    await prisma.dealActividad.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar la tarea" }, { status: 500 });
  }
}
