export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

// GET /api/calculadora/casos/:id — cargar una cotización (estado completo). Solo del dueño.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const caso = await prisma.calculadoraCaso.findFirst({
    where: { id, user_id: session.userId },
    select: { id: true, nombre: true, datos: true, deal_id: true, updated_at: true },
  });
  if (!caso) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });

  return NextResponse.json({ ...caso, updated_at: caso.updated_at.toISOString() });
}

// DELETE /api/calculadora/casos/:id — eliminar. Scopeado al dueño (evita IDOR).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const del = await prisma.calculadoraCaso.deleteMany({ where: { id, user_id: session.userId } });
  if (del.count === 0) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
