import { ventaSinFecha, MSG_VENTA_SIN_FECHA, transicionOrdenPermitida } from "@/lib/utils";

/**
 * INVARIANTE: una orden en VENTA siempre tiene fecha de venta.
 *
 * No es una validación de formulario. Los tres reportes de ingreso (ventas-mensuales,
 * ventas-tipo, ventas-vendedor) filtran por `estatus = VENTA` + rango sobre `fecha_venta`:
 * una VENTA sin fecha se cae de TODOS, mientras sigue contando en los KPIs por estatus.
 * Dos pantallas, dos verdades, y ninguna dice que falta un dato.
 */
describe("ventaSinFecha", () => {
  it("una VENTA sin fecha viola el invariante", () => {
    expect(ventaSinFecha("VENTA", null)).toBe(true);
    expect(ventaSinFecha("VENTA", undefined)).toBe(true);
    expect(ventaSinFecha("VENTA", "")).toBe(true);
  });

  it("una VENTA con fecha lo cumple, venga como Date o como string", () => {
    expect(ventaSinFecha("VENTA", new Date("2026-08-31"))).toBe(false);
    expect(ventaSinFecha("VENTA", "2026-08-31")).toBe(false);
  });

  it("los demás estatus pueden no tener fecha: solo la VENTA la exige", () => {
    for (const estatus of ["BORRADOR", "COTIZADO"]) {
      expect(ventaSinFecha(estatus, null)).toBe(false);
    }
  });

  it("el mensaje es uno solo, para que las cuatro puertas digan lo mismo", () => {
    expect(MSG_VENTA_SIN_FECHA).toMatch(/fecha de venta/i);
  });
});

describe("el invariante convive con la máquina de estados", () => {
  it("volver de VENTA a COTIZADO es legal y no exige fecha", () => {
    // El caso real: se marcó como venta por error y se vuelve atrás. La transición está
    // permitida y el invariante no aplica porque el estado final ya no es VENTA.
    expect(transicionOrdenPermitida("VENTA", "COTIZADO")).toBe(true);
    expect(ventaSinFecha("COTIZADO", null)).toBe(false);
  });

  it("quedarse en VENTA y borrar la fecha viola el invariante", () => {
    // Este es el agujero que tenía PUT: la guarda vivía DENTRO del `if (cambia el estatus)`,
    // así que una orden que ya era VENTA podía perder la fecha sin que nada la frenara.
    expect(transicionOrdenPermitida("VENTA", "VENTA")).toBe(true); // no-op, permitido
    expect(ventaSinFecha("VENTA", null)).toBe(true); // pero el invariante lo frena
  });
});
