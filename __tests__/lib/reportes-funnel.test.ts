import { puedeElegirVendedor, dealWhereReporte, rangoFechas } from "@/lib/reportes-funnel";
import type { SessionPayload } from "@/lib/session";

const vendedor: SessionPayload = { userId: "u", email: "v@x", rol: "VENDEDOR", vendedorId: "vend-1" };
const admin: SessionPayload = { userId: "a", email: "a@x", rol: "ADMIN", vendedorId: null };

describe("reportes-funnel helpers", () => {
  // El test viejo afirmaba `semestre < mes < semana` sobre `desdePeriodo`. Esa monotonía
  // estricta CODIFICABA el diseño rodante y no se puede adaptar: con rangos calendario, del
  // 1 al 7 de enero año, semestre, trimestre y mes arrancan todos el 1-ene, así que el `<`
  // falla. La función se borró junto con su test; la semántica vive ahora en
  // __tests__/lib/rangos-reporte.test.ts, que la cubre mucho mejor.

  it("rangoFechas: los dos caminos dan lo MISMO para el mismo período", () => {
    // Antes no: `?periodo=mes` era rodante y con `hasta` abierto, mientras `?desde=…&hasta=…`
    // era calendario y cerrado. Dos verdades sobre la misma pregunta.
    const ahora = new Date("2026-08-11T18:00:00Z");
    const porPreset = rangoFechas(new URLSearchParams("periodo=mes"), ahora);
    const explicito = rangoFechas(new URLSearchParams("desde=2026-08-01&hasta=2026-08-11"), ahora);
    expect(porPreset.desde.getTime()).toBe(explicito.desde.getTime());
    expect(porPreset.hasta?.getTime()).toBe(explicito.hasta?.getTime());
  });

  it("rangoFechas: el preset ya no deja el rango abierto hacia el futuro", () => {
    const r = rangoFechas(new URLSearchParams("periodo=mes"), new Date("2026-08-11T18:00:00Z"));
    expect(r.hasta).not.toBeNull();
  });

  it("rangoFechas: un periodo inválido cae al default sin romper links viejos", () => {
    const ahora = new Date("2026-08-11T18:00:00Z");
    const malo = rangoFechas(new URLSearchParams("periodo=hackeado"), ahora);
    const mes = rangoFechas(new URLSearchParams("periodo=mes"), ahora);
    expect(malo.desde.getTime()).toBe(mes.desde.getTime());
  });

  it("puedeElegirVendedor: solo ADMIN/GERENTE", () => {
    expect(puedeElegirVendedor(admin)).toBe(true);
    expect(puedeElegirVendedor(vendedor)).toBe(false);
    expect(puedeElegirVendedor(null)).toBe(false);
  });

  it("dealWhereReporte: el VENDEDOR queda scopeado a lo suyo e ignora el param ajeno", () => {
    const w = JSON.stringify(dealWhereReporte(vendedor, "otro-vendedor", { created_at: {} }));
    expect(w).toContain("vend-1");
    expect(w).not.toContain("otro-vendedor");
  });

  it("dealWhereReporte: ADMIN con param filtra ese vendedor; sin param no restringe", () => {
    expect(JSON.stringify(dealWhereReporte(admin, "vend-9", {}))).toContain("vend-9");
    expect(JSON.stringify(dealWhereReporte(admin, null, {}))).not.toContain("vendedor_id");
  });
});
