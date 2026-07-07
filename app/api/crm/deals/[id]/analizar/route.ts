import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo configurable por entorno (decisión: claude-opus-4-8 ↔ claude-sonnet-4-6)
const MODELO = process.env.CRM_AI_MODEL ?? "claude-opus-4-8";

const SYSTEM = (contexto: string) => `Eres un asistente de ventas B2B experto. Analizas transcripts de conversaciones con clientes y entregas inteligencia accionable para cerrar deals.

Contexto del deal:
${contexto}

Responde ÚNICAMENTE con JSON válido (sin texto adicional, sin backticks) con esta estructura EXACTA. El array "acciones" debe tener EXACTAMENTE 3 elementos:
{
  "acciones": [
    {"texto": "acción concreta y específica", "urgencia": "alta|media|baja"}
  ],
  "objeciones": [
    {"tipo": "precio|integracion|tiempo|otro", "cita": "frase o paráfrasis del cliente", "respuesta_sugerida": "cómo responder"}
  ],
  "riesgo": {
    "nivel": "bajo|medio|alto",
    "porcentaje": 0,
    "senales": [
      {"tipo": "rojo|amarillo|verde", "texto": "descripción de la señal"}
    ]
  }
}`;

// ── POST /api/crm/deals/:id/analizar ────────────────────────────
// Copiloto de IA: analiza un transcript y devuelve 3 acciones + objeciones
// + señales de riesgo. La llamada a Claude ocurre SIEMPRE en el servidor.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "IA no configurada (falta ANTHROPIC_API_KEY)" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const transcript = (body as { transcript?: string })?.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "Transcript requerido", campo: "transcript" }, { status: 422 });
  }

  // Contexto del deal (datos + bitácora reciente) para mejor análisis
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      stage: { select: { nombre: true } },
      tipo_cotizacion: { select: { nombre: true } },
      actividades: { orderBy: { created_at: "desc" }, take: 5, select: { tipo: true, contenido: true } },
    },
  });
  if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

  const contexto = [
    `Deal: ${deal.nombre}`,
    `Cliente: ${deal.cliente?.nombre ?? "—"}`,
    `Etapa: ${deal.stage?.nombre ?? "—"}`,
    `Tipo: ${deal.tipo_cotizacion?.nombre ?? "—"}`,
    `Monto: ${Number(deal.valor).toLocaleString("es-MX")} ${deal.moneda}`,
    deal.actividades.length
      ? `Bitácora reciente:\n${deal.actividades.map((a) => `- [${a.tipo}] ${a.contenido}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system: SYSTEM(contexto),
      messages: [{ role: "user", content: `Analiza este transcript:\n\n${transcript}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA declinó analizar este contenido" }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Respuesta de IA no parseable" }, { status: 502 });
    }

    // Persistir el análisis (histórico)
    await prisma.dealAnalisisIA.create({
      data: { deal_id: id, transcript, resultado: result as object, modelo: MODELO },
    });

    return NextResponse.json({ ...(result as object), modelo: MODELO });
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `IA: ${err.message}` : "Error al analizar con la IA";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
