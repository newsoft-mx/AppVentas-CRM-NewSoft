import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeClienteWhere } from "@/lib/access-control";
import { editarContacto, marcarPrincipal, desactivarContacto, ContactoError } from "@/lib/contactos";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// El contacto debe pertenecer a un cliente en el scope del usuario (evita IDOR).
async function contactoEnScope(
  session: Parameters<typeof scopeClienteWhere>[0],
  clienteId: string,
  contactoId: string
) {
  const cliente = await prisma.cliente.findFirst({
    where: scopeClienteWhere(session, { id: clienteId }),
    select: { id: true },
  });
  if (!cliente) return null;
  return prisma.contacto.findFirst({
    where: { id: contactoId, cliente_id: clienteId },
    select: { id: true },
  });
}

// ── PATCH /api/clientes/:id/contactos/:contactoId ───────────────
// Edita el contacto compartido. { es_principal: true } lo promueve a principal.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactoId: string }> }
) {
  const { id, contactoId } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!(await contactoEnScope(session, id, contactoId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (body.nombre !== undefined || body.email !== undefined || body.telefono !== undefined ||
          body.whatsapp !== undefined || body.cargo !== undefined) {
        const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
        if (body.nombre !== undefined && !nombre) throw new ContactoError("El nombre no puede estar vacío");
        await editarContacto(tx, contactoId, {
          nombre: nombre || (await tx.contacto.findUniqueOrThrow({ where: { id: contactoId }, select: { nombre: true } })).nombre,
          email: typeof body.email === "string" ? body.email : null,
          telefono: typeof body.telefono === "string" ? body.telefono : null,
          whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : null,
          cargo: typeof body.cargo === "string" ? body.cargo : null,
        });
      }
      if (body.es_principal === true) await marcarPrincipal(tx, id, contactoId);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ContactoError) return NextResponse.json({ error: err.message }, { status: 409 });
    logger.error("Error al editar contacto", "PATCH /api/clientes/:id/contactos/:contactoId", err);
    return NextResponse.json({ error: "Error al editar el contacto" }, { status: 500 });
  }
}

// ── DELETE /api/clientes/:id/contactos/:contactoId ──────────────
// Soft-delete (activo=false). Bloquea si es el único contacto del cliente.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactoId: string }> }
) {
  const { id, contactoId } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!(await contactoEnScope(session, id, contactoId))) {
    return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  }

  try {
    await prisma.$transaction((tx) => desactivarContacto(tx, contactoId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ContactoError) return NextResponse.json({ error: err.message }, { status: 409 });
    logger.error("Error al eliminar contacto", "DELETE /api/clientes/:id/contactos/:contactoId", err);
    return NextResponse.json({ error: "Error al eliminar el contacto" }, { status: 500 });
  }
}
