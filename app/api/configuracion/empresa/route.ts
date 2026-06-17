export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { serializeEmpresa } from "@/lib/serializers";
import { empresaUpdateSchema } from "@/lib/validations/configuracion";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const empresa = await prisma.empresa.findFirst();
    if (!empresa) {
      return NextResponse.json(
        { error: "No hay empresa configurada" },
        { status: 404 }
      );
    }
    return NextResponse.json(serializeEmpresa(empresa));
  } catch {
    return NextResponse.json(
      { error: "Error al obtener configuración de empresa" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const validation = empresaUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: validation.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const empresa = await prisma.empresa.findFirst();
    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa no encontrada" },
        { status: 404 }
      );
    }

    const updated = await prisma.empresa.update({
      where: { id: empresa.id },
      data: validation.data,
    });

    return NextResponse.json(serializeEmpresa(updated));
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar empresa" },
      { status: 500 }
    );
  }
}
