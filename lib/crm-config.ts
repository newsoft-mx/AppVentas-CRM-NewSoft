import { prisma } from "@/lib/prisma";
import type { ParametrosTermometro } from "@/lib/termometro";
import type { TipoActividad } from "@/types/crm";

export interface CrmConfigData {
  umbral_inactividad_dias: number;
  avance_modo: "SUGERIR" | "AUTOMATICO";
  puntos_actividad: Partial<Record<TipoActividad, number>>;
  enfriamiento_nivel: number;
}

const DEFAULTS: CrmConfigData = {
  umbral_inactividad_dias: 7,
  avance_modo: "SUGERIR",
  puntos_actividad: { LLAMADA: 1, EMAIL: 1, WHATSAPP: 1, NOTA: 0 },
  enfriamiento_nivel: 1,
};

// Lee el singleton de configuración; si no existe (entorno sin seed), usa defaults.
export async function getCrmConfig(): Promise<CrmConfigData> {
  const row = await prisma.crmConfig.findUnique({ where: { id: "crm" } });
  if (!row) return DEFAULTS;
  return {
    umbral_inactividad_dias: row.umbral_inactividad_dias,
    avance_modo: row.avance_modo,
    puntos_actividad:
      (row.puntos_actividad as Partial<Record<TipoActividad, number>>) ?? DEFAULTS.puntos_actividad,
    enfriamiento_nivel: row.enfriamiento_nivel,
  };
}

export function toParametrosTermometro(c: CrmConfigData): ParametrosTermometro {
  return { puntos_actividad: c.puntos_actividad, enfriamiento_nivel: c.enfriamiento_nivel };
}
