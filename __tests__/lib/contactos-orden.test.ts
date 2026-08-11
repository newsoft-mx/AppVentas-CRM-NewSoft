import {
  EXTRACTORES_CONTACTO, ORDEN_INICIAL_CONTACTOS, type CampoContacto,
} from "@/lib/contactos-orden";
import { ordenarFilas } from "@/lib/tabla-orden";
import type { ContactoDirectorioItem } from "@/types/contactos-directorio";

function contacto(p: Partial<ContactoDirectorioItem> & { nombre: string }): ContactoDirectorioItem {
  return {
    id: p.nombre,
    cargo: null,
    email: null,
    telefono: null,
    whatsapp: null,
    es_principal: false,
    cliente: { id: "c1", nombre: "ACME", estatus: "ACTIVO" },
    num_deals: 0,
    roles: [],
    responsables: [],
    ultima_actividad: null,
    ...p,
  };
}

const porNombre = (filas: ContactoDirectorioItem[], campo: CampoContacto, sentido: "asc" | "desc") =>
  ordenarFilas(filas, { campo, sentido }, EXTRACTORES_CONTACTO).map((c) => c.nombre);

describe("ORDEN_INICIAL_CONTACTOS", () => {
  it("arranca alfabético, no en 'sin orden'", () => {
    expect(ORDEN_INICIAL_CONTACTOS).toEqual({ campo: "nombre", sentido: "asc" });
  });

  it("reubica una alta que llegó al final de la lista — es la regresión que cubre", () => {
    // El alta hace `[...contactos, nuevo]`: appendea. Con `campo: null` el nuevo contacto se
    // quedaba debajo de la Z, en una lista donde todo lo demás estaba A–Z, y no había forma
    // de que volviera a su lugar sin recargar la página.
    const conAltaAlFinal = [
      contacto({ nombre: "Beatriz Solís" }),
      contacto({ nombre: "Zulema Vega" }),
      contacto({ nombre: "Aarón Díaz" }), // recién creado
    ];
    const resultado = ordenarFilas(conAltaAlFinal, ORDEN_INICIAL_CONTACTOS, EXTRACTORES_CONTACTO);
    expect(resultado.map((c) => c.nombre)).toEqual([
      "Aarón Díaz", "Beatriz Solís", "Zulema Vega",
    ]);
  });
});

describe("EXTRACTORES_CONTACTO", () => {
  it("teléfono cae al whatsapp: se ordena por lo que la columna muestra", () => {
    const filas = [
      contacto({ nombre: "Con wa", whatsapp: "5599" }),
      contacto({ nombre: "Con tel", telefono: "5511" }),
    ];
    expect(porNombre(filas, "telefono", "asc")).toEqual(["Con tel", "Con wa"]);
  });

  it("los contactos sin dato quedan al final en los DOS sentidos", () => {
    const filas = [
      contacto({ nombre: "Sin nada" }),
      contacto({ nombre: "Con tel", telefono: "5511" }),
      contacto({ nombre: "Con otro tel", telefono: "5533" }),
    ];
    expect(porNombre(filas, "telefono", "asc").at(-1)).toBe("Sin nada");
    expect(porNombre(filas, "telefono", "desc").at(-1)).toBe("Sin nada");
  });

  it("sin actividad va al final, aun ordenando de más reciente a más viejo", () => {
    const filas = [
      contacto({ nombre: "Nunca" }),
      contacto({ nombre: "Ayer", ultima_actividad: "2026-08-10T10:00:00.000Z" }),
      contacto({ nombre: "El mes pasado", ultima_actividad: "2026-07-01T10:00:00.000Z" }),
    ];
    expect(porNombre(filas, "actividad", "desc")).toEqual(["Ayer", "El mes pasado", "Nunca"]);
    expect(porNombre(filas, "actividad", "asc")).toEqual(["El mes pasado", "Ayer", "Nunca"]);
  });

  it("cero deals es un dato, no un vacío: ordena como número", () => {
    const filas = [
      contacto({ nombre: "Tres", num_deals: 3 }),
      contacto({ nombre: "Cero", num_deals: 0 }),
      contacto({ nombre: "Uno", num_deals: 1 }),
    ];
    expect(porNombre(filas, "deals", "asc")).toEqual(["Cero", "Uno", "Tres"]);
  });
});
