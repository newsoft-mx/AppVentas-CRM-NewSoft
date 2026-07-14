import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { logger } from "@/lib/logger";
import type { RolContacto } from "@prisma/client";

export const dynamic = "force-dynamic";

const ROLES = ["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"];

// El link debe pertenecer a un deal en el scope del usuario.
async function linkEnScope(session: Parameters<typeof scopeDealWhere>[0], dealId: string, linkId: string) {
  const deal = await prisma.deal.findFirst({ where: scopeDealWhere(session, { id: dealId }), select: { id: true } });
  if (!deal) return null;
  return prisma.dealContacto.findFirst({ where: { id: linkId, deal_id: dealId }, select: { id: true } });
}

// ── PATCH /api/crm/deals/:id/contactos/:linkId ──────────────────
// Cambia el rol (por-deal) del contacto en el deal.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!(await linkEnScope(session, id, linkId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!ROLES.includes(body.rol as string)) {
    return NextResponse.json({ error: "Rol inválido", campo: "rol" }, { status: 422 });
  }
  try {
    await prisma.dealContacto.update({ where: { id: linkId }, data: { rol: body.rol as RolContacto } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Error al cambiar el rol del contacto", "PATCH /api/crm/deals/:id/contactos/:linkId", err);
    return NextResponse.json({ error: "Error al cambiar el rol" }, { status: 500 });
  }
}

// ── DELETE /api/crm/deals/:id/contactos/:linkId ─────────────────
// Quita el contacto del deal (no borra el Contacto del cliente). Un deal debe
// conservar al menos un contacto.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!(await linkEnScope(session, id, linkId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }
  const total = await prisma.dealContacto.count({ where: { deal_id: id } });
  if (total <= 1) {
    return NextResponse.json({ error: "El deal debe tener al menos un contacto." }, { status: 409 });
  }
  try {
    await prisma.dealContacto.delete({ where: { id: linkId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Error al quitar el contacto del deal", "DELETE /api/crm/deals/:id/contactos/:linkId", err);
    return NextResponse.json({ error: "Error al quitar el contacto" }, { status: 500 });
  }
}
