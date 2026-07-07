export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCrmConfig } from "@/lib/crm-config";

// GET /api/configuracion/crm-config — parámetros del termómetro / atención
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  return NextResponse.json(await getCrmConfig());
}

// PUT /api/configuracion/crm-config — actualizar parámetros (upsert del singleton)
export async function PUT(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (body.umbral_inactividad_dias !== undefined && Number.isFinite(Number(body.umbral_inactividad_dias))) {
      data.umbral_inactividad_dias = Math.max(1, Math.round(Number(body.umbral_inactividad_dias)));
    }
    if (body.avance_modo === "SUGERIR" || body.avance_modo === "AUTOMATICO") {
      data.avance_modo = body.avance_modo;
    }
    if (body.enfriamiento_nivel !== undefined && Number.isFinite(Number(body.enfriamiento_nivel))) {
      data.enfriamiento_nivel = Math.max(0, Math.round(Number(body.enfriamiento_nivel)));
    }
    // puntos_actividad: solo claves de TipoActividad y valores enteros acotados [0,5].
    // Evita claves arbitrarias / valores fuera de rango en la config global del termómetro.
    if (body.puntos_actividad && typeof body.puntos_actividad === "object" && !Array.isArray(body.puntos_actividad)) {
      const TIPOS_VALIDOS = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP"];
      const saneado: Record<string, number> = {};
      for (const tipo of TIPOS_VALIDOS) {
        const v = Number((body.puntos_actividad as Record<string, unknown>)[tipo]);
        if (Number.isFinite(v)) saneado[tipo] = Math.max(0, Math.min(5, Math.round(v)));
      }
      data.puntos_actividad = saneado;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const row = await prisma.crmConfig.upsert({
      where: { id: "crm" },
      update: data,
      create: { id: "crm", ...data },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
  }
}
