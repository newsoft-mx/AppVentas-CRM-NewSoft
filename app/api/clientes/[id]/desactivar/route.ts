import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageClients, requireAuth } from "@/lib/session";

// PATCH /api/clientes/:id/desactivar
// Soft delete: marca activo = false.
// Los clientes con órdenes asociadas quedan con historial visible.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { _count: { select: { ordenes: true } } },
    });

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    if (!cliente.activo) {
      return NextResponse.json(
        { error: "El cliente ya está inactivo" },
        { status: 400 }
      );
    }

    const updated = await prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json({
      mensaje: `Cliente "${updated.nombre}" desactivado`,
      num_ordenes: cliente._count.ordenes,
    });
  } catch {
    return NextResponse.json(
      { error: "Error al desactivar cliente" },
      { status: 500 }
    );
  }
}
