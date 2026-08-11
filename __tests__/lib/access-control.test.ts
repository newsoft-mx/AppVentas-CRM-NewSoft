import { scopeDealWhere, scopeClienteWhere } from "@/lib/access-control";
import type { SessionPayload } from "@/lib/session";

const vendedor: SessionPayload = { userId: "u1", email: "v@x.com", rol: "VENDEDOR", vendedorId: "vend-1" };
const admin: SessionPayload = { userId: "u2", email: "a@x.com", rol: "ADMIN", vendedorId: null };
const gerente: SessionPayload = { userId: "u4", email: "g@x.com", rol: "GERENTE_COMERCIAL", vendedorId: null };
const vendedorSinFicha: SessionPayload = { userId: "u3", email: "v3@x.com", rol: "VENDEDOR", vendedorId: null };

describe("scopeDealWhere (guard anti-IDOR)", () => {
  // Por default oculta los borrados: el candado vive acá para que ningún reporte cuente
  // un lead borrado por olvidarse el filtro en su query (son ~15 lugares).
  it("restringe al vendedor en sesión y oculta borrados", () => {
    expect(scopeDealWhere(vendedor, { id: "d1" })).toEqual({
      AND: [{ AND: [{ id: "d1" }, { eliminada: false }] }, { vendedor_id: "vend-1" }],
    });
  });

  it("ADMIN y GERENTE ven todo salvo los borrados", () => {
    expect(scopeDealWhere(admin, { id: "d1" })).toEqual({ AND: [{ id: "d1" }, { eliminada: false }] });
    expect(scopeDealWhere(gerente, { id: "d1" })).toEqual({ AND: [{ id: "d1" }, { eliminada: false }] });
  });

  it("VENDEDOR sin ficha no matchea ningún deal real (fail-safe)", () => {
    expect(scopeDealWhere(vendedorSinFicha, { id: "d1" })).toEqual({
      AND: [{ AND: [{ id: "d1" }, { eliminada: false }] }, { vendedor_id: "__sin-vendedor-asignado__" }],
    });
  });

  it("alcance PAPELERA saltea el filtro (vista 'Eliminados', solo ADMIN)", () => {
    expect(scopeDealWhere(admin, { id: "d1" }, { alcance: "PAPELERA" })).toEqual({ id: "d1" });
  });

  it("alcance HISTORICO suma los cerrados aunque estén borrados (reportes)", () => {
    // Borrar saca al deal de la operación, no del pasado: un ganado/perdido borrado
    // sigue contando en la tasa de cierre del mes en que se cerró.
    expect(scopeDealWhere(admin, { id: "d1" }, { alcance: "HISTORICO" })).toEqual({
      AND: [
        { id: "d1" },
        { OR: [{ eliminada: false }, { resultado: { in: ["GANADO", "PERDIDO"] } }] },
      ],
    });
  });

  it("HISTORICO no afloja el scope del VENDEDOR (sigue sin ver deals ajenos)", () => {
    const w = scopeDealWhere(vendedorSinFicha, { id: "d1" }, { alcance: "HISTORICO" }) as {
      AND: Record<string, unknown>[];
    };
    expect(w.AND[1]).toEqual({ vendedor_id: "__sin-vendedor-asignado__" });
  });

  it("sin sesión bloquea todo", () => {
    expect(scopeDealWhere(null, { id: "d1" })).toEqual({ id: "__no-session__" });
  });
});

describe("scopeClienteWhere (VENDEDOR ve solo sus clientes)", () => {
  it("VENDEDOR: clientes con órdenes o deals suyos", () => {
    expect(scopeClienteWhere(vendedor, { activo: true })).toEqual({
      AND: [
        { activo: true },
        {
          OR: [
            { ordenes: { some: { vendedor_id: "vend-1" } } },
            { deals: { some: { vendedor_id: "vend-1" } } },
          ],
        },
      ],
    });
  });

  it("ADMIN/GERENTE ven todos (sin restricción)", () => {
    expect(scopeClienteWhere(admin, { activo: true })).toEqual({ activo: true });
    expect(scopeClienteWhere(gerente, { activo: true })).toEqual({ activo: true });
  });

  it("VENDEDOR sin ficha no matchea ningún cliente", () => {
    expect(scopeClienteWhere(vendedorSinFicha, { activo: true })).toEqual({
      AND: [{ activo: true }, { id: { in: [] } }],
    });
  });

  it("sin sesión bloquea todo", () => {
    expect(scopeClienteWhere(null)).toEqual({ id: "__no-session__" });
  });
});
