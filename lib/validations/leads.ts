import { z } from "zod";
import { TAMANOS_EMPRESA } from "@/types/crm";

// Payload de intake de un lead externo (form web propio, Meta, etc.).
//
// Filosofía del contrato: exponemos TODOS los campos con los que damos de alta un deal, pero
// el ÚNICO obligatorio es `nombre` (del contacto). Todo lo demás es opcional: quien integra
// (marketing) manda lo que su form/fuente tenga y decide de SU lado qué hace obligatorio.
// Un campo blando que llegue mal no tumba el lead — se ignora y se avisa en la respuesta.
//
// Campos que NO se aceptan por diseño (los pone el CRM, no la fuente): vendedor (config
// `vendedor_leads_web_id`), etapa (siempre la primera), cliente_id (los leads nacen prospecto)
// y el canal (lo fija la fuente/adaptador, no el payload).

const opcionalTexto = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

// number | numeric-string | "" → number | null (tolera lo que manda un form/HTTP).
const opcionalNumero = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().finite().nonnegative().optional()
).transform((v) => v ?? null);

export const leadWebSchema = z.object({
  // Contacto (lo único obligatorio)
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(150),
  email: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v?.toLowerCase() || null)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  telefono: opcionalTexto(20),
  whatsapp: opcionalTexto(20),
  cargo: opcionalTexto(100),

  // Empresa / prospecto
  empresa: opcionalTexto(200),
  website: opcionalTexto(255),
  tamano_empresa: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || TAMANOS_EMPRESA.includes(v as (typeof TAMANOS_EMPRESA)[number]), {
      message: `tamano_empresa debe ser uno de: ${TAMANOS_EMPRESA.join(", ")}`,
    })
    .transform((v) => v as (typeof TAMANOS_EMPRESA)[number] | null),

  // Comerciales del deal
  titulo: opcionalTexto(200), // nombre del deal; si falta → "Lead — {empresa}"
  tipo: opcionalTexto(100), // nombre del tipo de cotización (se resuelve contra el catálogo)
  moneda: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v === "USD" ? "USD" : v === "MXN" ? "MXN" : null)),
  valor: opcionalNumero,
  setup: opcionalNumero,
  mensualidad: opcionalNumero,
  meses: opcionalNumero,
  fecha_cierre_estimada: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "fecha_cierre_estimada debe ser una fecha ISO")
    .transform((v) => (v ? new Date(v) : null)),

  // Atribución
  campana: opcionalTexto(120), // origen específico (campaña); si falta usa el de la fuente
  mensaje: opcionalTexto(2000),
});

export type LeadWebInput = z.infer<typeof leadWebSchema>;
