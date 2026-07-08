import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { normalizarPeriodo, desdePeriodo, dealWhereReporte } from "@/lib/reportes-funnel";

export const dynamic = "force-dynamic";

// ── GET /api/reportes/resultados?periodo=&vendedor= ─────────────
// Ganados vs perdidos (deals cerrados en el periodo) + desglose por razón de pérdida.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const periodo = normalizarPeriodo(sp.get("periodo"));
  const desde = desdePeriodo(periodo, new Date());
  const where = dealWhereReporte(session, sp.get("vendedor"), {
    resultado: { in: ["GANADO", "PERDIDO"] },
    fecha_cierre_real: { gte: desde },
  });

  try {
    const deals = await prisma.deal.findMany({
      where: where as Prisma.DealWhereInput,
      select: { resultado: true, razon_perdida: true },
    });

    const ganados = deals.filter((d) => d.resultado === "GANADO").length;
    const perdidos = deals.filter((d) => d.resultado === "PERDIDO").length;
    const total = ganados + perdidos;

    const razones = new Map<string, number>();
    for (const d of deals) {
      if (d.resultado !== "PERDIDO") continue;
      const r = d.razon_perdida?.trim() || "Sin razón";
      razones.set(r, (razones.get(r) ?? 0) + 1);
    }
    const por_razon = [...razones.entries()]
      .map(([razon, count]) => ({ razon, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      periodo,
      total,
      ganados,
      perdidos,
      tasa_ganados: total > 0 ? Math.round((ganados / total) * 100) : 0,
      por_razon,
    });
  } catch {
    return NextResponse.json({ error: "Error al calcular resultados" }, { status: 500 });
  }
}
