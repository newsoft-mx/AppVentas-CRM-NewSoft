export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const b = (body ?? {}) as { nombre?: unknown; color?: unknown; agendable?: unknown; con_resultado?: unknown; activo?: unknown };
  const data: { nombre?: string; color?: string; agendable?: boolean; con_resultado?: boolean; activo?: boolean } = {};
  if (b.nombre !== undefined) {
    const n = typeof b.nombre === "string" ? b.nombre.trim() : "";
    if (!n) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 422 });
    data.nombre = n;
  }
  if (typeof b.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.color)) data.color = b.color;
  if (typeof b.agendable === "boolean") data.agendable = b.agendable;
  if (typeof b.con_resultado === "boolean") data.con_resultado = b.con_resultado;
  if (typeof b.activo === "boolean") data.activo = b.activo;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para actualizar" }, { status: 422 });
  try {
    return NextResponse.json(await prisma.tipoAccion.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "Tipo no encontrado" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.tipoAccion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se puede eliminar (¿tiene actividades?)" }, { status: 409 });
  }
}
