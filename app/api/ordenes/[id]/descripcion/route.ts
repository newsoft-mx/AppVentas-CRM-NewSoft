import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrden } from "@/lib/serializers";
import { canWrite, requireAuth } from "@/lib/session";
import { canMutateOrden } from "@/lib/access-control";

// ── PATCH /api/ordenes/:id/descripcion ────────────────────────
// Edición inline de la descripción desde la lista de Órdenes (SOL-12b).
const MAX_LEN = 500;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = (body as { descripcion?: unknown })?.descripcion;
  const descripcion = typeof raw === "string" ? raw.trim() : "";
  if (!descripcion) {
    return NextResponse.json({ error: "La descripción no puede estar vacía", campo: "descripcion" }, { status: 422 });
  }
  if (descripcion.length > MAX_LEN) {
    return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres`, campo: "descripcion" }, { status: 422 });
  }

  try {
    const orden = await prisma.ordenVenta.findUnique({
      where: { id },
      select: { id: true, vendedor_id: true },
    });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (!canMutateOrden(session, orden)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const actualizada = await prisma.ordenVenta.update({
      where: { id },
      data: { descripcion },
      include: {
        cliente: { select: { id: true, nombre: true, rfc: true, contacto: true, email: true, ciudad: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        condicion_pago: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        partidas: { orderBy: { orden_display: "asc" } },
      },
    });

    return NextResponse.json(serializeOrden(actualizada));
  } catch {
    return NextResponse.json({ error: "Error al actualizar la descripción" }, { status: 500 });
  }
}
