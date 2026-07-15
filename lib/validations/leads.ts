import { z } from "zod";

// Payload del formulario web público. Es un contrato SIMPLE (contacto + empresa + mensaje):
// el sitio manda lo que tiene y el endpoint lo traduce al modelo del CRM. Todo opcional
// salvo el nombre del contacto. El honeypot (_hp) se chequea aparte, antes de validar.
export const leadWebSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  email: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v?.toLowerCase() || null)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  telefono: z.string().trim().max(20).optional().transform((v) => v || null),
  empresa: z.string().trim().max(200).optional().transform((v) => v || null),
  website: z.string().trim().max(255).optional().transform((v) => v || null),
  mensaje: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export type LeadWebInput = z.infer<typeof leadWebSchema>;
