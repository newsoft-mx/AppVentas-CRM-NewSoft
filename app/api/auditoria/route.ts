export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import type { CambioCampo, EntidadAuditable } from "@/lib/auditoria";

// GET /api/auditoria — lectura de la bitácora (append-only: no hay POST/PUT/DELETE acá;
// las entradas las escribe el propio módulo al mutar).
//
// Dos usos, con visibilidad distinta (decisión de negocio):
//  · ?entidad=orden_venta&entidad_id=<id> → bitácora de UNA ficha: la ve cualquier usuario
//    autenticado que pueda ver la ficha (si gestión o ventas entran a una orden, deben ver
//    qué se modificó).
//  · sin entidad_id → vista GLOBAL de todos los módulos: solo ADMIN.

export interface AuditoriaItem {
  id: string;
  entidad: string;
  entidad_id: string;
  accion: string;
  etiqueta: string | null;
  autor: string;
  cambios: CambioCampo[];
  created_at: string;
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const entidad = req.nextUrl.searchParams.get("entidad") as EntidadAuditable | null;
  const entidadId = req.nextUrl.searchParams.get("entidad_id");
  const limite = Math.min(Number(req.nextUrl.searchParams.get("limite") ?? 50) || 50, 200);

  // La vista global (sin ficha concreta) es solo de ADMIN.
  if (!entidadId && !isAdmin(session)) {
    return NextResponse.json({ error: "Solo un administrador puede ver la bitácora global" }, { status: 403 });
  }

  const registros = await prisma.auditoriaLog.findMany({
    where: {
      ...(entidad ? { entidad } : {}),
      ...(entidadId ? { entidad_id: entidadId } : {}),
    },
    orderBy: { created_at: "desc" },
    take: limite,
    select: {
      id: true, entidad: true, entidad_id: true, accion: true,
      etiqueta: true, autor: true, cambios: true, created_at: true,
    },
  });

  const items: AuditoriaItem[] = registros.map((r) => ({
    ...r,
    cambios: (r.cambios as unknown as CambioCampo[]) ?? [],
    created_at: r.created_at.toISOString(),
  }));
  return NextResponse.json(items);
}
