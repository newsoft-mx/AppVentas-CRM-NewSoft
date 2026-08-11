import { clasificarReapertura, handoffGanado } from "@/lib/deals";
import { TRANSICIONES_RESULTADO_DEAL, transicionResultadoPermitida } from "@/lib/utils";
import { RESULTADOS_CERRADOS } from "@/types/crm";

// Roldán: "que se me regrese a los leads... volver al estado anterior... si no se cerró o se
// pospuso, regresarlo al pipe". Reabrir tiene que ser fácil; lo que no puede es duplicar plata.

describe("la máquina de estados deja reabrir, pero no saltear el cierre", () => {
  it("todo resultado cerrado puede volver a ABIERTO", () => {
    for (const cerrado of RESULTADOS_CERRADOS) {
      expect(transicionResultadoPermitida(cerrado, "ABIERTO")).toBe(true);
    }
  });

  it("reabrir es la ÚNICA salida de un cerrado: no se salta de perdido a ganado", () => {
    // Si PERDIDO→GANADO fuera legal, un deal podría cambiar de resultado sin que quede
    // registrado el paso por el pipeline, y el funnel mostraría una conversión que no pasó.
    for (const cerrado of RESULTADOS_CERRADOS) {
      expect(TRANSICIONES_RESULTADO_DEAL[cerrado]).toEqual(["ABIERTO"]);
    }
  });
});

describe("clasificarReapertura — cuánto cuidado según la plata comprometida", () => {
  it("sin orden vinculada se reabre sin fricción: es el caso normal", () => {
    const r = clasificarReapertura({ resultado: "PERDIDO", orden: null });
    expect(r).toEqual({ soloAdmin: false, pideMotivo: false, aviso: null });
  });

  it("con la orden en venta pide ADMIN y motivo: hay ingreso contado", () => {
    const r = clasificarReapertura({
      resultado: "GANADO",
      orden: { folio: "OV-2026-0007", estatus: "VENTA" },
    });
    expect(r.soloAdmin).toBe(true);
    expect(r.pideMotivo).toBe(true);
    // El aviso tiene que decir la verdad: reabrir NO cancela la orden.
    expect(r.aviso).toContain("OV-2026-0007");
    expect(r.aviso).toContain("no la cancela");
  });

  it("con la orden en borrador no pide ADMIN: todavía no hay ingreso", () => {
    const r = clasificarReapertura({
      resultado: "GANADO",
      orden: { folio: "OV-2026-0008", estatus: "BORRADOR" },
    });
    expect(r.soloAdmin).toBe(false);
    expect(r.aviso).toContain("OV-2026-0008");
  });

  it("un deal NO cerrado no lleva reglas de reapertura, ni con orden vinculada", () => {
    // Reactivar un SUSPENDIDO no es una reapertura. Si esto mirara solo la orden, un deal
    // en pausa con venta facturada le pediría ADMIN a quien quisiera reactivarlo — un
    // bloqueo que el server ni siquiera aplica, o sea inventado por la pantalla.
    for (const resultado of ["ABIERTO", "SUSPENDIDO"]) {
      const r = clasificarReapertura({
        resultado,
        orden: { folio: "OV-2026-0009", estatus: "VENTA" },
      });
      expect(r).toEqual({ soloAdmin: false, pideMotivo: false, aviso: null });
    }
  });

  it("nunca bloquea: misma política que el borrado (un callejón sin salida es peor)", () => {
    const casos = [null, { folio: "F", estatus: "VENTA" }, { folio: "F", estatus: "COTIZADO" }];
    for (const orden of casos) {
      // La forma del tipo ya garantiza que no hay "prohibido": lo que varía es quién y con
      // qué aviso. Este test fija esa decisión de diseño para que no se revierta sin querer.
      const r = clasificarReapertura({ resultado: "GANADO", orden });
      expect(typeof r.soloAdmin).toBe("boolean");
    }
  });
});

describe("handoffGanado — el freno del ingreso duplicado", () => {
  const deal = {
    id: "d1",
    cliente_id: "c1",
    vendedor_id: "v1",
    nombre: "Portal B2B",
    valor: 180000,
    orden_id: null as string | null,
  };

  it("sin orden previa manda a crear una nueva", () => {
    expect(handoffGanado(deal)).toEqual({
      deal_id: "d1",
      cliente_id: "c1",
      vendedor_id: "v1",
      descripcion: "Portal B2B",
      valor: 180000,
    });
  });

  it("si el deal YA tiene orden, se retoma esa y no se crea otra", () => {
    // El caso del bug: ganar → reabrir → volver a ganar. Antes redirigía siempre a "nueva
    // orden" y el vínculo del alta fallaba en silencio (guarda orden_id: null), dejando DOS
    // órdenes de venta para el mismo negocio y el ingreso contado dos veces.
    expect(handoffGanado({ ...deal, orden_id: "o-existente" })).toEqual({ orden_id: "o-existente" });
  });

  it("el hand-off de una orden existente no arrastra datos para crear otra", () => {
    // Si viajara cliente_id/valor, un caller distraído podría seguir el camino de alta.
    const h = handoffGanado({ ...deal, orden_id: "o-existente" });
    expect(Object.keys(h)).toEqual(["orden_id"]);
  });
});
