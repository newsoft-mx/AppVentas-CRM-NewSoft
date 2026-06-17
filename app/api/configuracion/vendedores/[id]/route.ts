import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeVendedor } from "@/lib/serializers";
import { vendedorUpdateSchema } from "@/lib/validations/configuracion";
import { isAdmin, requireAuth } from "@/lib/session";

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
    const validation = vendedorUpdateSchema.safeParse(body);

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

    const actual = await prisma.vendedor.findUnique({ where: { id } });
    if (!actual) {
      return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
    }

    const duplicado = await prisma.vendedor.findFirst({
      where: {
        nombre: { equals: validation.data.nombre, mode: "insensitive" },
        activo: true,
        NOT: { id },
      },
    });

    if (duplicado) {
      return NextResponse.json({ error: "Ya existe un vendedor activo con ese nombre" }, { status: 409 });
    }

    const vendedor = await prisma.vendedor.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(serializeVendedor(vendedor));
  } catch {
    return NextResponse.json({ error: "Error al actualizar vendedor" }, { status: 500 });
  }
}
