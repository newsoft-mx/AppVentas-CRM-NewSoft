export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// factor [-1..+1] → clamp; efecto se DERIVA del signo del factor
function parseFactor(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, Math.round(n * 100) / 100)) : 0;
}
function efectoDeFactor(f: number): "POSITIVO" | "NEUTRO" | "NEGATIVO" {
  return f > 0 ? "POSITIVO" : f < 0 ? "NEGATIVO" : "NEUTRO";
}

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
  const b = (body ?? {}) as { nombre?: unknown; factor?: unknown; sugiere_reagendar?: unknown };
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 422 });
  const factor = parseFactor(b.factor);
  const max = await prisma.resultadoAccion.aggregate({ _max: { orden: true } });
  const nuevo = await prisma.resultadoAccion.create({
    data: {
      nombre,
      factor,
      efecto: efectoDeFactor(factor),
      sugiere_reagendar: typeof b.sugiere_reagendar === "boolean" ? b.sugiere_reagendar : false,
      orden: (max._max.orden ?? -1) + 1,
    },
  });
  return NextResponse.json(nuevo, { status: 201 });
}
