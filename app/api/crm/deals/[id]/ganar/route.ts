import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

// ── POST /api/crm/deals/:id/ganar ───────────────────────────────
// Hand-off: marca el deal como GANADO y registra el cierre. La creación
// de la Orden de Venta se sugiere/precarga en el módulo Ventas (el cliente
// redirige a /ventas/nueva con los datos del deal).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, resultado: true, cliente_id: true, vendedor_id: true, nombre: true, valor: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    if (deal.resultado === "GANADO") {
      return NextResponse.json({ ok: true, ya_ganado: true, deal });
    }

    await prisma.$transaction([
      prisma.deal.update({
        where: { id },
        data: { resultado: "GANADO", fecha_cierre_real: new Date() },
      }),
      prisma.dealActividad.create({
        data: {
          deal_id: id,
          tipo: "SISTEMA",
          autor: session.email,
          contenido: `Deal marcado como GANADO. Pendiente: generar la orden de venta.`,
        },
      }),
    ]);

    // Datos para precargar la orden en el módulo Ventas
    return NextResponse.json({
      ok: true,
      handoff: {
        cliente_id: deal.cliente_id,
        vendedor_id: deal.vendedor_id,
        descripcion: deal.nombre,
        valor: Number(deal.valor),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al marcar el deal como ganado" }, { status: 500 });
  }
}
