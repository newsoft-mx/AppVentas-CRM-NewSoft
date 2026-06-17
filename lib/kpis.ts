import type { OrdenResumen, KpisData } from "@/types/ordenes";
import { netAmountMxn } from "@/lib/net-amounts";

export function calcularKpis(ordenes: OrdenResumen[]): KpisData {
  const total_ordenes = ordenes.length;
  const borradores = ordenes.filter((o) => o.estatus === "BORRADOR").length;
  const cotizadas = ordenes.filter((o) => o.estatus === "COTIZADO").length;
  const ventas = ordenes.filter((o) => o.estatus === "VENTA").length;

  const ventas_mxn = ordenes
    .filter((o) => o.estatus === "VENTA")
    .reduce((s, o) => s + netAmountMxn(o), 0);

  const pipeline_mxn = ordenes
    .filter((o) => o.estatus === "COTIZADO")
    .reduce((s, o) => s + netAmountMxn(o), 0);

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
