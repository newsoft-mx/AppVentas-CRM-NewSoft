export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/configuracion/tipos-accion — catálogo de tipos de acción (SOL-04)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const tipos = await prisma.tipoAccion.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }] });
  return NextResponse.json(tipos);
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const b = (body ?? {}) as { nombre?: unknown; color?: unknown; agendable?: unknown; con_resultado?: unknown; peso?: unknown };
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 422 });
  const max = await prisma.tipoAccion.aggregate({ _max: { orden: true } });
  const nuevo = await prisma.tipoAccion.create({
    data: {
      nombre,
      color: typeof b.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.color) ? b.color : "#6B7A99",
      agendable: typeof b.agendable === "boolean" ? b.agendable : true,
      con_resultado: typeof b.con_resultado === "boolean" ? b.con_resultado : true,
      peso: Number.isFinite(Number(b.peso)) ? Math.max(0, Math.min(100, Math.round(Number(b.peso)))) : 5,
      orden: (max._max.orden ?? -1) + 1,
    },
  });
  return NextResponse.json(nuevo, { status: 201 });
}
