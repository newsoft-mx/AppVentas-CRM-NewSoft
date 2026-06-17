export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import { serializeUsuario } from "@/lib/serializers";
import { usuarioUpdateSchema } from "@/lib/validations/configuracion";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = usuarioUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message })) },
      { status: 422 }
    );
  }

  if (id === session.userId && !parsed.data.activo) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 409 });
  }

  try {
    const usuario = await prisma.user.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        email: parsed.data.email,
        activo: parsed.data.activo,
        ...(parsed.data.password && { password_hash: await bcrypt.hash(parsed.data.password, 12) }),
      },
      select: { id: true, nombre: true, email: true, activo: true, created_at: true, updated_at: true },
    });

    await prisma.$executeRawUnsafe(
      'UPDATE "user" SET rol = $1::user_role, vendedor_id = NULL WHERE id = $2::uuid',
      "ADMIN",
      usuario.id
    );

    return NextResponse.json(serializeUsuario(usuario));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}
