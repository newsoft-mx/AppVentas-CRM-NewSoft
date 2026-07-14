import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeClienteWhere } from "@/lib/access-control";
import { crearOEncontrarContacto, crearContactoPrincipal, marcarPrincipal } from "@/lib/contactos";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Verifica que el cliente existe y está en el scope del usuario (evita IDOR).
async function clienteEnScope(session: Parameters<typeof scopeClienteWhere>[0], id: string) {
  return prisma.cliente.findFirst({ where: scopeClienteWhere(session, { id }), select: { id: true } });
}

// ── GET /api/clientes/:id/contactos ─────────────────────────────
// Lista los contactos activos del cliente (el principal primero).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await clienteEnScope(session, id))) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  const contactos = await prisma.contacto.findMany({
    where: { cliente_id: id, activo: true },
    orderBy: [{ es_principal: "desc" }, { created_at: "asc" }],
    select: { id: true, nombre: true, email: true, telefono: true, whatsapp: true, cargo: true, es_principal: true },
  });
  return NextResponse.json({ contactos });
}

// ── POST /api/clientes/:id/contactos ────────────────────────────
// Crea (o reutiliza) un contacto del cliente. { es_principal: true } lo deja como principal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!(await clienteEnScope(session, id))) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio", campo: "nombre" }, { status: 422 });
  if (nombre.length > 150) return NextResponse.json({ error: "Nombre demasiado largo", campo: "nombre" }, { status: 422 });

  const datos = {
    nombre,
    email: typeof body.email === "string" ? body.email : null,
    telefono: typeof body.telefono === "string" ? body.telefono : null,
    whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : null,
    cargo: typeof body.cargo === "string" ? body.cargo : null,
  };
  const quierePrincipal = body.es_principal === true;

  try {
    const contacto = await prisma.$transaction(async (tx) => {
      // ¿El cliente ya tiene algún contacto? (para saber si este es el primer principal)
      const existePrincipal = await tx.contacto.count({ where: { cliente_id: id, es_principal: true, activo: true } });
      const c =
        quierePrincipal && existePrincipal === 0
          ? await crearContactoPrincipal(tx, id, datos)
          : await crearOEncontrarContacto(tx, id, datos);
      if (quierePrincipal && existePrincipal > 0) await marcarPrincipal(tx, id, c.id);
      return c;
    });
    return NextResponse.json({ contacto }, { status: 201 });
  } catch (err) {
    logger.error("Error al crear contacto", "POST /api/clientes/:id/contactos", err);
    return NextResponse.json({ error: "Error al crear el contacto" }, { status: 500 });
  }
}
