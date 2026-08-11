import { clasificarBorrado } from "@/lib/deals";
import { scopeDealWhere } from "@/lib/access-control";
import { RESULTADOS_CERRADOS, RESULTADOS_DEAL } from "@/types/crm";
import type { SessionPayload } from "@/lib/session";

// Invariante cross-módulo: "borrar saca al deal de la operación, no del histórico".
//
// La regla vive repartida en dos módulos que no se conocen:
//   · lib/deals        decide si el borrado DESTRUYE o MARCA
//   · lib/access-control decide qué deals VEN los reportes
//
// Si se separan, el bug vuelve en silencio: alcanza con que alguien haga que un cerrado se
// destruya (lib/deals) para que el reporte no tenga qué contar, por más que access-control
// lo pida. Estos tests atan las dos puntas.

const admin = { userId: "u1", rol: "ADMIN", email: "a@x.mx", vendedorId: null } as unknown as SessionPayload;

const base = { resultado: "ABIERTO", orden_id: null, actividades_reales: 0, contactos: 0 };

describe("invariante: lo que sigue contando en los reportes no se puede destruir", () => {
  it("todo resultado que los reportes rescatan del borrado, sobrevive al borrado", () => {
    // Los reportes (alcance HISTORICO) rescatan los cerrados aunque estén eliminados.
    // Entonces clasificarBorrado NO puede destruirlos: no habría fila que contar.
    for (const resultado of RESULTADOS_CERRADOS) {
      expect(clasificarBorrado({ ...base, resultado }).clase).toBe("MARCAR");
    }
  });

  it("el alcance HISTORICO rescata exactamente los resultados cerrados", () => {
    const where = scopeDealWhere(admin, {}, { alcance: "HISTORICO" }) as {
      OR: { eliminada?: boolean; resultado?: { in: string[] } }[];
    };
    const rescatados = where.OR.find((c) => c.resultado)?.resultado?.in;
    expect(rescatados).toEqual(RESULTADOS_CERRADOS);
  });

  it("los NO cerrados sí se pueden destruir: no hay estadística que perder", () => {
    // El lead basura del form web tiene que poder desaparecer de verdad; si no, la BD se
    // llena de spam marcado. Este es el otro lado de la invariante.
    const abiertos = RESULTADOS_DEAL.filter((r) => !RESULTADOS_CERRADOS.includes(r));
    for (const resultado of abiertos) {
      expect(clasificarBorrado({ ...base, resultado }).clase).toBe("FISICO");
    }
  });

  it("la operación del día a día (OPERATIVO) sigue sin ver ningún borrado", () => {
    // El cambio no debe filtrar borrados al pipeline: ahí se sigue trabajando sin ellos.
    expect(scopeDealWhere(admin, {}, { alcance: "OPERATIVO" })).toEqual({ eliminada: false });
    expect(scopeDealWhere(admin, {})).toEqual({ eliminada: false });
  });
});
