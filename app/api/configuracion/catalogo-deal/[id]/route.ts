export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// PATCH /api/configuracion/catalogo-deal/:id — editar nombre / activo / orden.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = (body ?? {}) as { nombre?: unknown; activo?: unknown; orden?: unknown };
  const data: { nombre?: string; activo?: boolean; orden?: number } = {};
  if (b.nombre !== undefined) {
    const n = typeof b.nombre === "string" ? b.nombre.trim() : "";
    if (!n) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 422 });
    if (n.length > 100) return NextResponse.json({ error: "Máximo 100 caracteres" }, { status: 422 });
    data.nombre = n;
  }
  if (typeof b.activo === "boolean") data.activo = b.activo;
  if (typeof b.orden === "number") data.orden = b.orden;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para actualizar" }, { status: 422 });

  try {
    const upd = await prisma.catalogoDeal.update({ where: { id }, data });
    return NextResponse.json(upd);
  } catch {
    return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
  }
}

// DELETE /api/configuracion/catalogo-deal/:id — borrar. Los deals que la usaban quedan
// con canal_id/origen_id en null (FK onDelete: SetNull); no rompe históricos.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.catalogoDeal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
  }
}
