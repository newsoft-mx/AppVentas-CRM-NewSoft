export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { clienteUpdateSchema } from "@/lib/validations/clientes";
import { canManageClients, requireAuth } from "@/lib/session";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";

// GET /api/clientes/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Un VENDEDOR sin ficha no tiene clientes propios.
  if (session.rol === "VENDEDOR" && !session.vendedorId) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Scoping: el VENDEDOR solo accede a SUS clientes (con órdenes/deals suyos).
  const where: Prisma.ClienteWhereInput =
    session.rol === "VENDEDOR"
      ? {
          id,
          OR: [
            { ordenes: { some: { vendedor_id: session.vendedorId! } } },
            { deals: { some: { vendedor_id: session.vendedorId! } } },
          ],
        }
      : { id };

  try {
    const cliente = await prisma.cliente.findFirst({
      where,
      include: {
        condicion_pago: {
          select: { id: true, nombre: true, dias_credito: true },
        },
        ordenes: {
          select: { moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
        },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const { ordenes, ...c } = cliente;
    const mxnOrdenes = ordenes.filter((o) => o.moneda === "MXN");
    const usdOrdenes = ordenes.filter((o) => o.moneda === "USD");

    return NextResponse.json({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      stats: {
        num_ordenes: ordenes.length,
        total_mxn: mxnOrdenes.reduce((s, o) => s + netAmount(o), 0),
        total_usd: usdOrdenes.reduce((s, o) => s + netAmount(o), 0),
        grand_total_mxn: ordenes.reduce((s, o) => s + netAmountMxn(o), 0),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    );
  }
}

// PUT /api/clientes/:id
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const validation = clienteUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: validation.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Verificar RFC único excluyendo este registro, solo si se capturó
    const rfcExistente = validation.data.rfc
      ? await prisma.cliente.findFirst({
          where: {
            rfc: validation.data.rfc,
            NOT: { id },
          },
        })
      : null;

    if (rfcExistente) {
      return NextResponse.json(
        { error: "Ya existe un cliente con ese RFC", campo: "rfc" },
        { status: 409 }
      );
    }

    // Verificar condición de pago válida
    const condicion = await prisma.condicionComercial.findFirst({
      where: { id: validation.data.condicion_pago_id, activo: true },
    });

    if (!condicion) {
      return NextResponse.json(
        { error: "Condición de pago no válida", campo: "condicion_pago_id" },
        { status: 400 }
      );
    }

    const updated = await prisma.cliente.update({
      where: { id },
      data: validation.data as Parameters<typeof prisma.cliente.update>[0]["data"],
      include: {
        condicion_pago: {
          select: { id: true, nombre: true, dias_credito: true },
        },
        ordenes: {
          select: { moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
        },
      },
    });

    const { ordenes, ...c } = updated as typeof updated & {
      ordenes: Array<{
        moneda: string;
        tipo_cambio: { toNumber(): number } | null;
        subtotal_con_descuento: { toNumber(): number };
      }>;
    };
    const mxnOrdenes = ordenes.filter((o) => o.moneda === "MXN");
    const usdOrdenes = ordenes.filter((o) => o.moneda === "USD");

    return NextResponse.json({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      stats: {
        num_ordenes: ordenes.length,
        total_mxn: mxnOrdenes.reduce((s, o) => s + netAmount(o), 0),
        total_usd: usdOrdenes.reduce((s, o) => s + netAmount(o), 0),
        grand_total_mxn: ordenes.reduce((s, o) => s + netAmountMxn(o), 0),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    );
  }
}
