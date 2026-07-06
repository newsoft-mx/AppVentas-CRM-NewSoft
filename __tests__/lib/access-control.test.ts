import { scopeDealWhere } from "@/lib/access-control";
import type { SessionPayload } from "@/lib/session";

const vendedor: SessionPayload = { userId: "u1", email: "v@x.com", rol: "VENDEDOR", vendedorId: "vend-1" };
const admin: SessionPayload = { userId: "u2", email: "a@x.com", rol: "ADMIN", vendedorId: null };
const gerente: SessionPayload = { userId: "u4", email: "g@x.com", rol: "GERENTE_COMERCIAL", vendedorId: null };
const vendedorSinFicha: SessionPayload = { userId: "u3", email: "v3@x.com", rol: "VENDEDOR", vendedorId: null };

describe("scopeDealWhere (guard anti-IDOR)", () => {
  it("restringe al vendedor en sesión (solo sus deals)", () => {
    expect(scopeDealWhere(vendedor, { id: "d1" })).toEqual({
      AND: [{ id: "d1" }, { vendedor_id: "vend-1" }],
    });
  });

  it("ADMIN y GERENTE ven todo (sin restricción de vendedor)", () => {
    expect(scopeDealWhere(admin, { id: "d1" })).toEqual({ id: "d1" });
    expect(scopeDealWhere(gerente, { id: "d1" })).toEqual({ id: "d1" });
  });

  it("VENDEDOR sin ficha no matchea ningún deal real (fail-safe)", () => {
    expect(scopeDealWhere(vendedorSinFicha, { id: "d1" })).toEqual({
      AND: [{ id: "d1" }, { vendedor_id: "__sin-vendedor-asignado__" }],
    });
  });

  it("sin sesión bloquea todo", () => {
    expect(scopeDealWhere(null, { id: "d1" })).toEqual({ id: "__no-session__" });
  });
});
