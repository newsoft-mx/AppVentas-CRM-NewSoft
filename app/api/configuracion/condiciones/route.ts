export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { serializeCondicion } from "@/lib/serializers";
import { condicionComercialCreateSchema } from "@/lib/validations/configuracion";

// GET /api/configuracion/condiciones
// Devuelve todas las condiciones (activas e inactivas)
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const condiciones = await prisma.condicionComercial.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    });
    return NextResponse.json(condiciones.map(serializeCondicion));
  } catch {
    return NextResponse.json(
      { error: "Error al obtener condiciones comerciales" },
      { status: 500 }
    );
  }
}

// POST /api/configuracion/condiciones
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const validation = condicionComercialCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: validation.error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // Verificar nombre duplicado
    const existente = await prisma.condicionComercial.findFirst({
      where: {
        nombre: { equals: validation.data.nombre, mode: "insensitive" },
        activo: true,
      },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una condición comercial con ese nombre" },
        { status: 409 }
      );
    }

    const nueva = await prisma.condicionComercial.create({
      data: validation.data,
    });

    return NextResponse.json(serializeCondicion(nueva), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear condición comercial" },
      { status: 500 }
    );
  }
}
