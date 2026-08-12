/**
 * Qué significa ordenar por cada columna en el directorio de Contactos.
 *
 * Vive en `lib/` por el mismo motivo que `lib/ventas-orden.ts`: jest corre en `node` y solo toma
 * `.ts`, así que nada que viva en un `.tsx` se puede testear.
 *
 * Reemplaza al `<select>` "Orden" que tenía dos opciones (A–Z y última actividad) que eran,
 * exactamente, dos de estos encabezados: dos controles para lo mismo, que además podían mostrar
 * cosas distintas.
 */
import type { ExtractoresOrden, OrdenTabla } from "@/lib/tabla-orden";
import type { ContactoDirectorioItem } from "@/types/contactos-directorio";

export type CampoContacto =
  | "nombre"
  | "organizacion"
  | "email"
  | "telefono"
  | "deals"
  | "actividad";

export const EXTRACTORES_CONTACTO: ExtractoresOrden<ContactoDirectorioItem, CampoContacto> = {
  nombre: (c) => c.nombre,
  organizacion: (c) => c.cliente.nombre,
  email: (c) => c.email,
  // La columna muestra el teléfono o, si no hay, el whatsapp: se ordena por lo que se ve.
  telefono: (c) => c.telefono ?? c.whatsapp,
  deals: (c) => c.num_deals,
  // Los contactos sin actividad quedan al final en los DOS sentidos (regla del cimiento).
  // Antes caían al final solo por casualidad, porque el `?? ""` los mandaba al fondo en desc.
  actividad: (c) => (c.ultima_actividad ? new Date(c.ultima_actividad) : null),
};

/**
 * El directorio arranca alfabético, y eso se declara ACÁ, en el cliente, no se hereda del
 * `orderBy` del server.
 *
 * Parece redundante —el server ya manda los contactos por nombre asc— pero no lo es: dar de alta
 * o renombrar un contacto muta la lista en el cliente sin volver a pedirla, y con el orden en
 * `campo: null` la fila nueva se quedaba pegada al final, debajo de la Z. Con el campo fijado,
 * `ordenarFilas` la reubica sola en cada recálculo.
 */
export const ORDEN_INICIAL_CONTACTOS: OrdenTabla<CampoContacto> = {
  campo: "nombre",
  sentido: "asc",
};
