import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/deals/:id ────────────────────────────────────
// Actualiza campos editables del deal (por ahora: notas / resumen del proyecto, REQ-05).
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

  const { notas } = (body ?? {}) as { notas?: unknown };
  if (typeof notas !== "string") {
    return NextResponse.json({ error: "notas (string) requerido" }, { status: 422 });
  }
  if (notas.length > 2000) {
    return NextResponse.json({ error: "La descripción es demasiado larga (máx. 2000)" }, { status: 422 });
  }

  try {
    await prisma.deal.update({ where: { id }, data: { notas: notas.trim() || null } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar el deal" }, { status: 500 });
  }
}
