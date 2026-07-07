import {
  normalizarPeriodo,
  desdePeriodo,
  puedeElegirVendedor,
  dealWhereReporte,
} from "@/lib/reportes-funnel";
import type { SessionPayload } from "@/lib/session";

const vendedor: SessionPayload = { userId: "u", email: "v@x", rol: "VENDEDOR", vendedorId: "vend-1" };
const admin: SessionPayload = { userId: "a", email: "a@x", rol: "ADMIN", vendedorId: null };

describe("reportes-funnel helpers", () => {
  it("normalizarPeriodo: default 'mes' para valores desconocidos", () => {
    expect(normalizarPeriodo("semana")).toBe("semana");
    expect(normalizarPeriodo("semestre")).toBe("semestre");
    expect(normalizarPeriodo("mes")).toBe("mes");
    expect(normalizarPeriodo("xxx")).toBe("mes");
    expect(normalizarPeriodo(null)).toBe("mes");
  });

  it("desdePeriodo: semana ≈ 7 días atrás; semestre < mes < semana < ahora", () => {
    const ahora = new Date("2026-07-07T12:00:00Z");
    const semana = desdePeriodo("semana", ahora);
    const mes = desdePeriodo("mes", ahora);
    const semestre = desdePeriodo("semestre", ahora);
    const dias = Math.round((ahora.getTime() - semana.getTime()) / 86_400_000);
    expect(dias).toBe(7);
    expect(semestre.getTime()).toBeLessThan(mes.getTime());
    expect(mes.getTime()).toBeLessThan(semana.getTime());
    expect(semana.getTime()).toBeLessThan(ahora.getTime());
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
