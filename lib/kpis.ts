import type { OrdenResumen, KpisData, EstatusOrden } from "@/types/ordenes";
import type { PipelineData } from "@/types/reportes";
import { sumaNetaMxn, type NetAmountFields } from "@/lib/net-amounts";

export function calcularKpis(ordenes: OrdenResumen[]): KpisData {
  const total_ordenes = ordenes.length;
  const borradores = ordenes.filter((o) => o.estatus === "BORRADOR").length;
  const cotizadas = ordenes.filter((o) => o.estatus === "COTIZADO").length;
  const ventas = ordenes.filter((o) => o.estatus === "VENTA").length;

  const ventas_mxn = sumaNetaMxn(ordenes.filter((o) => o.estatus === "VENTA")).mxn;

  const pipeline_mxn = sumaNetaMxn(ordenes.filter((o) => o.estatus === "COTIZADO")).mxn;

  const tasa_conversion =
    total_ordenes > 0 ? Math.round((ventas / total_ordenes) * 100) : 0;

  const suma_total_mxn = ordenes
    .filter((o) => o.moneda === "MXN")
    .reduce((s, o) => s + o.subtotal_con_descuento, 0);

  const suma_total_usd = ordenes
    .filter((o) => o.moneda === "USD")
    .reduce((s, o) => s + o.subtotal_con_descuento, 0);

  return {
    total_ordenes,
    borradores,
    cotizadas,
    ventas,
    ventas_mxn,
    pipeline_mxn,
    tasa_conversion,
    suma_total_mxn,
    suma_total_usd,
  };
}

/**
 * Los seis números del bloque "pipeline" de /reportes.
 *
 * Estaban calculados dos veces, con las mismas fórmulas y el mismo `select`: una en
 * `app/api/reportes/pipeline/route.ts` y otra en `app/(dashboard)/reportes/page.tsx`. Las dos
 * VIVAS y las dos alimentando la misma pantalla — la página pinta la suya al renderizar y
 * `ReportesClient` pide la de la ruta al cambiar de filtro. Dos copias de la misma cuenta
 * detrás de un solo número en pantalla es la forma más silenciosa de que ese número deje de
 * cuadrar: alcanza con que alguien corrija una.
 *
 * Recibe lo mínimo que necesita, no la orden entera, para que sirva desde el server sin
 * arrastrar tipos de Prisma.
 */
export function calcularPipeline(
  ordenes: ReadonlyArray<NetAmountFields & { estatus: EstatusOrden }>
): PipelineData {
  const de = (estatus: EstatusOrden) => ordenes.filter((o) => o.estatus === estatus);

  return {
    borradores_count: de("BORRADOR").length,
    cotizaciones_count: de("COTIZADO").length,
    ventas_count: de("VENTA").length,
    cotizaciones_mxn: sumaNetaMxn(de("COTIZADO")).mxn,
    ventas_mxn: sumaNetaMxn(de("VENTA")).mxn,
    total_ordenes: ordenes.length,
  };
}
