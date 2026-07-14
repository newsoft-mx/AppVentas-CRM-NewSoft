import { clienteCreateSchema } from "@/lib/validations/clientes";

// Datos mínimos válidos para no repetir en cada caso.
const base = {
  nombre: "ACME S.A.",
  contacto: "Juan Pérez",
  ciudad: "CDMX",
  condicion_pago_id: "11111111-1111-1111-1111-111111111111",
};

describe("clienteCreateSchema — website", () => {
  it("normaliza un dominio sin protocolo a https://", () => {
    const r = clienteCreateSchema.parse({ ...base, website: "acme.com" });
    expect(r.website).toBe("https://acme.com");
  });

  it("respeta http/https ya presente", () => {
    expect(clienteCreateSchema.parse({ ...base, website: "http://acme.com" }).website).toBe("http://acme.com");
  });

  it("vacío o ausente queda null (opcional, no bloquea)", () => {
    expect(clienteCreateSchema.parse({ ...base, website: "" }).website).toBeNull();
    expect(clienteCreateSchema.parse(base).website).toBeNull();
  });

  it("rechaza un website sin punto/dominio", () => {
    expect(clienteCreateSchema.safeParse({ ...base, website: "noesundominio" }).success).toBe(false);
  });
});

describe("clienteCreateSchema — tamano_empresa", () => {
  it("acepta un bucket válido", () => {
    expect(clienteCreateSchema.parse({ ...base, tamano_empresa: "MEDIANA" }).tamano_empresa).toBe("MEDIANA");
  });

  it("ausente queda null", () => {
    expect(clienteCreateSchema.parse(base).tamano_empresa).toBeNull();
  });

  it("rechaza un bucket inexistente", () => {
    expect(clienteCreateSchema.safeParse({ ...base, tamano_empresa: "GIGANTE" }).success).toBe(false);
  });
});
