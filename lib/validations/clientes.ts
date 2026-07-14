import { z } from "zod";
import { TAMANOS_EMPRESA, type TamanoEmpresa } from "@/types/crm";

export const clienteCreateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  rfc: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || null)
    .refine(
      (v) => !v || /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(v),
      "Formato de RFC inválido"
    ),
  contacto: z.string().min(1, "Contacto requerido").max(150),
  ciudad: z.string().min(1, "Ciudad requerida").max(100),
  email: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => v?.toLowerCase() || null)
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Email inválido"
    ),
  telefono: z
    .string()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  // Website opcional: se acepta con o sin protocolo; se normaliza a https:// si falta.
  // Validación laxa (dominio con punto) — no bloquea la captura del lead.
  website: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .transform((v) => {
      const s = v?.trim();
      if (!s) return null;
      return /^https?:\/\//i.test(s) ? s : `https://${s}`;
    })
    .refine(
      (v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v),
      "Website inválido"
    ),
  tamano_empresa: z
    .enum(TAMANOS_EMPRESA as [TamanoEmpresa, ...TamanoEmpresa[]])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  condicion_pago_id: z.string().uuid("Condición de pago requerida"),
  notas: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

// Update es igual a create (todos los campos editables)
export const clienteUpdateSchema = clienteCreateSchema;

export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;
