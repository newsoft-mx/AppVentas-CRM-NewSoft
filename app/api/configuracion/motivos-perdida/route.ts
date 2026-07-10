export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/configuracion/motivos-perdida — lista (activos e inactivos) (SOL-10)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const motivos = await prisma.motivoPerdida.findMany({
    orderBy: [{ activo: "desc" }, { orden: "asc" }, { nombre: "asc" }],
  });
  return NextResponse.json(motivos);
}

// POST /api/configuracion/motivos-perdida — crear
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const nombre = typeof (body as { nombre?: unknown })?.nombre === "string" ? ((body as { nombre: string }).nombre).trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 422 });
  if (nombre.length > 150) return NextResponse.json({ error: "Máximo 150 caracteres" }, { status: 422 });

  const dup = await prisma.motivoPerdida.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, activo: true },
  });
  if (dup) return NextResponse.json({ error: "Ya existe un motivo con ese nombre" }, { status: 409 });

  const max = await prisma.motivoPerdida.aggregate({ _max: { orden: true } });
  const nuevo = await prisma.motivoPerdida.create({ data: { nombre, orden: (max._max.orden ?? -1) + 1 } });
  return NextResponse.json(nuevo, { status: 201 });
}
