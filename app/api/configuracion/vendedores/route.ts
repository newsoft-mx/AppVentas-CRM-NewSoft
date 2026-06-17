export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { serializeVendedor } from "@/lib/serializers";
import { vendedorCreateSchema } from "@/lib/validations/configuracion";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const vendedores = await prisma.vendedor.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    });
    return NextResponse.json(vendedores.map(serializeVendedor));
  } catch {
    return NextResponse.json({ error: "Error al obtener vendedores" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const validation = vendedorCreateSchema.safeParse(body);

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

    const existente = await prisma.vendedor.findFirst({
      where: {
        nombre: { equals: validation.data.nombre, mode: "insensitive" },
        activo: true,
      },
    });

    if (existente) {
      return NextResponse.json({ error: "Ya existe un vendedor activo con ese nombre" }, { status: 409 });
    }

    const vendedor = await prisma.vendedor.create({ data: validation.data });
    return NextResponse.json(serializeVendedor(vendedor), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear vendedor" }, { status: 500 });
  }
}
