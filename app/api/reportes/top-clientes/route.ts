export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TopClienteItem } from "@/types/reportes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmountMxn } from "@/lib/net-amounts";
import { buildDateOrFilters, getAllParam, parseNumberList } from "@/lib/filter-utils";

// ── GET /api/reportes/top-clientes ────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ano = parseNumberList(getAllParam(sp, "ano"));
  const q = parseNumberList(getAllParam(sp, "q")).filter((value) => value >= 1 && value <= 4);
  const mes = parseNumberList(getAllParam(sp, "mes")).filter((value) => value >= 1 && value <= 12);
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 10;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (ano.length || q.length || mes.length) {
    where.OR = buildDateOrFilters({ ano, q, mes }).flatMap((range) => [
      { fecha_venta: range },
      { estatus: { not: "VENTA" }, fecha_venta: null, created_at: range },
    ]);
  }

  try {
    const ordenes = await prisma.ordenVenta.findMany({
      where: scopeOrdenWhere(session, where),
      select: {
        estatus: true,
        moneda: true,
        tipo_cambio: true,
        subtotal_con_descuento: true,
        cliente: { select: { id: true, nombre: true } },
      },
    });

    // Agrupar por cliente
    const map = new Map<string, TopClienteItem>();
    for (const o of ordenes) {
      const key = o.cliente.id;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          cliente_id: key,
          nombre: o.cliente.nombre,
          ordenes_totales: 1,
          ordenes_venta: o.estatus === "VENTA" ? 1 : 0,
          total_mxn: o.estatus === "VENTA" ? netAmountMxn(o) : 0,
        });
      } else {
        existing.ordenes_totales += 1;
        if (o.estatus === "VENTA") {
          existing.ordenes_venta += 1;
          existing.total_mxn += netAmountMxn(o);
        }
      }
    }

    // Ordenar por total_mxn DESC y tomar los top N
    const resultado: TopClienteItem[] = Array.from(map.values())
      .filter((c) => c.ordenes_venta > 0)
      .sort((a, b) => b.total_mxn - a.total_mxn)
      .slice(0, limit);

    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: "Error al obtener top clientes" }, { status: 500 });
  }
}
