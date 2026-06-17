/**
 * Tipos de datos para el módulo de Órdenes de Venta.
 * Todos los campos Decimal/Date ya serializados como primitivos JS.
 */

export type EstatusOrden = "BORRADOR" | "COTIZADO" | "VENTA";
export type Moneda = "MXN" | "USD";

export interface Partida {
  id: string;
  orden_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total_partida: number;
  orden_display: number;
  created_at: string;
}

/** Orden completa con todas las relaciones — para detalle / edición */
export interface OrdenDetalle {
  id: string;
  folio: string;
  cliente_id: string;
  cliente: {
    id: string;
    nombre: string;
    rfc: string | null;
    contacto: string;
    email: string | null;
    ciudad: string;
  };
  tipo_cotizacion_id: string;
  tipo_cotizacion: { id: string; nombre: string };
  condicion_pago_id: string;
  condicion_pago: { id: string; nombre: string };
  vendedor_id: string | null;
  vendedor: { id: string; nombre: string } | null;
  descripcion: string;
  estatus: EstatusOrden;
  moneda: Moneda;
  tipo_cambio: number | null;
  fecha_venta: string | null;
  vigencia: string | null;
  aplica_iva: boolean;
  tasa_iva: number | null;
  descuento_porcentaje: number | null;
  descuento_descripcion: string | null;
  subtotal: number;
  monto_descuento: number;
  subtotal_con_descuento: number;
  monto_iva: number;
  total: number;
  total_mxn: number;
  notas: string | null;
  duplicada_de_id: string | null;
  created_at: string;
  updated_at: string;
  partidas: Partida[];
}

/** Orden resumida para la tabla del dashboard */
export interface OrdenResumen {
  id: string;
  folio: string;
  descripcion: string;
  estatus: EstatusOrden;
  moneda: Moneda;
  tipo_cambio: number | null;
  fecha_venta: string | null;
  subtotal_con_descuento: number;
  total: number;
  total_mxn: number;
  created_at: string;
  cliente: { id: string; nombre: string };
  tipo_cotizacion: { id: string; nombre: string };
  condicion_pago: { id: string; nombre: string };
  vendedor: { id: string; nombre: string } | null;
}

/** Resultado del endpoint GET /api/ordenes/kpis */
export interface KpisData {
  total_ordenes: number;
  borradores: number;
  cotizadas: number;
  ventas: number;
  ventas_mxn: number;       // suma neta sin IVA donde estatus=VENTA
  pipeline_mxn: number;     // suma neta sin IVA donde estatus=COTIZADO
  tasa_conversion: number;  // porcentaje
  suma_total_mxn: number;   // suma neta sin IVA de órdenes MXN
  suma_total_usd: number;   // suma neta sin IVA de órdenes USD
}

/** Payload para crear o actualizar una orden */
export interface OrdenInput {
  cliente_id: string;
  tipo_cotizacion_id: string;
  condicion_pago_id: string;
  vendedor_id?: string | null;
  descripcion: string;
  estatus: EstatusOrden;
  moneda: Moneda;
  tipo_cambio?: number | null;
  fecha_venta?: string | null;
  aplica_iva: boolean;
  tasa_iva?: number | null;
  descuento_porcentaje?: number | null;
  descuento_descripcion?: string | null;
  notas?: string | null;
  partidas: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    orden_display: number;
  }>;
}

/** Parámetros de filtro para órdenes y KPIs */
export interface FiltroOrdenes {
  ano: number[];
  q: number[];   // 1-4
  mes: number[]; // 1-12
  estatus: EstatusOrden[];
  cliente_id: string[];
  tipo_cotizacion_id: string[];
  vendedor_id: string[];
}
