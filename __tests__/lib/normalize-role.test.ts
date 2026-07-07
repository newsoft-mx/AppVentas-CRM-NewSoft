import { normalizeRole } from "@/lib/session";

describe("normalizeRole (fail-closed)", () => {
  it("mapea alias legacy", () => {
    expect(normalizeRole("VENTAS")).toBe("GERENTE_COMERCIAL");
    expect(normalizeRole("CONSULTA")).toBe("ADMINISTRATIVO");
  });

  it("acepta roles válidos", () => {
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole("GERENTE_COMERCIAL")).toBe("GERENTE_COMERCIAL");
    expect(normalizeRole("VENDEDOR")).toBe("VENDEDOR");
    expect(normalizeRole("ADMINISTRATIVO")).toBe("ADMINISTRATIVO");
  });

  it("devuelve null para valores desconocidos (nunca ADMIN por defecto)", () => {
    expect(normalizeRole("HACKER")).toBeNull();
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(123)).toBeNull();
  });
});
