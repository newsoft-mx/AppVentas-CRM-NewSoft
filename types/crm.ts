// Tipos compartidos del módulo Pipeline CRM

export type Temperatura =
  | "MUY_FRIO"
  | "FRIO"
  | "TIBIO"
  | "CALIENTE"
  | "MUY_CALIENTE";

export interface StageResumen {
  id: string;
  nombre: string;
  orden: number;
  color: string;
}

export interface DealResumen {
  id: string;
  nombre: string;
  valor: number;
  moneda: string;
  temperatura: Temperatura;
  probabilidad: number | null;
  stage_id: string;
  /** Días que lleva el deal en su etapa actual */
  dias_en_etapa: number;
  cliente: { id: string; nombre: string } | null;
  vendedor: { id: string; nombre: string } | null;
  tipo: { id: string; nombre: string } | null;
}

// Metadata de presentación de la temperatura (color + etiqueta)
export const TEMPERATURA_META: Record<
  Temperatura,
  { label: string; color: string }
> = {
  MUY_CALIENTE: { label: "Muy caliente", color: "#E8330A" },
  CALIENTE: { label: "Caliente", color: "#F47920" },
  TIBIO: { label: "Tibio", color: "#F5A623" },
  FRIO: { label: "Frío", color: "#4A90D9" },
  MUY_FRIO: { label: "Muy frío", color: "#2A5298" },
};

export const TEMPERATURAS_CALIENTES: Temperatura[] = ["CALIENTE", "MUY_CALIENTE"];
