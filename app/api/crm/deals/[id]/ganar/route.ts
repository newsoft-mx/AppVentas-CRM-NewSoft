import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { transicionResultadoPermitida } from "@/lib/utils";
import { handoffGanado } from "@/lib/deals";
import { logger } from "@/lib/logger";

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
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: {
        id: true, resultado: true, cliente_id: true, vendedor_id: true, nombre: true, valor: true,
        // Si ya tiene orden, ganar de nuevo la retoma en vez de crear otra (handoffGanado).
        orden_id: true,
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    if (deal.resultado === "GANADO") {
      return NextResponse.json({ ok: true, ya_ganado: true, deal });
    }
    // Máquina de estados (Bloque E): solo ABIERTO/SUSPENDIDO pueden ganarse. Un deal PERDIDO
    // no se gana por esta vía: hay que reabrirlo primero, para que el cierre quede registrado.
    if (!transicionResultadoPermitida(deal.resultado, "GANADO")) {
      return NextResponse.json(
        { error: `Transición no permitida: ${deal.resultado} → GANADO` },
        { status: 409 }
      );
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

    // Datos para precargar la orden en el módulo Ventas. deal_id viaja para que la orden, al
    // crearse, quede vinculada al deal (Bloque T: trazabilidad). Si el deal YA tiene orden
    // (se ganó, se reabrió y se vuelve a ganar), handoffGanado devuelve esa y no se crea otra.
    return NextResponse.json({ ok: true, handoff: handoffGanado(deal) });
  } catch (err) {
    logger.error("Error al marcar el deal como ganado", "POST /api/crm/deals/:id/ganar", err);
    return NextResponse.json({ error: "Error al marcar el deal como ganado" }, { status: 500 });
  }
}
