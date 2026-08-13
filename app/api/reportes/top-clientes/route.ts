export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TopClienteItem } from "@/types/reportes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { rankingClientes } from "@/lib/ranking-clientes";
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

    // El agrupado vive en lib/ranking-clientes: esta misma respuesta la produce también
    // /reportes en el server, y antes eran dos copias que podían dar números distintos.
    const resultado: TopClienteItem[] = rankingClientes(ordenes, limit).map((g) => ({
      cliente_id: g.cliente_id,
      nombre: g.nombre,
      ordenes_totales: g.ordenes_totales,
      ordenes_venta: g.ordenes_venta,
      total_mxn: g.facturado_mxn,
    }));

    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: "Error al obtener top clientes" }, { status: 500 });
  }
}
