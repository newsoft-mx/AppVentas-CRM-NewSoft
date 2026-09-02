import { normalizarWebsite, websiteNormalizadoValido, errorDeWebsite } from "@/lib/website";
import { clienteCreateSchema } from "@/lib/validations/clientes";

describe("normalizarWebsite", () => {
  // El caso que motivó todo: es lo que dice el placeholder del formulario, y el `type="url"`
  // del navegador lo rechazaba mientras el server lo aceptaba sin chistar.
  it("le pone https:// al dominio pelado", () => {
    expect(normalizarWebsite("empresa.com")).toBe("https://empresa.com");
  });

  it("respeta el protocolo que ya venía", () => {
    expect(normalizarWebsite("http://empresa.com")).toBe("http://empresa.com");
    expect(normalizarWebsite("https://empresa.com/ruta")).toBe("https://empresa.com/ruta");
  });

  it("vacío es null: el campo es opcional", () => {
    expect(normalizarWebsite("")).toBeNull();
    expect(normalizarWebsite("   ")).toBeNull();
    expect(normalizarWebsite(null)).toBeNull();
    expect(normalizarWebsite(undefined)).toBeNull();
  });
});

describe("errorDeWebsite", () => {
  it("acepta lo que el sistema sabe guardar", () => {
    expect(errorDeWebsite("empresa.com")).toBeNull();
    expect(errorDeWebsite("https://empresa.com.mx")).toBeNull();
    expect(errorDeWebsite("")).toBeNull();
  });

  it("rechaza lo que no es un dominio", () => {
    expect(errorDeWebsite("empresa")).toBe("Website inválido");
    expect(errorDeWebsite("no es un sitio")).toBe("Website inválido");
  });
});

// La razón de que esto viva en un solo archivo: formulario y server tienen que decidir igual.
// Si divergen, el usuario ve un campo que rechaza lo que el sistema acepta (o al revés).
describe("el formulario y el server coinciden", () => {
  const base = {
    nombre: "ACME",
    contacto: "Ana",
    ciudad: "Monterrey",
    condicion_pago_id: "11111111-1111-4111-8111-111111111111",
  };

  it.each(["empresa.com", "https://empresa.com", "http://sub.empresa.com.mx/x", ""])(
    "«%s»: si el formulario lo deja pasar, el server también",
    (valor) => {
      const delFormulario = errorDeWebsite(valor) === null;
      const delServer = clienteCreateSchema.safeParse({ ...base, website: valor }).success;

      expect(delFormulario).toBe(delServer);
    }
  );

  it("«empresa» lo rechazan los dos", () => {
    expect(errorDeWebsite("empresa")).not.toBeNull();
    expect(clienteCreateSchema.safeParse({ ...base, website: "empresa" }).success).toBe(false);
  });

  it("el server guarda exactamente lo que el formulario mostró tras normalizar", () => {
    const parsed = clienteCreateSchema.parse({ ...base, website: "empresa.com" });

    expect(parsed.website).toBe(normalizarWebsite("empresa.com"));
  });
});

describe("websiteNormalizadoValido", () => {
  it("null es válido: el campo es opcional", () => {
    expect(websiteNormalizadoValido(null)).toBe(true);
  });
});
