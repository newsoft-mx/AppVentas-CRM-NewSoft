import { leadWebSchema } from "@/lib/validations/leads";

describe("leadWebSchema — intake web", () => {
  it("acepta el mínimo (solo nombre)", () => {
    const r = leadWebSchema.parse({ nombre: "Juan Pérez" });
    expect(r.nombre).toBe("Juan Pérez");
    expect(r.email).toBeNull();
    expect(r.empresa).toBeNull();
  });

  it("normaliza email a minúsculas y vacíos → null", () => {
    const r = leadWebSchema.parse({ nombre: "Ana", email: "ANA@X.COM", telefono: "", empresa: "" });
    expect(r.email).toBe("ana@x.com");
    expect(r.telefono).toBeNull();
    expect(r.empresa).toBeNull();
  });

  it("rechaza sin nombre", () => {
    expect(leadWebSchema.safeParse({ email: "x@y.com" }).success).toBe(false);
  });

  it("rechaza email mal formado", () => {
    expect(leadWebSchema.safeParse({ nombre: "Ana", email: "no-es-email" }).success).toBe(false);
  });

  it("recorta el mensaje largo por el máximo", () => {
    const largo = "a".repeat(2001);
    expect(leadWebSchema.safeParse({ nombre: "Ana", mensaje: largo }).success).toBe(false);
  });
});
