import { requireAuth } from "@/lib/session";
import { signSession } from "@/lib/session";
import { NextRequest } from "next/server";

function makeRequest(cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `ns-auth=${cookie}`);
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("requireAuth", () => {
  it("retorna null cuando no hay cookie", async () => {
    const req = makeRequest();
    const result = await requireAuth(req);
    expect(result).toBeNull();
  });

  it("retorna null para cookie con token inválido", async () => {
    const req = makeRequest("token-invalido-que-no-es-jwt");
    const result = await requireAuth(req);
    expect(result).toBeNull();
  });

  it("retorna sesión válida con JWT correcto", async () => {
    const token = await signSession({ userId: "user-1", email: "admin@test.com", rol: "ADMIN", vendedorId: null });
    const req = makeRequest(token);
    const result = await requireAuth(req);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.email).toBe("admin@test.com");
    expect(result?.rol).toBe("ADMIN");
  });
});
