export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (typeof body.nombre === "string") {
      if (!body.nombre.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
      data.nombre = body.nombre.trim();
    }
    if (typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)) data.color = body.color;
    if (body.orden !== undefined && Number.isFinite(Number(body.orden))) data.orden = Math.round(Number(body.orden));
    if (body.probabilidad_base !== undefined && Number.isFinite(Number(body.probabilidad_base))) {
      data.probabilidad_base = Math.min(100, Math.max(0, Math.round(Number(body.probabilidad_base))));
    }
    // Umbral de avance por termómetro (REQ-06): temperatura válida o null para desactivar
    const TEMPS = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];
    if (body.umbral_avance !== undefined) {
      if (body.umbral_avance === null || TEMPS.includes(body.umbral_avance)) {
        data.umbral_avance = body.umbral_avance;
      }
    }
    if (typeof body.activo === "boolean") data.activo = body.activo;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const stage = await prisma.pipelineStage.update({
      where: { id },
      data,
      select: {
        id: true, nombre: true, orden: true, color: true,
        activo: true, probabilidad_base: true, umbral_avance: true,
      },
    });
    return NextResponse.json(stage);
  } catch {
    return NextResponse.json({ error: "Error al actualizar la etapa" }, { status: 500 });
  }
}
