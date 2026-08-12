/**
 * Qué significa ordenar por cada columna en las tablas de Reportes.
 *
 * El server ya las manda ordenadas (por monto o por tasa, descendente). Eso se conserva como el
 * orden natural: el estado inicial es `campo: null`, que devuelve la lista tal cual llega. Los
 * encabezados sirven para mirarla desde otro ángulo, no para reemplazar el criterio por defecto.
 *
 * "Top 10 clientes" queda deliberadamente AFUERA: ahí el `#` es el significado de la tabla, y
 * dejar reordenarla convertiría un ranking en una lista cualquiera con números pegados que ya
 * no dirían nada.
 */
import type { ExtractoresOrden } from "@/lib/tabla-orden";
import type { ConversionTipoItem, VentasVendedorItem } from "@/types/reportes";

// ── Conversión por tipo de cotización ─────────────────────────

export type CampoConversion = "tipo" | "total" | "cotizadas" | "ventas" | "tasa";

export const EXTRACTORES_CONVERSION: ExtractoresOrden<ConversionTipoItem, CampoConversion> = {
  tipo: (c) => c.tipo,
  total: (c) => c.total,
  cotizadas: (c) => c.cotizadas,
  ventas: (c) => c.ventas,
  // La barra de "Progreso" es esta misma tasa dibujada: no es una columna aparte.
  tasa: (c) => c.tasa,
};

// ── Ventas por vendedor ───────────────────────────────────────

export type CampoVentasVendedor = "vendedor" | "ordenes_venta" | "total_mxn";

export const EXTRACTORES_VENTAS_VENDEDOR: ExtractoresOrden<
  VentasVendedorItem,
  CampoVentasVendedor
> = {
  vendedor: (v) => v.vendedor,
  ordenes_venta: (v) => v.ordenes_venta,
  total_mxn: (v) => v.total_mxn,
};
