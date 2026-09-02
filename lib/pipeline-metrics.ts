import { TEMPERATURAS_CALIENTES, type DealResultado, type Temperatura } from "@/types/crm";
import { netAmountMxn } from "@/lib/net-amounts";

// SSOT de las métricas de salud del pipeline (SOL-19). Un solo lugar calcula
// valor/activos/calientes/promedio sobre los deals ABIERTO, para que el
// encabezado del pipeline y el reporte de funnel NO diverjan.
export interface MetricasPipeline {
  valor_pipeline: number; // suma en MXN de los deals activos CONVERTIBLES
  deals_activos: number; // cantidad de deals ABIERTO
  calientes: number; // activos con temperatura caliente
  promedio_deal: number; // valor_pipeline / activos convertibles
  /**
   * Cuántos deals activos quedaron FUERA del total por estar en USD sin tipo de cambio.
   * La pantalla lo declara en vez de callarlo: un total incompleto y anunciado es honesto;
   * uno que miente por omisión, no. Mismo contrato que `sumaNetaMxn` para órdenes.
   */
  sin_tipo_cambio: number;
}

type DealMetrica = {
  valor: number;
  resultado: DealResultado;
  temperatura: Temperatura;
  moneda?: string;
  tipo_cambio?: number | { toNumber(): number } | null;
};

/**
 * El valor del pipeline se calcula con el MISMO contrato de moneda que las órdenes
 * (lib/net-amounts), y por el mismo motivo.
 *
 * Antes esto era `activos.reduce((s, d) => s + d.valor, 0)`: sumaba el número tal cual,
 * sin mirar la moneda, y el encabezado rotulaba el resultado "MXN en pipeline". Con un tipo
 * de cambio de ~17, un deal cargado en USD 50.000 entraba como $50.000 y subvaluaba el
 * pipeline en casi un millón de pesos, en silencio. Es exactamente el bug que el PR #115 ya
 * había matado del lado de las órdenes; del lado de los deals seguía vivo.
 *
 * Un deal en USD sin tipo de cambio NO se suma: se cuenta aparte y la pantalla lo dice.
 * Inventarle una paridad 1:1 es lo que producía el error; imputarle cero también mentiría,
 * por eso tampoco entra al denominador del promedio.
 */
export function metricasPipeline(deals: DealMetrica[]): MetricasPipeline {
  const activos = deals.filter((d) => d.resultado === "ABIERTO");

  let valor = 0;
  let sin_tipo_cambio = 0;
  for (const d of activos) {
    // `netAmountMxn` habla en términos de órdenes (subtotal_con_descuento); para un deal el
    // monto es `valor`. El contrato de conversión es el mismo y vive en un solo lugar.
    const mxn = netAmountMxn({
      moneda: d.moneda ?? "MXN",
      subtotal_con_descuento: d.valor,
      tipo_cambio: d.tipo_cambio ?? null,
    });
    if (mxn === null) sin_tipo_cambio++;
    else valor += mxn;
  }

  const convertibles = activos.length - sin_tipo_cambio;
  return {
    valor_pipeline: valor,
    deals_activos: activos.length,
    calientes: activos.filter((d) => TEMPERATURAS_CALIENTES.includes(d.temperatura)).length,
    // El denominador son solo los convertibles: dividir por todos le imputaría cero pesos a
    // los que no tienen tipo de cambio. Mismo criterio que `ticketPromedioMxn`.
    promedio_deal: convertibles > 0 ? valor / convertibles : 0,
    sin_tipo_cambio,
  };
}
