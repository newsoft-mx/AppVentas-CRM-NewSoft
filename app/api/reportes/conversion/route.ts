export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ConversionTipoItem, ReporteStats } from "@/types/reportes";
import { requireAuth } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmountMxn } from "@/lib/net-amounts";
import { buildDateOrFilters, getAllParam, parseNumberList } from "@/lib/filter-utils";

// ── GET /api/reportes/conversion ──────────────────────────────
// Devuelve conversión por tipo + stats adicionales (ticket promedio, tiempo cierre)

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ano = parseNumberList(getAllParam(sp, "ano"));
  const q = parseNumberList(getAllParam(sp, "q")).filter((value) => value >= 1 && value <= 4);
  const mes = parseNumberList(getAllParam(sp, "mes")).filter((value) => value >= 1 && value <= 12);

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
        created_at: true,
        fecha_venta: true,
        tipo_cotizacion: { select: { id: true, nombre: true } },
      },
    });

    // ── Conversión por tipo de cotización ──
    const tipoMap = new Map<string, { nombre: string; total: number; ventas: number; cotizadas: number }>();

    for (const o of ordenes) {
      const id = o.tipo_cotizacion.id;
      const existing = tipoMap.get(id);
      if (!existing) {
        tipoMap.set(id, {
          nombre: o.tipo_cotizacion.nombre,
          total: 1,
          ventas: o.estatus === "VENTA" ? 1 : 0,
          cotizadas: o.estatus === "COTIZADO" ? 1 : 0,
        });
      } else {
        existing.total += 1;
        if (o.estatus === "VENTA") existing.ventas += 1;
        if (o.estatus === "COTIZADO") existing.cotizadas += 1;
      }
    }

    const conversion: ConversionTipoItem[] = Array.from(tipoMap.entries())
      .map(([tipo_id, d]) => ({
        tipo_id,
        tipo: d.nombre,
        total: d.total,
        ventas: d.ventas,
        cotizadas: d.cotizadas,
        tasa: d.total > 0 ? Math.round((d.ventas / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.tasa - a.tasa);

    // ── KPIs adicionales ──
    const ventas = ordenes.filter((o) => o.estatus === "VENTA");
    const cotizadas = ordenes.filter((o) => o.estatus === "COTIZADO");

    const ticket_promedio_mxn =
      ventas.length > 0
        ? ventas.reduce((s, o) => s + netAmountMxn(o), 0) / ventas.length
        : 0;

    // Tiempo promedio de cierre: días entre created_at y fecha_venta
    const ventasConFecha = ventas.filter((o) => o.fecha_venta != null);
    let tiempo_promedio_cierre_dias: number | null = null;
    if (ventasConFecha.length > 0) {
      const totalDias = ventasConFecha.reduce((s, o) => {
        const dias =
          (new Date(o.fecha_venta!).getTime() - new Date(o.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        return s + Math.max(0, Math.round(dias));
      }, 0);
      tiempo_promedio_cierre_dias = Math.round(totalDias / ventasConFecha.length);
    }

    const stats: ReporteStats = {
      ticket_promedio_mxn,
      tiempo_promedio_cierre_dias,
      total_ventas: ventas.length,
      total_cotizadas: cotizadas.length,
    };

    return NextResponse.json({ conversion, stats });
  } catch {
    return NextResponse.json({ error: "Error al obtener conversión" }, { status: 500 });
  }
}
