import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeOrden } from "@/lib/serializers";
import { EstatusUpdateSchema } from "@/lib/validations/ordenes";
import { TRANSICIONES_PERMITIDAS } from "@/lib/utils";
import { canWrite, requireAuth } from "@/lib/session";
import { canMutateOrden } from "@/lib/access-control";

// ── PATCH /api/ordenes/:id/estatus ────────────────────────────

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

  const parsed = EstatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.errors.map((e) => ({
      campo: e.path.join("."),
      mensaje: e.message,
    }));
    return NextResponse.json({ error: "Datos inválidos", details }, { status: 422 });
  }

  const { estatus: nuevoEstatus, fecha_venta } = parsed.data;

  try {
    const orden = await prisma.ordenVenta.findUnique({
      where: { id },
      select: { id: true, estatus: true, vendedor_id: true },
    });

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canMutateOrden(session, orden)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Validar transición permitida
    const transicionesValidas = TRANSICIONES_PERMITIDAS[orden.estatus] ?? [];
    if (!transicionesValidas.includes(nuevoEstatus)) {
      return NextResponse.json(
        {
          error: `Transición no permitida: ${orden.estatus} → ${nuevoEstatus}`,
          transiciones_validas: transicionesValidas,
        },
        { status: 409 }
      );
    }

    // Si se marca como VENTA, requerir fecha_venta
    if (nuevoEstatus === "VENTA" && !fecha_venta) {
      return NextResponse.json(
        { error: "Se requiere la fecha de venta al confirmar como VENTA", campo: "fecha_venta" },
        { status: 422 }
      );
    }

    const actualizada = await prisma.ordenVenta.update({
      where: { id },
      data: {
        estatus: nuevoEstatus,
        ...(nuevoEstatus === "VENTA" && fecha_venta
          ? { fecha_venta: new Date(fecha_venta) }
          : {}),
      },
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
    return NextResponse.json({ error: "Error al cambiar el estatus" }, { status: 500 });
  }
}
