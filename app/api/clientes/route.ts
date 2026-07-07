export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clienteCreateSchema } from "@/lib/validations/clientes";
import { canManageClients, requireAuth } from "@/lib/session";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";

// ── Helper: agrega stats de órdenes por cliente ──────────────
function buildStats(
  ordenes: Array<{
    moneda: string;
    tipo_cambio: { toNumber(): number } | null;
    subtotal_con_descuento: { toNumber(): number };
  }>
) {
  const mxnOrdenes = ordenes.filter((o) => o.moneda === "MXN");
  const usdOrdenes = ordenes.filter((o) => o.moneda === "USD");
  return {
    num_ordenes: ordenes.length,
    total_mxn: mxnOrdenes.reduce((s, o) => s + netAmount(o), 0),
    total_usd: usdOrdenes.reduce((s, o) => s + netAmount(o), 0),
    grand_total_mxn: ordenes.reduce((s, o) => s + netAmountMxn(o), 0),
  };
}

// GET /api/clientes
// Devuelve clientes activos con conteo y montos por moneda
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Filtro opcional por estatus (PROSPECTO / ACTIVO / INACTIVO)
    const estatusParam = req.nextUrl.searchParams.get("estatus");
    const ESTATUS = ["PROSPECTO", "ACTIVO", "INACTIVO"];
    const where: { activo: boolean; estatus?: "PROSPECTO" | "ACTIVO" | "INACTIVO" } = { activo: true };
    if (estatusParam && ESTATUS.includes(estatusParam)) {
      where.estatus = estatusParam as "PROSPECTO" | "ACTIVO" | "INACTIVO";
    }

    const clientes = await prisma.cliente.findMany({
      where,
      include: {
        condicion_pago: {
          select: { id: true, nombre: true, dias_credito: true },
        },
        ordenes: {
          select: { moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
        },
      },
      orderBy: { nombre: "asc" },
    });

    const result = clientes.map(({ ordenes, ...c }) => ({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      stats: buildStats(ordenes),
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const validation = clienteCreateSchema.safeParse(body);

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

    // Verificar RFC único si se capturó (en todos los clientes, activos e inactivos)
    const rfcExistente = validation.data.rfc
      ? await prisma.cliente.findFirst({
          where: { rfc: validation.data.rfc },
        })
      : null;

    if (rfcExistente) {
      return NextResponse.json(
        { error: "Ya existe un cliente con ese RFC", campo: "rfc" },
        { status: 409 }
      );
    }

    // Verificar que la condición de pago exista y esté activa
    const condicion = await prisma.condicionComercial.findFirst({
      where: { id: validation.data.condicion_pago_id, activo: true },
    });

    if (!condicion) {
      return NextResponse.json(
        { error: "Condición de pago no válida", campo: "condicion_pago_id" },
        { status: 400 }
      );
    }

    const nuevo = await prisma.cliente.create({
      data: validation.data as Parameters<typeof prisma.cliente.create>[0]["data"],
      include: {
        condicion_pago: {
          select: { id: true, nombre: true, dias_credito: true },
        },
      },
    });

    return NextResponse.json(
      {
        ...nuevo,
        created_at: nuevo.created_at.toISOString(),
        updated_at: nuevo.updated_at.toISOString(),
        stats: { num_ordenes: 0, total_mxn: 0, total_usd: 0, grand_total_mxn: 0 },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
}
