import { z } from "zod";

// Caso de la Calculadora de Plataformas. `datos` es el estado opaco de la calculadora (JSON,
// los inputs): no lo modela el CRM, es propiedad de la herramienta. `deal_id` opcional = vínculo.
export const calculadoraCasoSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la cotización").max(150),
  datos: z.record(z.string(), z.unknown()),
  deal_id: z.string().uuid("Deal inválido").nullable().optional(),
});

export type CalculadoraCasoInput = z.infer<typeof calculadoraCasoSchema>;
