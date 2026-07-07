import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELO = process.env.CRM_AI_MODEL ?? "claude-opus-4-8";

// ── POST /api/crm/deals/:id/resumen ─────────────────────────────
// Resumen ejecutivo del deal on-demand ("dame un resumen del deal").
// Llamada a Claude server-side; devuelve texto.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "IA no configurada (falta ANTHROPIC_API_KEY)" }, { status: 503 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      stage: { select: { nombre: true } },
      tipo_cotizacion: { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
      actividades: { orderBy: { created_at: "desc" }, take: 10, select: { tipo: true, contenido: true, created_at: true } },
    },
  });
  if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

  const contexto = [
    `Deal: ${deal.nombre}`,
    `Cliente: ${deal.cliente?.nombre ?? "—"}`,
    `Etapa: ${deal.stage?.nombre ?? "—"} · Temperatura: ${deal.temperatura}`,
    `Tipo: ${deal.tipo_cotizacion?.nombre ?? "—"}`,
    `Monto: ${Number(deal.valor).toLocaleString("es-MX")} ${deal.moneda}`,
    `Vendedor: ${deal.vendedor?.nombre ?? "Sin asignar"}`,
    deal.probabilidad != null ? `Probabilidad: ${deal.probabilidad}%` : "",
    deal.actividades.length
      ? `Bitácora:\n${deal.actividades.map((a) => `- [${a.tipo}] ${a.contenido}`).join("\n")}`
      : "Sin actividad registrada.",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 600,
      system:
        "Eres un asistente de ventas. Resume el estado del deal en 4-6 líneas claras para que un vendedor que no lo conoce pueda dar seguimiento de inmediato: dónde está, qué ha pasado y cuál es el siguiente paso lógico. Tono directo, sin relleno.",
      messages: [{ role: "user", content: `Resume este deal:\n\n${contexto}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA declinó generar el resumen" }, { status: 422 });
    }
    const textBlock = response.content.find((b) => b.type === "text");
    const resumen = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    return NextResponse.json({ resumen, modelo: MODELO });
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `IA: ${err.message}` : "Error al generar el resumen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
