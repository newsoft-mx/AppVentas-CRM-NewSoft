import { z } from "zod";

// Caso del simulador de negocio. `datos` es el estado opaco de la calculadora (JSON):
// no lo modela el CRM, es propiedad del simulador. `deal_id` opcional = vínculo a un lead.
export const simuladorCasoSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre al caso").max(150),
  datos: z.record(z.string(), z.unknown()),
  deal_id: z.string().uuid("Deal inválido").nullable().optional(),
});

export type SimuladorCasoInput = z.infer<typeof simuladorCasoSchema>;
