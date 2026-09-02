import type { OrdenResumen } from "@/types/ordenes";
import { ESTATUS_LABELS } from "@/lib/utils";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";
import { fechaFiltroOrden } from "@/lib/filter-utils";

/**
 * La lista de órdenes, lista para pegar en una planilla.
 *
 * Un equipo comercial vive de sacar la lista a Excel, y hasta ahora no había forma: había que
 * copiar a mano de la pantalla.
 *
 * Puro a propósito: define QUÉ columnas tiene el archivo, en un solo lugar y sin tocar el DOM
 * ni la red, así se puede probar de verdad. Lo que hace el navegador con esto —armar el
 * archivo y bajarlo— son diez líneas sin decisiones.
 *
 * Dos reglas del repo que acá importan:
 * - Los montos van **netos, sin IVA** (`subtotal_con_descuento`), igual que la tabla y los
 *   KPIs de la pantalla. Un archivo que sume distinto que el total de arriba es peor que no
 *   tener archivo.
 * - Una orden en USD **sin tipo de cambio** no se puede expresar en pesos. La celda queda
 *   VACÍA, no en cero: un cero se suma y miente; una celda vacía se ve.
 */

export const COLUMNAS_ORDENES = [
  "Folio",
  "Fecha",
  "Cliente",
  "Descripción",
  "Tipo",
  "Condición",
  "Vendedor",
  "Estatus",
  "Moneda",
  "Tipo de cambio",
  "Neto (moneda original)",
  "Neto MXN",
] as const;

const soloFecha = (iso: string) => iso.slice(0, 10);

export function filaDeOrden(o: OrdenResumen): string[] {
  const enPesos = netAmountMxn(o);

  return [
    o.folio,
    soloFecha(fechaFiltroOrden(o)),
    o.cliente.nombre,
    o.descripcion,
    o.tipo_cotizacion.nombre,
    o.condicion_pago.nombre,
    o.vendedor?.nombre ?? "",
    ESTATUS_LABELS[o.estatus],
    o.moneda,
    o.tipo_cambio != null ? String(o.tipo_cambio) : "",
    String(netAmount(o)),
    enPesos === null ? "" : String(enPesos),
  ];
}

export function filasDeOrdenes(ordenes: OrdenResumen[]): string[][] {
  return [[...COLUMNAS_ORDENES], ...ordenes.map(filaDeOrden)];
}

/**
 * Filas → CSV. Se citan TODAS las celdas: los nombres de cliente y las descripciones traen
 * comas y saltos de línea a diario, y una sola celda mal citada corre todas las columnas de esa
 * fila sin que nadie lo note hasta que el total no cuadra.
 */
export function aCsv(filas: string[][]): string {
  return filas
    .map((fila) => fila.map((celda) => `"${String(celda ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

/** `ventas-2026-08-31.csv` — con la fecha adentro, para que no se pisen en la carpeta. */
export function nombreDeArchivo(hoy: string): string {
  return `ventas-${hoy.slice(0, 10)}.csv`;
}
