import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, canManageClients } from "@/lib/session";
import { clienteUpdateSchema } from "@/lib/validations/clientes";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";

export const dynamic = "force-dynamic";

// ── POST /api/clientes/:id/convertir ────────────────────────────
// Convierte un prospecto en Cliente activo (REQ-02): precarga lo capturado y
// completa los datos fiscales faltantes (RFC, ciudad, condición de pago, etc.).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = clienteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
    return NextResponse.json({ error: "Datos inválidos", details }, { status: 422 });
  }

  try {
    const actual = await prisma.cliente.findUnique({ where: { id }, select: { id: true, rfc: true, estatus: true } });
    if (!actual) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    // Solo se convierten prospectos: evita reactivar inactivos o re-mutar clientes ya activos por esta vía.
    if (actual.estatus !== "PROSPECTO") {
      return NextResponse.json({ error: "Solo se puede convertir un prospecto" }, { status: 422 });
    }

    // RFC único (si cambió)
    if (parsed.data.rfc && parsed.data.rfc !== actual.rfc) {
      const dup = await prisma.cliente.findFirst({
        where: { rfc: parsed.data.rfc, id: { not: id } },
        select: { id: true },
      });
      if (dup) return NextResponse.json({ error: "Ya existe un cliente con ese RFC", campo: "rfc" }, { status: 422 });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: { ...parsed.data, estatus: "ACTIVO" },
      include: {
        condicion_pago: { select: { id: true, nombre: true, dias_credito: true } },
        ordenes: { select: { moneda: true, tipo_cambio: true, subtotal_con_descuento: true } },
      },
    });

    const { ordenes, ...c } = cliente;
    const mxn = ordenes.filter((o) => o.moneda === "MXN");
    const usd = ordenes.filter((o) => o.moneda === "USD");
    return NextResponse.json({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      stats: {
        num_ordenes: ordenes.length,
        total_mxn: mxn.reduce((s, o) => s + netAmount(o), 0),
        total_usd: usd.reduce((s, o) => s + netAmount(o), 0),
        grand_total_mxn: ordenes.reduce((s, o) => s + netAmountMxn(o), 0),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al convertir el prospecto" }, { status: 500 });
  }
}
