/**
 * Utilidades compartidas — Newsoft Sales
 * Conversión de moneda, formateo de números, generación de folios.
 */

import Decimal from "decimal.js";
import { TZ_NEGOCIO } from "@/lib/tz";

// ── Configuración de Decimal.js ──────────────────────────────
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── Formateo de moneda ───────────────────────────────────────

/**
 * Formatea un número como moneda MXN
 * Ej: 150000 → "$150,000.00"
 */
export function formatMXN(amount: number | string | Decimal): string {
  const num = new Decimal(amount.toString()).toNumber();
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Formatea un número como moneda USD
 * Ej: 2160 → "USD $2,160.00"
 */
export function formatUSD(amount: number | string | Decimal): string {
  const num = new Decimal(amount.toString()).toNumber();
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Formatea según la moneda de la orden
 */
export function formatMoneda(
  amount: number | string | Decimal,
  moneda: "MXN" | "USD"
): string {
  return moneda === "MXN" ? formatMXN(amount) : formatUSD(amount);
}

// Moneda MXN sin decimales (usado en reportes): 12500 → "$12,500"
export function formatMXNEntero(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

// Monto compacto para tarjetas/listas del CRM: $1.2M / $950K / $500
export function formatCompacto(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + n.toLocaleString("es-MX");
}

// Fecha + hora corta es-MX: "29 jun, 03:00 p.m." (usado en bitácora, Kanban y acciones)
export function formatFechaHora(iso: string | Date): string {
  // TZ del negocio fija (CDMX): mismo resultado en server y cliente → sin mismatch
  // de hidratación, y hora consistente para todos los usuarios (negocio en México).
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ_NEGOCIO,
  });
}

// ── Cálculos de orden (se usan en el backend) ────────────────

export interface CalculoOrden {
  subtotal: Decimal;
  monto_descuento: Decimal;
  subtotal_con_descuento: Decimal;
  monto_iva: Decimal;
  total: Decimal;
  total_mxn: Decimal;
}

/**
 * Calcula todos los montos derivados de una orden.
 * IMPORTANTE: Esta función se llama SOLO desde el backend (Route Handlers).
 *
 * @param partidas - Lista de partidas con cantidad y precio_unitario
 * @param descuento_porcentaje - % de descuento (0-100), null si no aplica
 * @param aplica_iva - Si se aplica IVA
 * @param tasa_iva - Tasa de IVA en % (ej: 16.00)
 * @param moneda - "MXN" | "USD"
 * @param tipo_cambio - Tipo de cambio USD→MXN (requerido si moneda=USD)
 */
export function calcularOrden(params: {
  partidas: Array<{ cantidad: string | number; precio_unitario: string | number }>;
  descuento_porcentaje?: string | number | null;
  aplica_iva: boolean;
  tasa_iva?: string | number | null;
  moneda: "MXN" | "USD";
  tipo_cambio?: string | number | null;
}): CalculoOrden {
  const { partidas, descuento_porcentaje, aplica_iva, tasa_iva, moneda, tipo_cambio } = params;

  // 1. Subtotal: suma de (cantidad * precio_unitario) de cada partida
  const subtotal = partidas.reduce((acc, p) => {
    const cant = new Decimal(p.cantidad.toString());
    const precio = new Decimal(p.precio_unitario.toString());
    return acc.plus(cant.times(precio));
  }, new Decimal(0));

  // 2. Descuento
  const pctDescuento =
    descuento_porcentaje != null
      ? new Decimal(descuento_porcentaje.toString())
      : new Decimal(0);

  const monto_descuento = subtotal
    .times(pctDescuento)
    .dividedBy(100)
    .toDecimalPlaces(2);

  const subtotal_con_descuento = subtotal.minus(monto_descuento);

  // 3. IVA
  const tasa = aplica_iva && tasa_iva != null
    ? new Decimal(tasa_iva.toString())
    : new Decimal(0);

  const monto_iva = subtotal_con_descuento
    .times(tasa)
    .dividedBy(100)
    .toDecimalPlaces(2);

  // 4. Total en moneda original
  const total = subtotal_con_descuento.plus(monto_iva).toDecimalPlaces(2);

  // 5. Total en MXN
  let total_mxn: Decimal;
  if (moneda === "USD" && tipo_cambio != null) {
    const tc = new Decimal(tipo_cambio.toString());
    total_mxn = total.times(tc).toDecimalPlaces(2);
  } else {
    total_mxn = total;
  }

  return {
    subtotal: subtotal.toDecimalPlaces(2),
    monto_descuento,
    subtotal_con_descuento: subtotal_con_descuento.toDecimalPlaces(2),
    monto_iva,
    total,
    total_mxn,
  };
}

// ── Generación de folio ──────────────────────────────────────

/**
 * Genera el folio de una orden.
 * Formato: {prefijo}{consecutivo con zero-padding a 5 dígitos}
 * Ej: prefijo="NS", consecutivo=1 → "NS00001"
 *     prefijo="NS", consecutivo=42 → "NS00042"
 */
export function generarFolio(prefijo: string, consecutivo: number): string {
  return `${prefijo}${String(consecutivo).padStart(5, "0")}`;
}

// ── Formateo de fechas ───────────────────────────────────────

/**
 * Formatea una fecha para mostrar en la UI.
 * Ej: 2026-04-15T00:00:00Z → "15/04/2026"
 */
export function formatFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Formatea una fecha para input[type="date"] (YYYY-MM-DD)
 */
export function fechaParaInput(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  return d.toISOString().split("T")[0];
}

// ── Labels de estatus ────────────────────────────────────────

export const ESTATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  COTIZADO: "Cotizado",
  VENTA: "Venta",
};

export const ESTATUS_COLORS: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  COTIZADO: "bg-blue-100 text-blue-700",
  VENTA: "bg-green-100 text-green-700",
};

// Transiciones de estatus permitidas según el documento funcional
export const TRANSICIONES_PERMITIDAS: Record<string, string[]> = {
  BORRADOR: ["COTIZADO", "VENTA"],
  COTIZADO: ["VENTA", "BORRADOR"],
  VENTA: ["COTIZADO"],
};

// Máquina de estados de la orden (Bloque F): SSOT de la validación de transición.
// La usan tanto PATCH /ordenes/:id/estatus como el PUT general, para que ninguna
// ruta pueda evitar la máquina. Un no-op (desde === hacia) es válido.
export function transicionOrdenPermitida(desde: string, hacia: string): boolean {
  return desde === hacia || (TRANSICIONES_PERMITIDAS[desde] ?? []).includes(hacia);
}

// Máquina de estados del resultado del deal (Bloque E). Coincide con lo que ofrece
// la UI: solo ABIERTO/SUSPENDIDO son mutables; GANADO/PERDIDO son terminales (no se
// reabren por esta vía — hacerlo dejaría la orden ganada colgando). SSOT usado por
// /resultado y /ganar para que ninguna ruta acepte transiciones ilegales.
export const TRANSICIONES_RESULTADO_DEAL: Record<string, string[]> = {
  ABIERTO: ["GANADO", "PERDIDO", "SUSPENDIDO"],
  SUSPENDIDO: ["GANADO", "PERDIDO", "ABIERTO"],
  GANADO: [],
  PERDIDO: [],
};

export function transicionResultadoPermitida(desde: string, hacia: string): boolean {
  return desde === hacia || (TRANSICIONES_RESULTADO_DEAL[desde] ?? []).includes(hacia);
}
