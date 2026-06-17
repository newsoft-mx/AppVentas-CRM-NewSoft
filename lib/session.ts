import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { NextRequest } from "next/server";

const SESSION_COOKIE = "ns-auth";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 días

export type UserRole = "ADMIN" | "GERENTE_COMERCIAL" | "VENDEDOR" | "ADMINISTRATIVO";

export interface SessionPayload {
  userId: string;
  email: string;
  rol: UserRole;
  vendedorId: string | null;
}

const ROLES = new Set<UserRole>(["ADMIN", "GERENTE_COMERCIAL", "VENDEDOR", "ADMINISTRATIVO"]);

export function normalizeRole(value: unknown): UserRole {
  if (value === "VENTAS") return "GERENTE_COMERCIAL";
  if (value === "CONSULTA") return "ADMINISTRATIVO";
  return ROLES.has(value as UserRole) ? (value as UserRole) : "ADMIN";
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está definida");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const raw = payload as unknown as Partial<SessionPayload>;
    if (!raw.userId || !raw.email) return null;
    return {
      userId: raw.userId,
      email: raw.email,
      rol: normalizeRole(raw.rol),
      vendedorId: typeof raw.vendedorId === "string" ? raw.vendedorId : null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireRole(req: NextRequest, roles: UserRole[]): Promise<SessionPayload | null> {
  const session = await requireAuth(req);
  if (!session) return null;
  return roles.includes(session.rol) ? session : null;
}

export function canWrite(session: SessionPayload | null) {
  return session?.rol === "ADMIN" || session?.rol === "GERENTE_COMERCIAL" || session?.rol === "VENDEDOR";
}

export function isAdmin(session: SessionPayload | null) {
  return session?.rol === "ADMIN";
}

export function canManageClients(session: SessionPayload | null) {
  return (
    session?.rol === "ADMIN" ||
    session?.rol === "GERENTE_COMERCIAL" ||
    session?.rol === "ADMINISTRATIVO"
  );
}

export function canViewReports(session: SessionPayload | null) {
  return Boolean(session);
}

export { SESSION_COOKIE, SESSION_DURATION };
