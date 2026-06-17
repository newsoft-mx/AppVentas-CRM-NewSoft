/**
 * Schemas de validación Zod para el módulo de Configuración.
 * Se usan en los Route Handlers (backend).
 */

import { z } from "zod";

// ── Empresa ─────────────────────────────────────────────────
// siguiente_folio NO se incluye: es gestionado por el sistema de folios
export const empresaUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  nombre_comercial: z
    .string()
    .trim()
    .min(1, "Nombre comercial requerido")
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  rfc: z.string().min(1, "RFC requerido").max(13),
  direccion: z.string().min(1, "Dirección requerida").max(500),
  email: z.string().email("Email inválido").max(100),
  telefono: z.string().min(1, "Teléfono requerido").max(20),
  prefijo_folio: z
    .string()
    .min(1, "Prefijo requerido")
    .max(10)
    .regex(/^[A-Z0-9]+$/i, "Solo letras y números"),
  vigencia_cotizacion_dias: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 día")
    .max(365),
  aplicar_iva: z.boolean(),
  tasa_iva: z.coerce.number().min(0).max(100),
  notas_documentos: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

// ── Tipo de Cotización ───────────────────────────────────────
export const tipoCotizacionCreateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  descripcion: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  texto_contrato: z
    .string()
    .max(50000)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

// En update también se puede cambiar el estado activo
export const tipoCotizacionUpdateSchema = tipoCotizacionCreateSchema.extend({
  activo: z.boolean(),
});

// ── Condición Comercial ──────────────────────────────────────
export const condicionComercialCreateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(150),
  // null = contado; ≥ 0 = días de crédito
  dias_credito: z.coerce
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === null || isNaN(v as number) ? null : v)),
  descripcion: z
    .string()
    .max(50000)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

export const condicionComercialUpdateSchema =
  condicionComercialCreateSchema.extend({
    activo: z.boolean(),
  });

// ── Vendedor ────────────────────────────────────────────────
export const vendedorCreateSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(150),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(100)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => v?.trim() || null),
  telefono: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

export const vendedorUpdateSchema = vendedorCreateSchema.extend({
  activo: z.boolean(),
});

// ── Usuario ─────────────────────────────────────────────────
export const usuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(150),
  email: z.string().trim().email("Email inválido").max(100).transform((v) => v.toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
});

export const usuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(150),
  email: z.string().trim().email("Email inválido").max(100).transform((v) => v.toLowerCase()),
  password: z
    .string()
    .max(100)
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => !v || v.length >= 8, "La contraseña debe tener al menos 8 caracteres"),
  activo: z.boolean(),
});

// Tipos inferidos para usar en el frontend si se necesitan
export type EmpresaUpdateInput = z.infer<typeof empresaUpdateSchema>;
export type TipoCotizacionCreateInput = z.infer<typeof tipoCotizacionCreateSchema>;
export type TipoCotizacionUpdateInput = z.infer<typeof tipoCotizacionUpdateSchema>;
export type CondicionComercialCreateInput = z.infer<typeof condicionComercialCreateSchema>;
export type CondicionComercialUpdateInput = z.infer<typeof condicionComercialUpdateSchema>;
export type VendedorCreateInput = z.infer<typeof vendedorCreateSchema>;
export type VendedorUpdateInput = z.infer<typeof vendedorUpdateSchema>;
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
