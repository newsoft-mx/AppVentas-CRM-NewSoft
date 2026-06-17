import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeTipo } from "@/lib/serializers";
import { tipoCotizacionUpdateSchema } from "@/lib/validations/configuracion";
import { isAdmin, requireAuth } from "@/lib/session";

// PUT /api/configuracion/tipos-cotizacion/:id
// Actualiza nombre, descripcion y activo (soft delete via activo=false)
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
    const validation = tipoCotizacionUpdateSchema.safeParse(body);

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

    const tipo = await prisma.tipoCotizacion.findUnique({
      where: { id },
    });

    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo de cotización no encontrado" },
        { status: 404 }
      );
    }

    // Verificar nombre duplicado (ignorando el registro actual)
    const duplicado = await prisma.tipoCotizacion.findFirst({
      where: {
        nombre: { equals: validation.data.nombre, mode: "insensitive" },
        activo: true,
        NOT: { id },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe un tipo de cotización activo con ese nombre" },
        { status: 409 }
      );
    }

    const updated = await prisma.tipoCotizacion.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(serializeTipo(updated));
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar tipo de cotización" },
      { status: 500 }
    );
  }
}
