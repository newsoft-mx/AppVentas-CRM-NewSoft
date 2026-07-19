import { toDirectorioItem } from "@/lib/contactos-directorio";

// toDirectorioItem toma un Contacto con sus deal_links (payload de Prisma) y lo resume para el
// directorio. Construimos payloads mínimos (cast) y verificamos los agregados derivados:
// #deals, roles distintos, responsables deduplicados y la última actividad.

type Link = {
  rol: string;
  deal: { vendedor: { id: string; nombre: string } | null };
  actividades: { created_at: Date; fecha_evento: Date | null; fecha_tarea: Date | null }[];
};

function contacto(deal_links: Link[], over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1", cliente_id: "cl1", nombre: "Ana", email: "ana@x.mx", telefono: "555", whatsapp: null,
    cargo: "Compras", es_principal: true, activo: true, created_at: new Date("2026-01-01"),
    cliente: { id: "cl1", nombre: "ACME", estatus: "ACTIVO" },
    deal_links,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const link = (rol: string, vendedor: Link["deal"]["vendedor"], actividades: Link["actividades"] = []): Link =>
  ({ rol, deal: { vendedor }, actividades });

describe("toDirectorioItem", () => {
  it("sin deals: num_deals 0, roles/responsables vacíos, última actividad null", () => {
    const r = toDirectorioItem(contacto([]));
    expect(r.num_deals).toBe(0);
    expect(r.roles).toEqual([]);
    expect(r.responsables).toEqual([]);
    expect(r.ultima_actividad).toBeNull();
    expect(r.cliente).toEqual({ id: "cl1", nombre: "ACME", estatus: "ACTIVO" });
    expect(r.es_principal).toBe(true);
  });

  it("colapsa roles y responsables repetidos", () => {
    const vic = { id: "v1", nombre: "Víctor" };
    const r = toDirectorioItem(
      contacto([link("DECISOR", vic), link("DECISOR", vic), link("OTRO", { id: "v2", nombre: "Gaby" })])
    );
    expect(r.num_deals).toBe(3);
    expect(r.roles.sort()).toEqual(["DECISOR", "OTRO"]);
    expect(r.responsables).toHaveLength(2);
    expect(r.responsables.map((x) => x.id).sort()).toEqual(["v1", "v2"]);
  });

  it("ignora deals sin vendedor asignado en responsables", () => {
    const r = toDirectorioItem(contacto([link("OTRO", null), link("OTRO", { id: "v1", nombre: "Víctor" })]));
    expect(r.responsables.map((x) => x.id)).toEqual(["v1"]);
  });

  it("última actividad = la más reciente; fecha_evento manda sobre created_at", () => {
    const r = toDirectorioItem(
      contacto([
        link("OTRO", null, [{ created_at: new Date("2026-05-01"), fecha_evento: new Date("2026-06-15"), fecha_tarea: null }]),
        link("OTRO", null, [{ created_at: new Date("2026-07-01"), fecha_evento: new Date("2026-03-01"), fecha_tarea: null }]),
      ])
    );
    // Máximo entre 2026-06-15 (evento) y 2026-03-01 (evento del segundo) → junio.
    expect(r.ultima_actividad).toBe(new Date("2026-06-15").toISOString());
  });

  it("cae a fecha_tarea y luego a created_at cuando falta fecha_evento", () => {
    const r = toDirectorioItem(
      contacto([link("OTRO", null, [{ created_at: new Date("2026-01-10"), fecha_evento: null, fecha_tarea: new Date("2026-02-20") }])])
    );
    expect(r.ultima_actividad).toBe(new Date("2026-02-20").toISOString());
  });
});
