/**
 * Tipos de datos para el módulo de Órdenes de Venta.
 * Todos los campos Decimal/Date ya serializados como primitivos JS.
 */
import type { ModoVista } from "@/lib/ventas-vista";

export type EstatusOrden = "BORRADOR" | "COTIZADO" | "VENTA";
export type Moneda = "MXN" | "USD";

/**
 * SSOT del estatus de una orden — mismo patrón que `types/crm.ts` usa para los enums del CRM
 * (`TAMANOS_EMPRESA` + `TAMANO_EMPRESA_LABEL`, `RESULTADOS_DEAL`, …).
 *
 * Los tres valores estaban repetidos a mano en seis archivos y la etiqueta en tres: el filtro
 * de Ventas, el esquema de zod, el `parse` de los filtros y el importador tenían cada uno su
 * copia. Agregar un cuarto estatus obligaba a acordarse de los seis; olvidarse de uno no rompe
 * la compilación, solo hace que una pantalla ignore el valor nuevo en silencio.
 *
 * El orden del array es el del ciclo de vida (borrador → cotizado → venta), y de ahí sale el
 * orden de los `<select>`: la lista es también la fuente del orden en pantalla.
 */
export const ESTATUS_ORDEN: EstatusOrden[] = ["BORRADOR", "COTIZADO", "VENTA"];

export const ESTATUS_ORDEN_META: Record<EstatusOrden, { label: string; chip: string }> = {
  BORRADOR: { label: "Borrador", chip: "bg-gray-100 text-gray-700" },
  COTIZADO: { label: "Cotizado", chip: "bg-blue-100 text-blue-700" },
  VENTA: { label: "Venta", chip: "bg-green-100 text-green-700" },
};

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

/** Los KPIs de la cabecera de Ventas. Los calcula `lib/kpis.ts` sobre las órdenes ya cargadas. */
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
  /**
   * Agrupado por cliente o lista plana. Vive acá y no en el estado del componente para viajar
   * en la URL (es un link que se comparte) y de paso ser recordado por la cookie de memoria.
   */
  vista: ModoVista;
}
