export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const EFECTOS = ["POSITIVO", "NEUTRO", "NEGATIVO"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const b = (body ?? {}) as { nombre?: unknown; efecto?: unknown; sugiere_reagendar?: unknown; activo?: unknown };
  const data: { nombre?: string; efecto?: (typeof EFECTOS)[number]; sugiere_reagendar?: boolean; activo?: boolean } = {};
  if (b.nombre !== undefined) {
    const n = typeof b.nombre === "string" ? b.nombre.trim() : "";
    if (!n) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 422 });
    data.nombre = n;
  }
  if (EFECTOS.includes(b.efecto as (typeof EFECTOS)[number])) data.efecto = b.efecto as (typeof EFECTOS)[number];
  if (typeof b.sugiere_reagendar === "boolean") data.sugiere_reagendar = b.sugiere_reagendar;
  if (typeof b.activo === "boolean") data.activo = b.activo;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para actualizar" }, { status: 422 });
  try {
    return NextResponse.json(await prisma.resultadoAccion.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "Resultado no encontrado" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.resultadoAccion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se puede eliminar (¿tiene actividades?)" }, { status: 409 });
  }
}
