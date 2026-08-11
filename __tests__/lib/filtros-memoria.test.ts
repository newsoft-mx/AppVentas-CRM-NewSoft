import {
  COOKIE_MAX_LARGO,
  cookieDeMemoria,
  esValorCookieSeguro,
  hayFiltrosEnUrl,
  nombreCookie,
  qsAParamMap,
  resolverFiltros,
  type ContratoFiltros,
  type ParamMap,
} from "@/lib/filtros-memoria";

// Contrato de juguete: alcanza para fijar la precedencia sin atarse a una pantalla real.
interface F {
  estado: string;
  q: string;
}
const CLAVES = ["estado", "q"] as const;
const parse = (sp: ParamMap): F => ({
  estado: (Array.isArray(sp.estado) ? sp.estado[0] : sp.estado) || "todos",
  q: (Array.isArray(sp.q) ? sp.q[0] : sp.q) || "",
});
const serialize = (f: F): string => {
  const p = new URLSearchParams();
  if (f.estado !== "todos") p.set("estado", f.estado);
  if (f.q) p.set("q", f.q);
  return p.toString();
};
const CONTRATO: ContratoFiltros<F> = {
  pantalla: "pipeline",
  claves: CLAVES,
  parse,
  serialize,
  // La memoria no guarda `q`: un texto de búsqueda viejo sería un filtro invisible.
  serializeMemoria: (f) => serialize({ ...f, q: "" }),
};

describe("precedencia: URL > cookie > default", () => {
  it("una sola clave en la URL gana sobre una cookie con muchas", () => {
    const r = resolverFiltros(CONTRATO, { estado: "GANADO" }, "estado=PERDIDO&q=hola");
    expect(r.origen).toBe("url");
    expect(r.filtros.estado).toBe("GANADO");
    // La URL gana EN BLOQUE: lo que no trae vuelve al default, no se completa con la cookie.
    expect(r.filtros.q).toBe("");
  });

  it("sin claves propias en la URL, hidrata desde la cookie", () => {
    const r = resolverFiltros(CONTRATO, {}, "estado=PERDIDO");
    expect(r.origen).toBe("cookie");
    expect(r.filtros.estado).toBe("PERDIDO");
  });

  it("claves AJENAS en la URL no cuentan como filtros", () => {
    // Entrar con ?callbackUrl=... no debe borrarte la memoria.
    const r = resolverFiltros(CONTRATO, { callbackUrl: "/pipeline" }, "estado=PERDIDO");
    expect(r.origen).toBe("cookie");
  });

  it("el alias clave[] sí cuenta como filtro en la URL", () => {
    expect(hayFiltrosEnUrl({ "estado[]": "GANADO" }, CLAVES)).toBe(true);
  });

  it("una clave presente pero vacía no cuenta", () => {
    expect(hayFiltrosEnUrl({ estado: "" }, CLAVES)).toBe(false);
  });

  it("sin URL y sin cookie → default", () => {
    const r = resolverFiltros(CONTRATO, {}, undefined);
    expect(r.origen).toBe("default");
    expect(r.filtros).toEqual({ estado: "todos", q: "" });
  });

  it("una cookie basura cae al default sin lanzar", () => {
    // La cookie es entrada NO confiable: el usuario puede editarla a mano.
    for (const basura of ["%%%&&&", "estado", "=", "&&&"]) {
      expect(() => resolverFiltros(CONTRATO, {}, basura)).not.toThrow();
    }
  });

  it("una pantalla sin serializeMemoria ignora la cookie aunque exista", () => {
    const sinMemoria: ContratoFiltros<F> = { ...CONTRATO, serializeMemoria: undefined };
    const r = resolverFiltros(sinMemoria, {}, "estado=PERDIDO");
    expect(r.origen).toBe("default");
  });
});

describe("qsAParamMap: la cookie se lee con la misma forma que searchParams", () => {
  it("claves repetidas se agrupan en array", () => {
    expect(qsAParamMap("estado=A&estado=B&orden=valor")).toEqual({
      estado: ["A", "B"],
      orden: "valor",
    });
  });

  it("vacío o undefined → objeto vacío", () => {
    expect(qsAParamMap("")).toEqual({});
    expect(qsAParamMap(undefined)).toEqual({});
  });
});

describe("la cookie", () => {
  it("lleva Path, Max-Age y SameSite", () => {
    const c = cookieDeMemoria("pipeline", "estado=GANADO");
    expect(c).toContain("ns-f.pipeline=estado=GANADO");
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
    expect(c).toMatch(/Max-Age=\d{6,}/);
  });

  it("un query vacío BORRA la cookie — así 'limpié los filtros' no necesita bandera", () => {
    expect(cookieDeMemoria("ventas", "")).toContain("Max-Age=0");
  });

  it("un valor que necesitaría escaparse se descarta en vez de corromperse", () => {
    // Next decodifica al leer y document.cookie no codifica al escribir: el viaje solo es
    // simétrico si el valor no lleva caracteres especiales. Degrada, no corrompe.
    for (const malo of ["q=hola mundo", "q=50%", "q=a;b", "q=a,b"]) {
      expect(esValorCookieSeguro(malo)).toBe(false);
      expect(cookieDeMemoria("pipeline", malo)).toContain("Max-Age=0");
    }
  });

  it("un valor demasiado largo no se persiste", () => {
    const largo = "cliente_id=" + "a".repeat(COOKIE_MAX_LARGO);
    expect(cookieDeMemoria("ventas", largo)).toContain("Max-Age=0");
  });

  it("el nombre lleva el prefijo de la app", () => {
    expect(nombreCookie("funnel")).toBe("ns-f.funnel");
  });
});
