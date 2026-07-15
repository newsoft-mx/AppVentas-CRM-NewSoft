export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { TipoCatalogoDeal } from "@prisma/client";

const TIPOS: TipoCatalogoDeal[] = ["CANAL", "ORIGEN"];
const esTipo = (v: unknown): v is TipoCatalogoDeal => typeof v === "string" && TIPOS.includes(v as TipoCatalogoDeal);

// GET /api/configuracion/catalogo-deal?tipo=CANAL|ORIGEN — lista (activos e inactivos).
// Sin ?tipo → devuelve todo el catálogo (ambos tipos).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const tipoParam = req.nextUrl.searchParams.get("tipo");
  const opciones = await prisma.catalogoDeal.findMany({
    where: esTipo(tipoParam) ? { tipo: tipoParam } : {},
    orderBy: [{ tipo: "asc" }, { activo: "desc" }, { orden: "asc" }, { nombre: "asc" }],
  });
  return NextResponse.json(opciones);
}

// POST /api/configuracion/catalogo-deal — crear una opción { tipo, nombre }.
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const b = (body ?? {}) as { tipo?: unknown; nombre?: unknown };
  if (!esTipo(b.tipo)) return NextResponse.json({ error: "Tipo inválido (CANAL u ORIGEN)" }, { status: 422 });
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 422 });
  if (nombre.length > 100) return NextResponse.json({ error: "Máximo 100 caracteres" }, { status: 422 });

  const dup = await prisma.catalogoDeal.findFirst({
    where: { tipo: b.tipo, nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (dup) return NextResponse.json({ error: "Ya existe una opción con ese nombre" }, { status: 409 });

  const max = await prisma.catalogoDeal.aggregate({ where: { tipo: b.tipo }, _max: { orden: true } });
  const nuevo = await prisma.catalogoDeal.create({
    data: { tipo: b.tipo, nombre, orden: (max._max.orden ?? -1) + 1 },
  });
  return NextResponse.json(nuevo, { status: 201 });
}
