import { signSession, verifySession } from "@/lib/session";

describe("session JWT", () => {
  const payload = { userId: "abc-123", email: "test@test.com", rol: "ADMIN" as const, vendedorId: null };

  it("firma y verifica un token válido", async () => {
    const token = await signSession(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const result = await verifySession(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(payload.userId);
    expect(result?.email).toBe(payload.email);
    expect(result?.rol).toBe(payload.rol);
  });

  it("retorna null para un token inválido", async () => {
    const result = await verifySession("token.invalido.firma");
    expect(result).toBeNull();
  });

  it("retorna null para un token vacío", async () => {
    const result = await verifySession("");
    expect(result).toBeNull();
  });

  it("retorna null para un token manipulado", async () => {
    const token = await signSession(payload);
    const parts = token.split(".");
    // Cambiar el payload
    parts[1] = Buffer.from(JSON.stringify({ userId: "hacker", email: "hack@hack.com", rol: "ADMIN" })).toString("base64url");
    const tampered = parts.join(".");
    const result = await verifySession(tampered);
    expect(result).toBeNull();
  });
});
