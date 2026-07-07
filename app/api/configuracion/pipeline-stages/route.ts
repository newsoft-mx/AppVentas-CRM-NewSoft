export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const stages = await prisma.pipelineStage.findMany({
    orderBy: [{ activo: "desc" }, { orden: "asc" }],
    select: { id: true, nombre: true, orden: true, color: true, activo: true, probabilidad_base: true },
  });
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

    const color = typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : "#9BA5BE";
    // orden: si no se indica, va al final
    let orden = Number(body.orden);
    if (!Number.isFinite(orden)) {
      const last = await prisma.pipelineStage.findFirst({ orderBy: { orden: "desc" }, select: { orden: true } });
      orden = (last?.orden ?? 0) + 1;
    }

    const prob = Number(body.probabilidad_base);
    const probabilidad_base = Number.isFinite(prob) ? Math.min(100, Math.max(0, Math.round(prob))) : 0;

    const stage = await prisma.pipelineStage.create({
      data: { nombre, color, orden: Math.round(orden), probabilidad_base },
      select: { id: true, nombre: true, orden: true, color: true, activo: true, probabilidad_base: true },
    });
    return NextResponse.json(stage, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear la etapa" }, { status: 500 });
  }
}
