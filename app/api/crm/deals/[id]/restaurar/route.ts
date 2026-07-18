import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/crm/deals/:id/restaurar
// Deshace un borrado MARCADO (eliminada=true). Solo lo destruido físicamente no vuelve —
// eso es intencional (era basura sin trabajo). Solo ADMIN: restaurar es la contracara de
// forzar la destrucción, y ambas son de administración.
//
// Nota: pasa incluirEliminados para poder ENCONTRAR el deal borrado — scopeDealWhere lo
// oculta por default, que es justo lo que buscamos en el resto de la app.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Solo un administrador puede restaurar" }, { status: 403 });
  }

  try {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }, { incluirEliminados: true }),
      select: { id: true, nombre: true, eliminada: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    if (!deal.eliminada) return NextResponse.json({ ok: true, ya_activo: true });

    await prisma.deal.update({
      where: { id: deal.id },
      data: { eliminada: false, eliminada_at: null, eliminada_por: null, motivo_eliminacion: null },
    });
    logger.info(`Deal restaurado: "${deal.nombre}" por ${session.email}`, "POST /api/crm/deals/:id/restaurar");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Error al restaurar el deal", "POST /api/crm/deals/:id/restaurar", err);
    return NextResponse.json({ error: "Error al restaurar el lead" }, { status: 500 });
  }
}
