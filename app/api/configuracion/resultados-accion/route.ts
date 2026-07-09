export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const EFECTOS = ["POSITIVO", "NEUTRO", "NEGATIVO"] as const;

// GET /api/configuracion/resultados-accion — catálogo de resultados (SOL-04)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const res = await prisma.resultadoAccion.findMany({ orderBy: [{ activo: "desc" }, { orden: "asc" }] });
  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const b = (body ?? {}) as { nombre?: unknown; efecto?: unknown; sugiere_reagendar?: unknown };
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 422 });
  const max = await prisma.resultadoAccion.aggregate({ _max: { orden: true } });
  const nuevo = await prisma.resultadoAccion.create({
    data: {
      nombre,
      efecto: EFECTOS.includes(b.efecto as (typeof EFECTOS)[number]) ? (b.efecto as (typeof EFECTOS)[number]) : "NEUTRO",
      sugiere_reagendar: typeof b.sugiere_reagendar === "boolean" ? b.sugiere_reagendar : false,
      orden: (max._max.orden ?? -1) + 1,
    },
  });
  return NextResponse.json(nuevo, { status: 201 });
}
