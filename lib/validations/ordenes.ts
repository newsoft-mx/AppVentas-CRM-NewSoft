/**
 * Validaciones Zod para Órdenes de Venta.
 */

import { z } from "zod";

// ── Partida ──────────────────────────────────────────────────

export const PartidaInputSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es requerida")
    .max(500, "Máximo 500 caracteres"),
  cantidad: z
    .number({ invalid_type_error: "Cantidad debe ser un número" })
    .positive("Debe ser mayor a 0")
    .max(999999, "Cantidad muy grande"),
  precio_unitario: z
    .number({ invalid_type_error: "Precio debe ser un número" })
    .nonnegative("No puede ser negativo")
    .max(99999999, "Precio muy grande"),
  orden_display: z
    .number({ invalid_type_error: "Orden inválido" })
    .int()
    .nonnegative(),
});

// ── Orden: base (sin superRefine, para poder derivar .partial()) ─

const OrdenBaseShape = {
  cliente_id: z.string().uuid("cliente_id inválido"),
  tipo_cotizacion_id: z.string().uuid("tipo_cotizacion_id inválido"),
  condicion_pago_id: z.string().uuid("condicion_pago_id inválido"),
  vendedor_id: z.string().uuid("Selecciona un vendedor"),
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es requerida")
    .max(300, "Máximo 300 caracteres"),
  estatus: z.enum(["BORRADOR", "COTIZADO", "VENTA"] as const).default("BORRADOR"),
  moneda: z.enum(["MXN", "USD"] as const),
  tipo_cambio: z
    .number({ invalid_type_error: "Tipo de cambio inválido" })
    .positive("Debe ser mayor a 0")
    .max(99999)
    .nullable()
    .optional(),
  fecha_venta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .nullable()
    .optional(),
  vigencia: z
    .string()
    .trim()
    .max(100, "Máximo 100 caracteres")
    .nullable()
    .optional(),
  aplica_iva: z.boolean(),
  tasa_iva: z
    .number({ invalid_type_error: "Tasa IVA inválida" })
    .nonnegative()
    .max(100)
    .nullable()
    .optional(),
  descuento_porcentaje: z
    .number({ invalid_type_error: "Descuento inválido" })
    .nonnegative("No puede ser negativo")
    .max(100, "El descuento no puede exceder 100%")
    .nullable()
    .optional(),
  descuento_descripcion: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .nullable()
    .optional(),
  notas: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .nullable()
    .optional(),
  partidas: z
    .array(PartidaInputSchema)
    .min(1, "Se requiere al menos una partida"),
};

// ── Orden: crear ─────────────────────────────────────────────

export const OrdenCreateSchema = z.object(OrdenBaseShape).superRefine((data, ctx) => {
  // tipo_cambio requerido si moneda=USD
  if (data.moneda === "USD" && !data.tipo_cambio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El tipo de cambio es requerido para órdenes en USD",
      path: ["tipo_cambio"],
    });
  }
  // tasa_iva requerida si aplica_iva=true
  if (data.aplica_iva && (data.tasa_iva == null || data.tasa_iva <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La tasa de IVA es requerida cuando aplica IVA",
      path: ["tasa_iva"],
    });
  }
  // fecha_venta requerida si se crea directamente como VENTA
  if (data.estatus === "VENTA" && !data.fecha_venta) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La fecha de venta es requerida cuando el estatus inicial es Venta",
      path: ["fecha_venta"],
    });
  }
});

// ── Orden: actualizar (todos los campos opcionales) ──────────

export const OrdenUpdateSchema = z.object(OrdenBaseShape).partial().extend({
  // Al actualizar partidas, se reemplazan todas (array completo)
  partidas: z
    .array(PartidaInputSchema)
    .min(1, "Se requiere al menos una partida")
    .optional(),
});

// ── Estatus: cambio de estado ─────────────────────────────────

export const EstatusUpdateSchema = z.object({
  estatus: z.enum(["BORRADOR", "COTIZADO", "VENTA"]),
  fecha_venta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido")
    .nullable()
    .optional(),
});

// ── Filtros ───────────────────────────────────────────────────

export const FiltroOrdenesSchema = z.object({
  ano: z.coerce.number().int().min(2020).max(2099).nullable().optional(),
  q: z.coerce.number().int().min(1).max(4).nullable().optional(),
  mes: z.coerce.number().int().min(1).max(12).nullable().optional(),
  estatus: z.enum(["BORRADOR", "COTIZADO", "VENTA"]).nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  tipo_cotizacion_id: z.string().uuid().nullable().optional(),
  vendedor_id: z.string().uuid().nullable().optional(),
});

export type OrdenCreateInput = z.infer<typeof OrdenCreateSchema>;
export type OrdenUpdateInput = z.infer<typeof OrdenUpdateSchema>;
export type EstatusUpdateInput = z.infer<typeof EstatusUpdateSchema>;
export type FiltroOrdenesInput = z.infer<typeof FiltroOrdenesSchema>;
