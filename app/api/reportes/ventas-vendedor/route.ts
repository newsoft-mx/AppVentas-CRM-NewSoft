export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmountMxn } from "@/lib/net-amounts";
import type { VentasVendedorItem } from "@/types/reportes";
import { buildDateOrFilters, getAllParam, parseNumberList } from "@/lib/filter-utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ano = parseNumberList(getAllParam(sp, "ano"));
  const q = parseNumberList(getAllParam(sp, "q")).filter((value) => value >= 1 && value <= 4);
  const mes = parseNumberList(getAllParam(sp, "mes")).filter((value) => value >= 1 && value <= 12);

  const where = scopeOrdenWhere(session, {
    estatus: "VENTA" as const,
    OR: buildDateOrFilters({ ano, q, mes }).map((range) => ({ fecha_venta: range })),
  });

  try {
    const ordenes = await prisma.ordenVenta.findMany({
      where,
      select: {
        moneda: true,
        tipo_cambio: true,
        subtotal_con_descuento: true,
        vendedor: { select: { id: true, nombre: true } },
      },
    });

    const map = new Map<string, VentasVendedorItem>();
    for (const orden of ordenes) {
      const key = orden.vendedor?.id ?? "sin-vendedor";
      const current = map.get(key) ?? {
        vendedor_id: orden.vendedor?.id ?? null,
        vendedor: orden.vendedor?.nombre ?? "Sin vendedor",
        ordenes_venta: 0,
        total_mxn: 0,
      };
      current.ordenes_venta += 1;
      current.total_mxn += netAmountMxn(orden);
      map.set(key, current);
    }

    return NextResponse.json(Array.from(map.values()).sort((a, b) => b.total_mxn - a.total_mxn));
  } catch {
    return NextResponse.json({ error: "Error al obtener ventas por vendedor" }, { status: 500 });
  }
}
