import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/actividades/:id ──────────────────────────────
// Marca una tarea de la bitácora como completada / pendiente.
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
  const completada = (body as { completada?: boolean })?.completada;
  if (typeof completada !== "boolean") {
    return NextResponse.json({ error: "completada (boolean) requerido" }, { status: 422 });
  }

  try {
    await prisma.dealActividad.update({ where: { id }, data: { completada } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar la tarea" }, { status: 500 });
  }
}
