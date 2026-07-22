export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getScoringConfig } from "@/lib/crm-config";
import { diffCampos, registrarAuditoria } from "@/lib/auditoria";

// GET /api/configuracion/crm-config — parámetros del motor de scoring
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const scoring = await getScoringConfig();
  const row = await prisma.crmConfig.findUnique({
    where: { id: "crm" },
    select: { avance_modo: true, vendedor_leads_web_id: true },
  });
  return NextResponse.json({
    ...scoring,
    avance_modo: row?.avance_modo ?? "SUGERIR",
    vendedor_leads_web_id: row?.vendedor_leads_web_id ?? null,
  });
}

// PUT /api/configuracion/crm-config — actualizar parámetros del scoring (upsert del singleton)
export async function PUT(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (body.avance_modo === "SUGERIR" || body.avance_modo === "AUTOMATICO") data.avance_modo = body.avance_modo;
    // Buzón de leads web: vendedor_id o null (sin asignar).
    if (body.vendedor_leads_web_id !== undefined) {
      const v = body.vendedor_leads_web_id;
      data.vendedor_leads_web_id = typeof v === "string" && v ? v : null;
    }
    if (Number.isFinite(Number(body.umbral_inactividad_dias)))
      data.umbral_inactividad_dias = Math.max(1, Math.round(Number(body.umbral_inactividad_dias)));
    if (Number.isFinite(Number(body.score_inicial)))
      data.score_inicial = Math.max(0, Math.min(100, Math.round(Number(body.score_inicial))));
    if (Number.isFinite(Number(body.decay_por_dia)))
      data.decay_por_dia = Math.max(0, Math.round(Number(body.decay_por_dia)));
    if (Number.isFinite(Number(body.sensibilidad_prob)))
      data.sensibilidad_prob = Math.max(0, Math.min(5, Math.round(Number(body.sensibilidad_prob) * 100) / 100));
    // niveles_umbral: 4 cortes crecientes en [1..99]
    if (Array.isArray(body.niveles_umbral) && body.niveles_umbral.length === 4) {
      const cortes = body.niveles_umbral.map((n: unknown) => Math.max(1, Math.min(99, Math.round(Number(n)))));
      const ok = cortes.every((n: number) => Number.isFinite(n)) && cortes[0] < cortes[1] && cortes[1] < cortes[2] && cortes[2] < cortes[3];
      if (!ok) return NextResponse.json({ error: "Los cortes de nivel deben ser 4 valores crecientes (1-99)" }, { status: 422 });
      data.niveles_umbral = cortes;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    // "Antes" completo para la bitácora: cambiar estos parámetros cambia el comportamiento
    // del sistema para todos, así que queda el rastro de quién los tocó.
    const previo = await prisma.crmConfig.findUnique({ where: { id: "crm" } });

    await prisma.crmConfig.upsert({ where: { id: "crm" }, update: data, create: { id: "crm", ...data } });

    const actual = await prisma.crmConfig.findUnique({ where: { id: "crm" } });
    await registrarAuditoria({
      entidad: "configuracion",
      entidad_id: "crm",
      accion: "EDITAR",
      etiqueta: "Parámetros del CRM",
      autor: session.email,
      user_id: session.userId,
      // Solo se comparan las claves que el PUT tocó (data), contra la lista blanca.
      cambios: diffCampos(
        "configuracion",
        (previo ?? {}) as Record<string, unknown>,
        Object.fromEntries(Object.keys(data).map((k) => [k, (actual as Record<string, unknown> | null)?.[k]]))
      ),
    });

    const scoring = await getScoringConfig();
    const row = await prisma.crmConfig.findUnique({
      where: { id: "crm" },
      select: { avance_modo: true, vendedor_leads_web_id: true },
    });
    return NextResponse.json({
      ...scoring,
      avance_modo: row?.avance_modo ?? "SUGERIR",
      vendedor_leads_web_id: row?.vendedor_leads_web_id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
  }
}
