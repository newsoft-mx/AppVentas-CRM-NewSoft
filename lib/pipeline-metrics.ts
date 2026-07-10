import { TEMPERATURAS_CALIENTES, type DealResultado, type Temperatura } from "@/types/crm";

// SSOT de las métricas de salud del pipeline (SOL-19). Un solo lugar calcula
// valor/activos/calientes/promedio sobre los deals ABIERTO, para que el
// encabezado del pipeline y el reporte de funnel NO diverjan.
export interface MetricasPipeline {
  valor_pipeline: number; // suma del valor de los deals activos
  deals_activos: number; // cantidad de deals ABIERTO
  calientes: number; // activos con temperatura caliente
  promedio_deal: number; // valor_pipeline / deals_activos
}

type DealMetrica = { valor: number; resultado: DealResultado; temperatura: Temperatura };

export function metricasPipeline(deals: DealMetrica[]): MetricasPipeline {
  const activos = deals.filter((d) => d.resultado === "ABIERTO");
  const valor = activos.reduce((s, d) => s + d.valor, 0);
  const calientes = activos.filter((d) => TEMPERATURAS_CALIENTES.includes(d.temperatura)).length;
  return {
    valor_pipeline: valor,
    deals_activos: activos.length,
    calientes,
    promedio_deal: activos.length ? valor / activos.length : 0,
  };
}
