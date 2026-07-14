export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";

// GET /api/simulador/deals — deals accesibles para el selector "Vincular a deal".
// Scopeado como el resto del CRM (VENDEDOR solo los suyos; ADMIN/GERENTE todos).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const deals = await prisma.deal.findMany({
    where: scopeDealWhere(session, {}),
    select: { id: true, nombre: true, cliente: { select: { nombre: true } } },
    orderBy: { created_at: "desc" },
    take: 300,
  });

  return NextResponse.json(
    deals.map((d) => ({ id: d.id, nombre: d.nombre, cliente: d.cliente?.nombre ?? null }))
  );
}
