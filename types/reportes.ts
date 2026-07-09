/**
 * Tipos de datos para el módulo de Reportes.
 */

/** Un mes en el gráfico de ventas mensuales */
export interface MesVenta {
  mes: number;           // 1-12
  nombre: string;        // "Ene", "Feb", ...
  actual: number;        // monto neto MXN ventas cerradas año actual
  anterior: number;      // monto neto MXN ventas cerradas año anterior (0 si no hay)
}

export interface VentasMensualesData {
  data: MesVenta[];
  ano_actual: number;
  ano_anterior: number;
  total_actual: number;
  total_anterior: number;
}

/** Pipeline: distribución de órdenes por estatus */
export interface PipelineData {
  borradores_count: number;
  cotizaciones_count: number;
  ventas_count: number;
  cotizaciones_mxn: number;
  ventas_mxn: number;
  total_ordenes: number;
}

/** Un cliente en el ranking de top clientes */
export interface TopClienteItem {
  cliente_id: string;
  nombre: string;
  ordenes_totales: number;
  ordenes_venta: number;
  total_mxn: number;
}

/** Ventas cerradas agregadas por vendedor */
export interface VentasVendedorItem {
  vendedor_id: string | null;
  vendedor: string;
  ordenes_venta: number;
  total_mxn: number;
}

/** Ventas cerradas agregadas por tipo / línea de producto */
export interface VentasTipoItem {
  tipo_id: string;
  tipo: string;
  color: string;
  ordenes_venta: number;
  total_mxn: number;
}

/** Un tipo de cotización con su tasa de conversión */
export interface ConversionTipoItem {
  tipo_id: string;
  tipo: string;
  total: number;
  ventas: number;
  cotizadas: number;
  tasa: number; // porcentaje 0-100
}

/** KPIs adicionales del módulo de reportes */
export interface ReporteStats {
  ticket_promedio_mxn: number;
  tiempo_promedio_cierre_dias: number | null;
  total_ventas: number;
  total_cotizadas: number;
}

/** Payload completo pasado al client component en el render inicial */
export interface ReportesInitialData {
  ventasMensuales: VentasMensualesData;
  pipeline: PipelineData;
  topClientes: TopClienteItem[];
  ventasPorVendedor: VentasVendedorItem[];
  ventasPorTipo: VentasTipoItem[];
  conversion: ConversionTipoItem[];
  stats: ReporteStats;
}

/** Filtros del módulo de reportes */
export interface FiltroReportes {
  ano: number[];
  q: number[];
  mes: number[];
}
