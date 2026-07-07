export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import { serializeUsuario } from "@/lib/serializers";
import { usuarioCreateSchema } from "@/lib/validations/configuracion";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const usuarios = await prisma.user.findMany({
    select: { id: true, nombre: true, email: true, activo: true, rol: true, vendedor_id: true, created_at: true, updated_at: true },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return NextResponse.json(usuarios.map(serializeUsuario));
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = usuarioCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message })) },
      { status: 422 }
    );
  }

  try {
    // Rol validado; vendedor_id solo si el rol es VENDEDOR (antes se forzaba ADMIN → escalada).
    const vendedorId = parsed.data.rol === "VENDEDOR" ? parsed.data.vendedor_id ?? null : null;
    const usuario = await prisma.user.create({
      data: {
        nombre: parsed.data.nombre,
        email: parsed.data.email,
        password_hash: await bcrypt.hash(parsed.data.password, 12),
        activo: true,
        rol: parsed.data.rol,
        vendedor_id: vendedorId,
      },
      select: { id: true, nombre: true, email: true, activo: true, rol: true, vendedor_id: true, created_at: true, updated_at: true },
    });

    return NextResponse.json(serializeUsuario(usuario), { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
