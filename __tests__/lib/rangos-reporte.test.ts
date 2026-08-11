import {
  PRESETS_RANGO,
  diasEntre,
  etiquetaRango,
  normalizarPreset,
  rangoDePreset,
  sumarDias,
  sumarMesesClamp,
} from "@/lib/rangos-reporte";
import { hoyEnTZ } from "@/lib/tz";

const HOY = "2026-08-11";

describe("el pedido: 'mes' es el mes en curso, no 30 días rodantes", () => {
  it("del 1 del mes a hoy, comparado contra el mismo tramo del mes anterior", () => {
    expect(rangoDePreset("mes", HOY)).toEqual({
      actual: { desde: "2026-08-01", hasta: "2026-08-11" },
      anterior: { desde: "2026-07-01", hasta: "2026-07-11" },
    });
  });

  it("compara tramos del mismo largo: 11 días contra 11, no contra un mes entero", () => {
    const r = rangoDePreset("mes", HOY)!;
    expect(diasEntre(r.actual.desde, r.actual.hasta)).toBe(11);
    expect(diasEntre(r.anterior.desde, r.anterior.hasta)).toBe(11);
  });
});

describe("INVARIANTE: el período anterior nunca se solapa con el actual", () => {
  // Este es el defecto que inflaba el delta "vs período anterior": el `hasta` del anterior
  // era exactamente el `desde` del actual, y el server resuelve el `hasta` al FIN del día,
  // así que ese día se contaba en los DOS rangos. El for..of lo cubre para siempre,
  // incluidos los presets que se agreguen después.
  const FECHAS = ["2026-08-11", "2026-01-01", "2026-12-31", "2026-03-31", "2028-02-29"];

  for (const hoy of FECHAS) {
    it(`ningún preset solapa con hoy = ${hoy}`, () => {
      for (const preset of PRESETS_RANGO) {
        const r = rangoDePreset(preset, hoy, { desde: "2026-05-01", hasta: "2026-05-20" });
        if (!r) continue;
        expect(r.anterior.hasta < r.actual.desde).toBe(true);
      }
    });
  }
});

describe("restar meses no desborda (31-mar menos 1 mes no es 3-mar)", () => {
  it("clampea al último día del mes destino", () => {
    expect(sumarMesesClamp("2026-03-31", -1)).toBe("2026-02-28");
    expect(sumarMesesClamp("2028-03-31", -1)).toBe("2028-02-29"); // bisiesto
    expect(sumarMesesClamp("2026-05-31", -1)).toBe("2026-04-30");
  });

  it("el rango de 'mes' un día 31 queda dentro de febrero", () => {
    const r = rangoDePreset("mes", "2026-03-31")!;
    expect(r.anterior).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });

  it("un día que existe en los dos meses se conserva", () => {
    expect(sumarMesesClamp("2026-08-11", -1)).toBe("2026-07-11");
  });
});

describe("zona horaria: el día lo decide el negocio, no el reloj del navegador", () => {
  it("a las 20:00 de México sigue siendo el mismo día, no el siguiente", () => {
    // 2026-08-12T02:00Z son las 20:00 del 11 en CDMX. Con toISOString() daba el 12.
    const instante = new Date("2026-08-12T02:00:00Z");
    expect(hoyEnTZ(instante, "America/Mexico_City")).toBe("2026-08-11");
  });

  it("el preset 'Hoy' no consulta mañana desde el atardecer", () => {
    const hoy = hoyEnTZ(new Date("2026-08-12T02:00:00Z"), "America/Mexico_City");
    expect(rangoDePreset("hoy", hoy)).toEqual({
      actual: { desde: "2026-08-11", hasta: "2026-08-11" },
      anterior: { desde: "2026-08-10", hasta: "2026-08-10" },
    });
  });
});

describe("los demás presets", () => {
  it("semana son 7 días, no 8 — y queda rodante a propósito", () => {
    const r = rangoDePreset("semana", HOY)!;
    expect(r.actual).toEqual({ desde: "2026-08-05", hasta: "2026-08-11" });
    expect(diasEntre(r.actual.desde, r.actual.hasta)).toBe(7);
    expect(diasEntre(r.anterior.desde, r.anterior.hasta)).toBe(7);
  });

  it("trimestre arranca el 1 del Q en curso", () => {
    expect(rangoDePreset("trimestre", HOY)!.actual.desde).toBe("2026-07-01"); // Q3
    expect(rangoDePreset("trimestre", "2026-02-15")!.actual.desde).toBe("2026-01-01"); // Q1
  });

  it("semestre arranca el 1-ene o el 1-jul", () => {
    expect(rangoDePreset("semestre", HOY)!.actual.desde).toBe("2026-07-01");
    expect(rangoDePreset("semestre", "2026-04-30")!.actual.desde).toBe("2026-01-01");
  });

  it("año conserva la semántica que ya tenía (1-ene a hoy)", () => {
    expect(rangoDePreset("año", HOY)).toEqual({
      actual: { desde: "2026-01-01", hasta: "2026-08-11" },
      anterior: { desde: "2025-01-01", hasta: "2025-08-11" },
    });
  });

  it("custom conserva el largo y sin `hasta` cierra hoy", () => {
    const r = rangoDePreset("custom", HOY, { desde: "2026-05-01", hasta: "2026-05-10" })!;
    expect(diasEntre(r.anterior.desde, r.anterior.hasta)).toBe(10);
    expect(rangoDePreset("custom", HOY, { desde: "2026-08-01", hasta: "" })!.actual.hasta).toBe(HOY);
  });

  it("custom sin fecha de inicio no tiene nada que consultar", () => {
    expect(rangoDePreset("custom", HOY, { desde: "", hasta: "" })).toBeNull();
  });
});

describe("normalizarPreset", () => {
  it("acepta los presets nuevos y descarta basura", () => {
    expect(normalizarPreset("trimestre")).toBe("trimestre");
    expect(normalizarPreset("año")).toBe("año");
    expect(normalizarPreset("hackeado")).toBe("mes");
    expect(normalizarPreset(null)).toBe("mes");
  });
});

describe("etiquetaRango: qué estoy mirando", () => {
  it("mismo mes, distintos días", () => {
    expect(etiquetaRango({ desde: "2026-08-01", hasta: "2026-08-11" })).toBe("1–11 ago");
  });
  it("un solo día", () => {
    expect(etiquetaRango({ desde: "2026-08-11", hasta: "2026-08-11" })).toBe("11 ago");
  });
  it("cruza de mes", () => {
    expect(etiquetaRango({ desde: "2026-07-01", hasta: "2026-08-11" })).toBe("1 jul – 11 ago");
  });
  it("cruza de año: se muestran los dos años", () => {
    expect(etiquetaRango({ desde: "2025-12-01", hasta: "2026-01-11" })).toBe("1 dic 2025 – 11 ene 2026");
  });
});

describe("sumarDias", () => {
  it("cruza meses y años", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
  });
});
