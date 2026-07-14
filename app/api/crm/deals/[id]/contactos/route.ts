import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { crearOEncontrarContacto, vincularContactoADeal } from "@/lib/contactos";
import { logger } from "@/lib/logger";
import type { RolContacto } from "@prisma/client";

export const dynamic = "force-dynamic";

const ROLES = ["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"];

// ── POST /api/crm/deals/:id/contactos ───────────────────────────
// Agrega un contacto al deal: por contacto_id existente del cliente, o creando/
// reutilizando uno con los datos provistos. rol es del link (por-deal).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const deal = await prisma.deal.findFirst({
    where: scopeDealWhere(session, { id }),
    select: { id: true, cliente_id: true },
  });
  if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const rol = (ROLES.includes(body.rol as string) ? (body.rol as string) : "OTRO") as RolContacto;
  const contactoIdExistente = typeof body.contacto_id === "string" ? body.contacto_id : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";

  if (!contactoIdExistente && !nombre) {
    return NextResponse.json({ error: "Elegí un contacto o escribí un nombre", campo: "nombre" }, { status: 422 });
  }

  try {
    const link = await prisma.$transaction(async (tx) => {
      let contactoId = contactoIdExistente;
      if (contactoId) {
        // El contacto debe ser del mismo cliente (evita linkear ajenos).
        const c = await tx.contacto.findFirst({
          where: { id: contactoId, cliente_id: deal.cliente_id, activo: true },
          select: { id: true },
        });
        if (!c) throw new Error("CONTACTO_INVALIDO");
      } else {
        const c = await crearOEncontrarContacto(tx, deal.cliente_id, {
          nombre,
          email: typeof body.email === "string" ? body.email : null,
          telefono: typeof body.telefono === "string" ? body.telefono : null,
          whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : null,
          cargo: typeof body.cargo === "string" ? body.cargo : null,
        });
        contactoId = c.id;
      }
      return vincularContactoADeal(tx, id, contactoId, rol);
    });
    return NextResponse.json({ ok: true, link_id: link.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "CONTACTO_INVALIDO") {
      return NextResponse.json({ error: "Contacto inválido", campo: "contacto_id" }, { status: 422 });
    }
    logger.error("Error al agregar contacto al deal", "POST /api/crm/deals/:id/contactos", err);
    return NextResponse.json({ error: "Error al agregar el contacto" }, { status: 500 });
  }
}
