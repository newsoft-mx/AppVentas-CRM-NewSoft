export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/deals";
import { registrarLead } from "@/lib/leads-intake";
import { leadWebSchema } from "@/lib/validations/leads";
import { logger } from "@/lib/logger";

// Adaptador de intake para el FORMULARIO WEB propio.
// POST /api/public/leads  (SIN sesión). Valida el payload web y delega en registrarLead
// (lib/leads-intake) con la fuente Web. Defensa: API key + honeypot + CORS.
// Otras fuentes (Meta, etc.) son otro adaptador que llama al mismo registrarLead.

// Allowlist de orígenes (CORS) por env, coma-separada. Vacío → se refleja el Origin
// que llega (la API key sigue siendo el gate real).
function corsHeaders(origin: string | null): Record<string, string> {
  const allow = (process.env.LEADS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const permitido = origin && (allow.length === 0 || allow.includes(origin)) ? origin : allow[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

// Preflight del navegador (cuando el form postea desde el browser directo).
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: cors });

  // 1) API key (fail-closed: si no está configurada, se rechaza todo).
  const apiKey = req.headers.get("x-api-key");
  if (!process.env.LEADS_API_KEY || apiKey !== process.env.LEADS_API_KEY) {
    return json({ error: "No autorizado" }, 401);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // 2) Honeypot: un bot llena el campo oculto `_hp`. Fingimos éxito (201) sin crear nada.
  if (typeof body?._hp === "string" && body._hp.trim() !== "") {
    return json({ ok: true }, 201);
  }

  // 3) Validación del payload web.
  const parsed = leadWebSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message }));
    return json({ error: "Datos inválidos", details }, 422);
  }

  try {
    const { deal, avisos } = await registrarLead(parsed.data, { canal: "Web", origen: "Formulario web" });
    // Devolvemos el id (para conciliar del lado de la fuente) y los avisos de campos blandos
    // que se ignoraron (no son errores: el lead se creó igual).
    return json({ ok: true, id: deal.id, ...(avisos.length ? { avisos } : {}) }, 201);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    logger.error("Error al crear lead web", "POST /api/public/leads", err);
    return json({ error: "Error al registrar el lead" }, 500);
  }
}
