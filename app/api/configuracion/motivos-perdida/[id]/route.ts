export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// PATCH /api/configuracion/motivos-perdida/:id — editar nombre / activo / orden
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
    if (n.length > 150) return NextResponse.json({ error: "Máximo 150 caracteres" }, { status: 422 });
    data.nombre = n;
  }
  if (typeof b.activo === "boolean") data.activo = b.activo;
  if (typeof b.orden === "number") data.orden = b.orden;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para actualizar" }, { status: 422 });

  try {
    const upd = await prisma.motivoPerdida.update({ where: { id }, data });
    return NextResponse.json(upd);
  } catch {
    return NextResponse.json({ error: "Motivo no encontrado" }, { status: 404 });
  }
}

// DELETE /api/configuracion/motivos-perdida/:id — borrado (los deals guardan el
// nombre como texto, así que borrar el motivo no rompe históricos).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.motivoPerdida.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Motivo no encontrado" }, { status: 404 });
  }
}
