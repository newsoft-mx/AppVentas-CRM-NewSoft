import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

const RESULTADOS = ["ABIERTO", "GANADO", "PERDIDO", "SUSPENDIDO"] as const;
type Resultado = (typeof RESULTADOS)[number];

// ── POST /api/crm/deals/:id/resultado ───────────────────────────
// Cambia el resultado del deal: ganado / perdido / suspendido (hold) / reabierto.
// - PERDIDO requiere razón (para estadísticas).
// - GANADO devuelve datos para precargar la orden (hand-off a Ventas).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const resultado = body.resultado as Resultado;
  if (!RESULTADOS.includes(resultado)) {
    return NextResponse.json({ error: "Resultado inválido", campo: "resultado" }, { status: 422 });
  }
  const razon = typeof body.razon_perdida === "string" ? body.razon_perdida.trim() : "";
  const comentario = typeof body.comentario_perdida === "string" ? body.comentario_perdida.trim() : "";
  if (resultado === "PERDIDO" && !razon) {
    return NextResponse.json({ error: "La razón de pérdida es obligatoria", campo: "razon_perdida" }, { status: 422 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, cliente_id: true, vendedor_id: true, nombre: true, valor: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { resultado };
    if (resultado === "GANADO" || resultado === "PERDIDO") data.fecha_cierre_real = new Date();
    if (resultado === "ABIERTO" || resultado === "SUSPENDIDO") data.fecha_cierre_real = null;
    if (resultado === "PERDIDO") {
      data.razon_perdida = razon;
      data.comentario_perdida = comentario || null;
    } else {
      data.razon_perdida = null;
      data.comentario_perdida = null;
    }

    const LABEL: Record<Resultado, string> = {
      ABIERTO: "reabierto (activo)",
      GANADO: "GANADO",
      PERDIDO: `PERDIDO (${razon})`,
      SUSPENDIDO: "SUSPENDIDO (en pausa)",
    };

    await prisma.$transaction([
      prisma.deal.update({ where: { id }, data }),
      prisma.dealActividad.create({
        data: {
          deal_id: id,
          tipo: "SISTEMA",
          autor: session.email,
          contenido:
            resultado === "PERDIDO"
              ? `Deal marcado como PERDIDO. Razón: ${razon}.${comentario ? " " + comentario : ""}`
              : `Deal marcado como ${LABEL[resultado]}.`,
        },
      }),
    ]);

    if (resultado === "GANADO") {
      return NextResponse.json({
        ok: true,
        handoff: {
          cliente_id: deal.cliente_id,
          vendedor_id: deal.vendedor_id,
          descripcion: deal.nombre,
          valor: Number(deal.valor),
        },
      });
    }
    return NextResponse.json({ ok: true, resultado });
  } catch {
    return NextResponse.json({ error: "Error al cambiar el resultado del deal" }, { status: 500 });
  }
}
