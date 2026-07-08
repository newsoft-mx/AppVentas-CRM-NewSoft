import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { normalizarPeriodo, desdePeriodo, dealWhereReporte } from "@/lib/reportes-funnel";

export const dynamic = "force-dynamic";

// Tipos de interacción que cuentan para la anatomía (SISTEMA = eventos automáticos, se excluye).
// LLAMADA se muestra como "Reunión/Llamada" en la vista.
const TIPOS = ["LLAMADA", "EMAIL", "WHATSAPP", "NOTA"] as const;

type DealRow = {
  resultado: string;
  created_at: Date;
  fecha_cierre_real: Date | null;
  actividades: { tipo: string }[];
};

function resumen(subset: DealRow[]) {
  const n = subset.length;
  const porTipo: Record<string, number> = Object.fromEntries(TIPOS.map((t) => [t, 0]));
  if (n === 0) return { count: 0, avg_dias: 0, por_tipo: porTipo };

  let diasTotal = 0;
  for (const d of subset) {
    for (const a of d.actividades) {
      if ((TIPOS as readonly string[]).includes(a.tipo)) porTipo[a.tipo]++;
    }
    if (d.fecha_cierre_real) {
      diasTotal += Math.max(0, Math.round((d.fecha_cierre_real.getTime() - d.created_at.getTime()) / 86_400_000));
    }
  }
  const por_tipo: Record<string, number> = Object.fromEntries(
    TIPOS.map((t) => [t, Math.round((porTipo[t] / n) * 10) / 10])
  );
  return { count: n, avg_dias: Math.round((diasTotal / n) * 10) / 10, por_tipo };
}

// ── GET /api/reportes/anatomia?periodo=&vendedor= ───────────────
// Anatomía de conversión: promedio de actividades por deal (por tipo) y días
// al cierre, comparando GANADOS vs PERDIDOS en el periodo.
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
      select: {
        resultado: true,
        created_at: true,
        fecha_cierre_real: true,
        actividades: { select: { tipo: true } },
      },
    });

    return NextResponse.json({
      periodo,
      ganados: resumen(deals.filter((d) => d.resultado === "GANADO")),
      perdidos: resumen(deals.filter((d) => d.resultado === "PERDIDO")),
    });
  } catch {
    return NextResponse.json({ error: "Error al calcular la anatomía" }, { status: 500 });
  }
}
