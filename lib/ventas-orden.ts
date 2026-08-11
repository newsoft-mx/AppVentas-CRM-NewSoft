/**
 * Qué significa ordenar por cada columna en la tabla de Órdenes.
 *
 * Vive en `lib/` y no dentro del componente por una razón práctica: jest corre en `node` y
 * solo toma `.ts`, así que nada que viva en un `.tsx` se puede testear. Estos extractores
 * eran funciones module-scope sin exportar dentro de TablaOrdenes — o sea, la única tabla que
 * ordenaba en toda la app **no tenía ni un test**.
 */
import { fechaFiltroOrden } from "@/lib/filter-utils";
import { netAmountMxn } from "@/lib/net-amounts";
import type { ExtractoresOrden } from "@/lib/tabla-orden";
import type { OrdenResumen } from "@/types/ordenes";

export type CampoOrden =
  | "folio"
  | "descripcion"
  | "tipo"
  | "condicion"
  | "total"
  | "estatus"
  | "fecha";

export const CAMPOS_ORDEN: readonly CampoOrden[] = [
  "folio", "descripcion", "tipo", "condicion", "total", "estatus", "fecha",
];

export const EXTRACTORES_ORDEN: ExtractoresOrden<OrdenResumen, CampoOrden> = {
  folio: (o) => o.folio,
  descripcion: (o) => o.descripcion,
  tipo: (o) => o.tipo_cotizacion.nombre,
  condicion: (o) => o.condicion_pago.nombre,
  // Neto sin IVA y convertido a MXN: ordenar por el monto crudo mezclaría monedas.
  total: (o) => netAmountMxn(o),
  estatus: (o) => o.estatus,
  // Date, no epoch: el comparador entiende Date y así el extractor dice qué ES el valor.
  // `fechaFiltroOrden` resuelve `fecha_venta ?? created_at`, igual que el filtro de período.
  fecha: (o) => new Date(fechaFiltroOrden(o)),
};
