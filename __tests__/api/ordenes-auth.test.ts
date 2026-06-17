/**
 * Prueba que los endpoints de órdenes rechazan requests sin autenticación.
 * Usa mocks de Prisma para no requerir base de datos en CI.
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    ordenVenta: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

import { GET as getOrdenes, POST as postOrdenes } from "@/app/api/ordenes/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ordenes", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

describe("GET /api/ordenes — sin autenticación", () => {
  it("devuelve 401 cuando no hay cookie de sesión", async () => {
    const req = makeRequest("GET");
    const res = await getOrdenes(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("No autorizado");
  });
});

describe("POST /api/ordenes — sin autenticación", () => {
  it("devuelve 401 cuando no hay cookie de sesión", async () => {
    const req = makeRequest("POST", { cliente_id: "test" });
    const res = await postOrdenes(req);
    expect(res.status).toBe(401);
  });
});
