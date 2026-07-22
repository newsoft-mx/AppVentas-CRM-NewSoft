import { clasificarBorrado, puedeBorrarDeals, puedeForzarDestruccion } from "@/lib/deals";

// El usuario hace UN gesto ("Borrar") y no elige mecanismo: lo decide el costo del error.
// Del form web va a llegar basura y hay que poder sacarla de verdad; pero un deal trabajado
// borrado por error no se puede perder.
describe("clasificarBorrado — qué pasa al borrar un deal", () => {
  const base = { resultado: "ABIERTO", orden_id: null, actividades_reales: 0, contactos: 1 };

  describe("se destruye (basura probada)", () => {
    it("un lead del form web, virgen: nadie lo trabajó", () => {
      expect(clasificarBorrado(base).clase).toBe("FISICO");
    });

    it("también si está perdido y nunca se trabajó", () => {
      expect(clasificarBorrado({ ...base, resultado: "PERDIDO" }).clase).toBe("FISICO");
    });
  });

  describe("se marca (hay trabajo que conservar)", () => {
    it("con una sola actividad ya no se destruye", () => {
      const r = clasificarBorrado({ ...base, actividades_reales: 1 });
      expect(r.clase).toBe("MARCAR");
      expect(r.motivo).toContain("1 actividad");
    });

    it("el motivo dice cuántas, para que el modal muestre el costo", () => {
      expect(clasificarBorrado({ ...base, actividades_reales: 7 }).motivo).toContain("7 actividades");
    });
  });

  // Se borra en CUALQUIER etapa: lo sensible no se bloquea, se marca (recuperable) y pide ADMIN.
  describe("plata facturada: se marca y pide ADMIN (nunca se bloquea)", () => {
    it("con orden vinculada, aunque esté abierto y virgen", () => {
      const r = clasificarBorrado({ ...base, orden_id: "abc" });
      expect(r.clase).toBe("MARCAR"); // recuperable, no destruido
      expect(r.soloAdmin).toBe(true);
    });

    it("GANADO, aunque todavía no tenga la orden vinculada", () => {
      const r = clasificarBorrado({ ...base, resultado: "GANADO" });
      expect(r.clase).toBe("MARCAR");
      expect(r.soloAdmin).toBe(true);
    });

    it("la orden manda por encima de todo lo demás", () => {
      const r = clasificarBorrado({ ...base, orden_id: "abc", actividades_reales: 99 });
      expect(r.clase).toBe("MARCAR");
      expect(r.soloAdmin).toBe(true);
      expect(r.motivo).toMatch(/orden/i);
    });

    it("ningún caso queda bloqueado: siempre se puede borrar", () => {
      const casos = [
        { ...base },
        { ...base, actividades_reales: 5 },
        { ...base, resultado: "GANADO" },
        { ...base, orden_id: "abc" },
        { ...base, resultado: "GANADO", orden_id: "abc", actividades_reales: 20 },
      ];
      for (const c of casos) {
        expect(["FISICO", "MARCAR"]).toContain(clasificarBorrado(c).clase);
      }
    });
  });

  describe("quién puede: lo normal es de cualquiera, lo sensible es de ADMIN", () => {
    it("un lead virgen o trabajado NO pide ADMIN", () => {
      expect(clasificarBorrado(base).soloAdmin).toBe(false);
      expect(clasificarBorrado({ ...base, actividades_reales: 3 }).soloAdmin).toBe(false);
    });
  });

  // El caso que motivó el diseño: Tubos Mexicanos, $1.1M, 52 días, la bitácora de Gaby.
  // No tiene orden — con "sin órdenes" como único límite, se destruía de un clic.
  it("un deal grande sin orden pero trabajado se MARCA, no se destruye", () => {
    expect(clasificarBorrado({ resultado: "ABIERTO", orden_id: null, actividades_reales: 7, contactos: 2 }).clase)
      .toBe("MARCAR");
  });
});

describe("quién puede borrar", () => {
  it("ADMIN, GERENTE y VENDEDOR borran (el vendedor solo los suyos: lo aplica scopeDealWhere)", () => {
    for (const rol of ["ADMIN", "GERENTE_COMERCIAL", "VENDEDOR"]) {
      expect(puedeBorrarDeals(rol)).toBe(true);
    }
  });

  it("un rol de solo lectura no borra", () => {
    expect(puedeBorrarDeals("ADMINISTRATIVO")).toBe(false);
  });

  it("forzar la destrucción de algo trabajado es SOLO de ADMIN", () => {
    expect(puedeForzarDestruccion("ADMIN")).toBe(true);
    // Un vendedor destruyendo su propio trabajo para que no se vea es lo que evita el marcado.
    expect(puedeForzarDestruccion("VENDEDOR")).toBe(false);
    expect(puedeForzarDestruccion("GERENTE_COMERCIAL")).toBe(false);
  });
});
