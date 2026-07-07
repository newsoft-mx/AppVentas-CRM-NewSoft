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
      },
    });

    if (!user || !user.activo) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    let roleRow: { rol: string | null; vendedor_id: string | null } | undefined;
    try {
      [roleRow] = await prisma.$queryRaw<Array<{ rol: string | null; vendedor_id: string | null }>>`
        SELECT rol::text AS rol, vendedor_id::text AS vendedor_id FROM "user" WHERE id = ${user.id}::uuid
      `;
    } catch (roleError) {
      logger.error("No se pudo leer rol/vendedor del usuario; se usará ADMIN por compatibilidad", "POST /api/auth/login", roleError);
    }
    const token = await signSession({
      userId: user.id,
      email: user.email,
      rol: normalizeRole(roleRow?.rol),
      vendedorId: roleRow?.vendedor_id ?? null,
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
