/**
 * El `cliente_id` que llega del body tiene que pasar por el scope de quien pide.
 *
 * El agujero que cierra: un VENDEDOR mandaba el UUID de un cliente ajeno y la ruta lo usaba
 * para (a) apuntar su deal a ese cliente y (b) hacerle `cliente.update` encima. Lo segundo es
 * escritura indebida; lo primero es peor, porque `scopeClienteWhere` da acceso al cliente donde
 * tenés ALGÚN deal: al colgar su deal de ese cliente, el vendedor se ampliaba la propia lectura.
 *
 * Estos tests miran el `where` QUE LA RUTA LE PASA A PRISMA, no solo el status de la respuesta.
 * Un test que solo mira el status pasa en verde aunque el filtro esté mal armado — es
 * exactamente lo que dejó pasar este agujero.
 */

const clienteFindFirst = jest.fn();
const dealFindFirst = jest.fn();
const dealUpdate = jest.fn();
const clienteUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    cliente: { findFirst: (...a: unknown[]) => clienteFindFirst(...a), update: (...a: unknown[]) => clienteUpdate(...a) },
    deal: { findFirst: (...a: unknown[]) => dealFindFirst(...a), update: (...a: unknown[]) => dealUpdate(...a) },
    catalogoDeal: { findMany: jest.fn().mockResolvedValue([]) },
    dealStageEvent: { create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}));

const sesionVendedor = { userId: "u1", email: "v@x.mx", rol: "VENDEDOR" as const, vendedorId: "vend-1" };
jest.mock("@/lib/session", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "u1", email: "v@x.mx", rol: "VENDEDOR", vendedorId: "vend-1" }),
  canWrite: () => true,
}));

import { PATCH } from "@/app/api/crm/deals/[id]/route";
import { scopeClienteWhere } from "@/lib/access-control";
import { NextRequest } from "next/server";

const pedir = (body: unknown) =>
  PATCH(
    new NextRequest("http://localhost/api/crm/deals/deal-propio", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "deal-propio" }) }
  );

describe("PATCH /api/crm/deals/:id — el cliente destino pasa por el scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dealFindFirst.mockResolvedValue({ id: "deal-propio", stage_id: "st-1", cliente_id: "cli-propio" });
  });

  it("rechaza con 422 un cliente que el vendedor no puede ver", async () => {
    clienteFindFirst.mockResolvedValue(null); // fuera de su alcance
    const res = await pedir({ cliente_id: "cli-ajeno", website: "hackeado.mx" });

    expect(res.status).toBe(422);
    expect((await res.json()).campo).toBe("cliente_id");
    // Y lo que de verdad importa: no se escribió NADA sobre el cliente ajeno.
    expect(clienteUpdate).not.toHaveBeenCalled();
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it("consulta el cliente CON el filtro por vendedor, no solo por id", async () => {
    clienteFindFirst.mockResolvedValue(null);
    await pedir({ cliente_id: "cli-ajeno" });

    expect(clienteFindFirst).toHaveBeenCalledTimes(1);
    const where = clienteFindFirst.mock.calls[0][0].where;
    // El where tiene que ser el que arma scopeClienteWhere para ESTA sesión: si alguien
    // "simplifica" a `{ id }`, este test se pone rojo.
    expect(where).toEqual(scopeClienteWhere(sesionVendedor, { id: "cli-ajeno", activo: true }));
    expect(JSON.stringify(where)).toContain("vend-1");
  });

  it("deja pasar un cliente que sí está en su alcance", async () => {
    clienteFindFirst.mockResolvedValue({ id: "cli-permitido" });
    const res = await pedir({ cliente_id: "cli-permitido", nombre: "Nuevo nombre" });
    expect(res.status).toBe(200);
  });

  it("sin cliente_id en el body no consulta clientes: se usa el del deal", async () => {
    const res = await pedir({ nombre: "Solo cambio el nombre" });
    expect(res.status).toBe(200);
    expect(clienteFindFirst).not.toHaveBeenCalled();
  });

  it("el deal se sigue resolviendo con su propio scope", async () => {
    dealFindFirst.mockResolvedValue(null); // no es suyo
    const res = await pedir({ nombre: "x" });
    expect(res.status).toBe(404);
    const where = dealFindFirst.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("vend-1");
  });
});
