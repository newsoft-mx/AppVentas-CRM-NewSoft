export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { simuladorCasoSchema } from "@/lib/validations/simulador";

// GET /api/simulador/casos — casos del usuario logueado (opcional ?deal_id=).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dealId = req.nextUrl.searchParams.get("deal_id");
  const casos = await prisma.simuladorCaso.findMany({
    where: { user_id: session.userId, ...(dealId ? { deal_id: dealId } : {}) },
    select: { id: true, nombre: true, deal_id: true, updated_at: true, deal: { select: { nombre: true } } },
    orderBy: { updated_at: "desc" },
  });

  return NextResponse.json(
    casos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      deal_id: c.deal_id,
      deal_nombre: c.deal?.nombre ?? null,
      updated_at: c.updated_at.toISOString(),
    }))
  );
}

// POST /api/simulador/casos — guardar (upsert por nombre: guardar el mismo nombre sobrescribe).
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = simuladorCasoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message })) },
      { status: 422 }
    );
  }

  // El deal (si se vincula) debe ser accesible para el usuario (mismo scope que el CRM).
  let dealId: string | null = null;
  if (parsed.data.deal_id) {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id: parsed.data.deal_id }),
      select: { id: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no accesible", campo: "deal_id" }, { status: 422 });
    dealId = deal.id;
  }

  const datos = parsed.data.datos as Prisma.InputJsonValue;
  const caso = await prisma.simuladorCaso.upsert({
    where: { user_id_nombre: { user_id: session.userId, nombre: parsed.data.nombre } },
    create: { user_id: session.userId, nombre: parsed.data.nombre, datos, deal_id: dealId },
    update: { datos, deal_id: dealId },
    select: { id: true, nombre: true, deal_id: true, updated_at: true },
  });

  return NextResponse.json({ ...caso, updated_at: caso.updated_at.toISOString() }, { status: 201 });
}
