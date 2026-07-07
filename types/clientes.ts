/**
 * Tipos de datos para el módulo de Clientes.
 */

export interface CondicionResumen {
  id: string;
  nombre: string;
  dias_credito: number | null;
}

/** Totales de ventas por cliente, separados por moneda */
export interface ClienteStats {
  num_ordenes: number;
  /** Suma neta sin IVA de órdenes en MXN (en pesos) */
  total_mxn: number;
  /** Suma neta sin IVA de órdenes en USD (en dólares) */
  total_usd: number;
  /** Suma neta sin IVA de TODAS las órdenes (todo convertido a pesos) */
  grand_total_mxn: number;
}

/** Cliente serializado con estadísticas de ventas */
export interface ClienteConStats {
  id: string;
  nombre: string;
  rfc: string | null;
  contacto: string;
  ciudad: string;
  email: string | null;
  telefono: string | null;
  condicion_pago_id: string;
  condicion_pago: CondicionResumen;
  notas: string | null;
  estatus: EstatusCliente;
  activo: boolean;
  created_at: string;
  updated_at: string;
  stats: ClienteStats;
}

export type EstatusCliente = "PROSPECTO" | "ACTIVO" | "INACTIVO";
export const ESTATUS_CLIENTE_META: Record<EstatusCliente, { label: string; chip: string }> = {
  PROSPECTO: { label: "Prospecto", chip: "bg-amber-50 text-amber-700" },
  ACTIVO: { label: "Cliente", chip: "bg-emerald-50 text-emerald-700" },
  INACTIVO: { label: "Inactivo", chip: "bg-gray-100 text-gray-500" },
};

/** Payload para crear o actualizar un cliente */
export interface ClienteInput {
  nombre: string;
  rfc?: string | null;
  contacto: string;
  ciudad: string;
  email?: string | null;
  telefono?: string | null;
  condicion_pago_id: string;
  notas?: string | null;
}
