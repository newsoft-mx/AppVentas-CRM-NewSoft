export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { TipoCatalogoDeal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearDealTx, HttpError } from "@/lib/deals";
import { leadWebSchema } from "@/lib/validations/leads";
import { logger } from "@/lib/logger";

// Intake público de leads desde el formulario del sitio web.
// POST /api/public/leads  (SIN sesión). Crea un prospecto + contacto + deal en la
// primera etapa, canal "Web" / origen "Formulario web", asignado al buzón fijo
// (CrmConfig.vendedor_leads_web_id) o sin asignar. Defensa: API key + honeypot + CORS.

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

async function getOrCreateCatalogo(tipo: TipoCatalogoDeal, nombre: string) {
  return prisma.catalogoDeal.upsert({
    where: { tipo_nombre: { tipo, nombre } },
    create: { tipo, nombre },
    update: {},
    select: { id: true },
  });
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

  // 3) Validación del payload.
  const parsed = leadWebSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message }));
    return json({ error: "Datos inválidos", details }, 422);
  }
  const d = parsed.data;

  try {
    // Primera etapa del pipeline (por orden) = donde entra un lead nuevo.
    const stage = await prisma.pipelineStage.findFirst({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true },
    });
    if (!stage) return json({ error: "Pipeline sin etapas configuradas" }, 503);

    const [cfg, canal, origen] = await Promise.all([
      prisma.crmConfig.findUnique({ where: { id: "crm" }, select: { vendedor_leads_web_id: true } }),
      getOrCreateCatalogo("CANAL", "Web"),
      getOrCreateCatalogo("ORIGEN", "Formulario web"),
    ]);

    // Empresa: la del form o, si no vino, el nombre del contacto (para no dejar el prospecto sin nombre).
    const empresa = d.empresa || d.nombre;
    const website = d.website
      ? (/^https?:\/\//i.test(d.website) ? d.website : `https://${d.website}`).slice(0, 255)
      : null;

    await prisma.$transaction((tx) =>
      crearDealTx(tx, {
        nombre: `Lead web — ${empresa}`,
        prospecto: { nombre: empresa, website },
        contacto: { nombre: d.nombre, email: d.email, telefono: d.telefono },
        contactoRol: "OTRO",
        stage_id: stage.id,
        vendedor_id: cfg?.vendedor_leads_web_id ?? null,
        canal_id: canal.id,
        origen_id: origen.id,
        notas: d.mensaje,
      })
    );

    return json({ ok: true }, 201);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    logger.error("Error al crear lead web", "POST /api/public/leads", err);
    return json({ error: "Error al registrar el lead" }, 500);
  }
}
