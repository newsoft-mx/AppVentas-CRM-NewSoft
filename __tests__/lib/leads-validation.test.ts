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

  it("coacciona números y moneda desde strings del form", () => {
    const r = leadWebSchema.parse({
      nombre: "Ana",
      moneda: "usd",
      valor: "120000",
      setup: "50000",
      meses: "12",
    });
    expect(r.moneda).toBe("USD");
    expect(r.valor).toBe(120000);
    expect(r.setup).toBe(50000);
    expect(r.meses).toBe(12);
    expect(r.mensualidad).toBeNull(); // no vino → null, no 0
  });

  it("moneda desconocida → null (no rompe el lead)", () => {
    expect(leadWebSchema.parse({ nombre: "Ana", moneda: "eur" }).moneda).toBeNull();
  });

  it("acepta tamano_empresa case-insensitive y tipa el enum", () => {
    expect(leadWebSchema.parse({ nombre: "Ana", tamano_empresa: "mediana" }).tamano_empresa).toBe("MEDIANA");
  });

  it("rechaza tamano_empresa inválido", () => {
    expect(leadWebSchema.safeParse({ nombre: "Ana", tamano_empresa: "enorme" }).success).toBe(false);
  });

  it("rechaza número negativo en valor", () => {
    expect(leadWebSchema.safeParse({ nombre: "Ana", valor: "-1" }).success).toBe(false);
  });

  it("parsea fecha_cierre_estimada ISO a Date y rechaza basura", () => {
    const r = leadWebSchema.parse({ nombre: "Ana", fecha_cierre_estimada: "2026-09-30" });
    expect(r.fecha_cierre_estimada).toBeInstanceOf(Date);
    expect(leadWebSchema.safeParse({ nombre: "Ana", fecha_cierre_estimada: "no-fecha" }).success).toBe(false);
  });

  it("mapea whatsapp, cargo, titulo y campaña", () => {
    const r = leadWebSchema.parse({
      nombre: "Ana",
      whatsapp: "55-9999",
      cargo: "Compras",
      titulo: "Portal B2B",
      campana: "Google Ads Q3",
    });
    expect(r.whatsapp).toBe("55-9999");
    expect(r.cargo).toBe("Compras");
    expect(r.titulo).toBe("Portal B2B");
    expect(r.campana).toBe("Google Ads Q3");
  });
});
