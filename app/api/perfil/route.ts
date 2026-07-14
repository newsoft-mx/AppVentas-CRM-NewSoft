export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { perfilUpdateSchema } from "@/lib/validations/configuracion";

// GET /api/perfil — datos del usuario logueado (para la vista de perfil).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, nombre: true, email: true, rol: true, vendedor: { select: { nombre: true } } },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    vendedor_nombre: user.vendedor?.nombre ?? null,
  });
}

// PATCH /api/perfil — el usuario edita SU propio perfil: nombre y/o contraseña.
// Opera siempre sobre session.userId (nunca un id del body) y NO acepta rol/activo/email.
export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = perfilUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.errors.map((e) => ({ campo: e.path.join("."), mensaje: e.message })) },
      { status: 422 }
    );
  }
  const { nombre, password_actual, password_nueva } = parsed.data;

  const data: { nombre?: string; password_hash?: string } = {};
  if (nombre !== undefined) data.nombre = nombre;

  // Cambio de contraseña: exige y verifica la actual (evita cambios con sesión secuestrada).
  if (password_nueva) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { password_hash: true },
    });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const ok = await bcrypt.compare(password_actual ?? "", user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "La contraseña actual es incorrecta", campo: "password_actual" }, { status: 422 });
    }
    data.password_hash = await bcrypt.hash(password_nueva, 12);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 422 });
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { nombre: true, email: true, rol: true },
  });
  return NextResponse.json({ ok: true, nombre: updated.nombre });
}
