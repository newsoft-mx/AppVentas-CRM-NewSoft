import { netAmount, sumaNetaMxn, type NetAmountFields } from "@/lib/net-amounts";
import type { ClienteStats } from "@/types/clientes";

/**
 * Estadísticas de ventas de un cliente, derivadas de sus órdenes.
 *
 * Es el único lugar donde se calculan: antes el mismo literal de cuatro campos estaba copiado
 * en cinco endpoints, y cualquier cambio de criterio (como el de `grand_total_mxn`) había que
 * acordarse de replicarlo en los cinco.
 *
 * `total_mxn` y `total_usd` son sumas en la MONEDA ORIGINAL — no se convierten, por eso usan
 * `netAmount`. `grand_total_mxn` sí convierte, y por lo tanto puede omitir: una orden en USD
 * sin tipo de cambio no se puede expresar en pesos. Por eso viaja `ordenes_sin_tipo_cambio`:
 * quien pinte `grand_total_mxn` tiene que poder decir cuántas quedaron afuera, o el número
 * miente por omisión.
 */
export function statsDeOrdenes(ordenes: readonly NetAmountFields[]): ClienteStats {
  const { mxn, sin_tipo_cambio } = sumaNetaMxn(ordenes);
  return {
    num_ordenes: ordenes.length,
    total_mxn: ordenes
      .filter((o) => o.moneda === "MXN")
      .reduce((s, o) => s + netAmount(o), 0),
    total_usd: ordenes
      .filter((o) => o.moneda === "USD")
      .reduce((s, o) => s + netAmount(o), 0),
    grand_total_mxn: mxn,
    ordenes_sin_tipo_cambio: sin_tipo_cambio,
  };
}
