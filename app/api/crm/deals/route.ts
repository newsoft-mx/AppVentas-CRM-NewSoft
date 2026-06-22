import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import type { DealResumen, Temperatura } from "@/types/crm";

export const dynamic = "force-dynamic";

const TEMPERATURAS = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── POST /api/crm/deals ─────────────────────────────────────────
// Crea un nuevo deal (prospecto) en el pipeline.
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  const stage_id = typeof body.stage_id === "string" ? body.stage_id : "";
  const temperatura = TEMPERATURAS.includes(body.temperatura as string)
    ? (body.temperatura as Temperatura)
    : "TIBIO";

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio", campo: "nombre" }, { status: 422 });
  if (!cliente_id) return NextResponse.json({ error: "El cliente es obligatorio", campo: "cliente_id" }, { status: 422 });
  if (!stage_id) return NextResponse.json({ error: "La etapa es obligatoria", campo: "stage_id" }, { status: 422 });

  try {
    // Validar FKs (cliente activo, stage activo)
    const [cliente, stage] = await Promise.all([
      prisma.cliente.findFirst({ where: { id: cliente_id, activo: true }, select: { id: true } }),
      prisma.pipelineStage.findFirst({ where: { id: stage_id, activo: true }, select: { id: true, probabilidad_base: true } }),
    ]);
    if (!cliente) return NextResponse.json({ error: "Cliente inválido", campo: "cliente_id" }, { status: 422 });
    if (!stage) return NextResponse.json({ error: "Etapa inválida", campo: "stage_id" }, { status: 422 });

    // Probabilidad automática: deriva de la etapa (no se captura a mano)
    const probabilidad = stage.probabilidad_base;
    const fechaCierre = typeof body.fecha_cierre_estimada === "string" && body.fecha_cierre_estimada
      ? new Date(body.fecha_cierre_estimada) : null;

    const deal = await prisma.deal.create({
      data: {
        nombre,
        cliente_id,
        stage_id,
        vendedor_id: typeof body.vendedor_id === "string" && body.vendedor_id ? body.vendedor_id : null,
        tipo_cotizacion_id: typeof body.tipo_cotizacion_id === "string" && body.tipo_cotizacion_id ? body.tipo_cotizacion_id : null,
        temperatura,
        probabilidad: probabilidad != null ? Math.min(100, Math.max(0, Math.round(probabilidad))) : null,
        moneda: body.moneda === "USD" ? "USD" : "MXN",
        valor: num(body.valor) ?? 0,
        setup: num(body.setup),
        mensualidad: num(body.mensualidad),
        meses: num(body.meses) != null ? Math.round(num(body.meses)!) : null,
        canal: typeof body.canal === "string" && body.canal.trim() ? body.canal.trim() : null,
        origen: typeof body.origen === "string" && body.origen.trim() ? body.origen.trim() : null,
        fecha_cierre_estimada: fechaCierre,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
      },
    });

    const resumen: DealResumen = {
      id: deal.id,
      nombre: deal.nombre,
      valor: Number(deal.valor),
      moneda: deal.moneda,
      temperatura: deal.temperatura as Temperatura,
      probabilidad: deal.probabilidad,
      resultado: deal.resultado,
      stage_id: deal.stage_id,
      dias_en_etapa: 0,
      cliente: deal.cliente ? { id: deal.cliente.id, nombre: deal.cliente.nombre } : null,
      vendedor: deal.vendedor ? { id: deal.vendedor.id, nombre: deal.vendedor.nombre } : null,
      tipo: deal.tipo_cotizacion ? { id: deal.tipo_cotizacion.id, nombre: deal.tipo_cotizacion.nombre } : null,
    };

    return NextResponse.json(resumen, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el deal" }, { status: 500 });
  }
}
