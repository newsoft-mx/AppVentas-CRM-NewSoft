import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, isAdmin, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { transicionResultadoPermitida } from "@/lib/utils";
import { clasificarReapertura, handoffGanado, puedeReabrirConVenta } from "@/lib/deals";
import { logger } from "@/lib/logger";
import { RESULTADOS_CERRADOS, RESULTADOS_DEAL, type DealResultado } from "@/types/crm";

export const dynamic = "force-dynamic";

type Resultado = DealResultado;

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
  if (!RESULTADOS_DEAL.includes(resultado)) {
    return NextResponse.json({ error: "Resultado inválido", campo: "resultado" }, { status: 422 });
  }
  const razon = typeof body.razon_perdida === "string" ? body.razon_perdida.trim() : "";
  const motivoReapertura = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 200) : "";
  const comentario = typeof body.comentario_perdida === "string" ? body.comentario_perdida.trim() : "";
  if (resultado === "PERDIDO" && !razon) {
    return NextResponse.json({ error: "La razón de pérdida es obligatoria", campo: "razon_perdida" }, { status: 422 });
  }

  try {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: {
        id: true, resultado: true, cliente_id: true, vendedor_id: true, nombre: true, valor: true,
        // Se guarda en la traza de reapertura: el deal vivo la pierde al volver a ABIERTO.
        razon_perdida: true,
        // La orden vinculada decide quién puede reabrir y si re-ganar crea una orden nueva.
        orden_id: true,
        orden: { select: { folio: true, estatus: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // Reabrir un deal cerrado: nada se bloquea, pero con plata facturada pide ADMIN y motivo.
    const reabriendo = RESULTADOS_CERRADOS.includes(deal.resultado as never) && resultado === "ABIERTO";
    if (reabriendo) {
      const decision = clasificarReapertura({ resultado: deal.resultado, orden: deal.orden });
      if (decision.soloAdmin && !puedeReabrirConVenta(session.rol)) {
        return NextResponse.json(
          {
            error: `Necesitás que lo apruebe un gerente comercial o un administrador. ${decision.aviso ?? ""}`.trim(),
            soloAdmin: true,
          },
          { status: 403 }
        );
      }
      if (decision.pideMotivo && !motivoReapertura) {
        return NextResponse.json(
          { error: "El motivo de la reapertura es obligatorio", campo: "motivo" },
          { status: 422 }
        );
      }
    }

    // Máquina de estados (Bloque E): un deal cerrado puede volver a ABIERTO, pero el salto
    // directo entre cerrados no existe — de PERDIDO a GANADO hay que pasar por el pipeline,
    // así el cierre queda registrado y el funnel no muestra una conversión que no ocurrió.
    if (!transicionResultadoPermitida(deal.resultado, resultado)) {
      return NextResponse.json(
        { error: `Transición no permitida: ${deal.resultado} → ${resultado}`, campo: "resultado" },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { resultado };
    if (resultado === "GANADO" || resultado === "PERDIDO") data.fecha_cierre_real = new Date();
    if (resultado === "ABIERTO" || resultado === "SUSPENDIDO") data.fecha_cierre_real = null;
    if (resultado === "PERDIDO") {
      data.razon_perdida = razon; // etiqueta denormalizada (snapshot para reportes)
      data.comentario_perdida = comentario || null;
      // FK al catálogo por nombre (integridad). null si es un motivo libre fuera del catálogo.
      const motivo = await prisma.motivoPerdida.findFirst({
        where: { activo: true, nombre: { equals: razon, mode: "insensitive" } },
        select: { id: true },
      });
      data.motivo_perdida_id = motivo?.id ?? null;
    } else {
      data.razon_perdida = null;
      data.comentario_perdida = null;
      data.motivo_perdida_id = null;
    }

    const LABEL: Record<Resultado, string> = {
      ABIERTO: "reabierto (activo)",
      GANADO: "GANADO",
      PERDIDO: `PERDIDO (${razon})`,
      SUSPENDIDO: "SUSPENDIDO (en pausa)",
    };

    // La reapertura deja de DÓNDE vuelve y por qué: el deal vivo pierde la razón de pérdida
    // (un deal abierto no tiene una), así que si no queda acá no queda en ningún lado.
    const contenido = (() => {
      if (resultado === "PERDIDO") {
        return `Deal marcado como PERDIDO. Razón: ${razon}.${comentario ? " " + comentario : ""}`;
      }
      if (reabriendo) {
        const desde = deal.resultado === "PERDIDO" && deal.razon_perdida
          ? `PERDIDO (${deal.razon_perdida})`
          : deal.resultado;
        // El folio va en la traza porque el vínculo con la orden no se ve en ninguna pantalla:
        // sin esto, al volver a ganar el deal te lleva a una orden vieja sin explicación.
        const orden = deal.orden ? ` Orden vinculada: ${deal.orden.folio} (${deal.orden.estatus}).` : "";
        return `Deal reabierto desde ${desde}.${orden}${motivoReapertura ? ` Motivo: ${motivoReapertura}` : ""}`;
      }
      return `Deal marcado como ${LABEL[resultado]}.`;
    })();

    await prisma.$transaction([
      prisma.deal.update({ where: { id }, data }),
      prisma.dealActividad.create({
        data: { deal_id: id, tipo: "SISTEMA", autor: session.email, contenido },
      }),
    ]);

    // Idempotente: si el deal ya tiene orden (se ganó, se reabrió y se vuelve a ganar) se
    // retoma esa, no se crea otra. Sin esto el ingreso se contaba dos veces.
    if (resultado === "GANADO") {
      return NextResponse.json({ ok: true, handoff: handoffGanado(deal) });
    }
    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    logger.error("Error al cambiar el resultado del deal", "POST /api/crm/deals/:id/resultado", err);
    return NextResponse.json({ error: "Error al cambiar el resultado del deal" }, { status: 500 });
  }
}
