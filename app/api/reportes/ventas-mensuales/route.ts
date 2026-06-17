export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { VentasMensualesData, MesVenta } from "@/types/reportes";
import { requireAuth, type SessionPayload } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";
import { netAmountMxn } from "@/lib/net-amounts";
import { buildDateOrFilters, getAllParam, parseNumberList, selectedMonths } from "@/lib/filter-utils";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

async function getVentasPorMes(filtros: { ano: number[]; q: number[]; mes: number[] }, session: SessionPayload) {
  const ordenes = await prisma.ordenVenta.findMany({
    where: scopeOrdenWhere(session, {
      estatus: "VENTA",
      OR: buildDateOrFilters(filtros).map((range) => ({ fecha_venta: range })),
    }),
    select: { fecha_venta: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
  });

  // Inicializar los 12 meses en 0
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: 0 }));
  for (const o of ordenes) {
    const m = new Date(o.fecha_venta!).getUTCMonth(); // 0-indexed
    porMes[m].total += netAmountMxn(o);
  }
  return porMes;
}

// ── GET /api/reportes/ventas-mensuales ────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ano = parseNumberList(getAllParam(sp, "ano"));
  const q = parseNumberList(getAllParam(sp, "q")).filter((value) => value >= 1 && value <= 4);
  const mes = parseNumberList(getAllParam(sp, "mes")).filter((value) => value >= 1 && value <= 12);
  const years = ano.length ? [...ano].sort((a, b) => b - a) : [new Date().getFullYear()];
  const year = years[0];
  const comparisonYear = years[1] ?? year - 1;

  try {
    const [porMesActual, porMesAnterior] = await Promise.all([
      getVentasPorMes({ ano: [year], q, mes }, session),
      getVentasPorMes({ ano: [comparisonYear], q, mes }, session),
    ]);

    const data: MesVenta[] = selectedMonths({ q, mes }).map((month) => ({
      mes: month,
      nombre: MESES[month - 1],
      actual: porMesActual[month - 1]?.total ?? 0,
      anterior: porMesAnterior[month - 1]?.total ?? 0,
    }));

    const result: VentasMensualesData = {
      data,
      ano_actual: year,
      ano_anterior: comparisonYear,
      total_actual: data.reduce((s, d) => s + d.actual, 0),
      total_anterior: data.reduce((s, d) => s + d.anterior, 0),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener ventas mensuales" }, { status: 500 });
  }
}
