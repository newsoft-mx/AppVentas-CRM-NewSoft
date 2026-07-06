export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeRole, signSession, SESSION_COOKIE, SESSION_DURATION } from "@/lib/session";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Credenciales requeridas" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        password_hash: true,
        activo: true,
        rol: true,
        vendedor_id: true,
      },
    });

    if (!user || !user.activo) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    // Fail-closed: si el rol no es reconocido, NO se emite sesión (nunca ADMIN por defecto).
    // Se lee vía Prisma (rol es un enum del modelo), sin queries crudas con cast frágil.
    const rol = normalizeRole(user.rol);
    if (!rol) {
      logger.error("Rol de usuario no resuelto; login rechazado", "POST /api/auth/login", user.rol);
      return NextResponse.json({ error: "Error interno al iniciar sesión" }, { status: 500 });
    }
    const token = await signSession({
      userId: user.id,
      email: user.email,
      rol,
      vendedorId: user.vendedor_id ?? null,
    });
    const isHttps =
      req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto") === "https";

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: SESSION_DURATION,
      path: "/",
    });
    return res;
  } catch (error) {
    logger.error("Error en login", "POST /api/auth/login", error);
    return NextResponse.json({ error: "Error interno al iniciar sesión" }, { status: 500 });
  }
}
