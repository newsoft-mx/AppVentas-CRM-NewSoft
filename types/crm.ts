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
  resultado: string;
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

// ── Detalle del deal ──

export type TipoActividad = "NOTA" | "LLAMADA" | "EMAIL" | "WHATSAPP" | "SISTEMA";
export type RolContacto = "DECISOR" | "INFLUENCIADOR" | "USUARIO" | "OTRO";

export interface DealContactoItem {
  id: string;
  nombre: string;
  rol: RolContacto;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
}

export interface DealActividadItem {
  id: string;
  tipo: TipoActividad;
  contenido: string;
  autor: string;
  es_tarea: boolean;
  completada: boolean;
  fecha_tarea: string | null;
  created_at: string;
}

export interface DealDetalle {
  id: string;
  nombre: string;
  moneda: string;
  valor: number;
  setup: number | null;
  mensualidad: number | null;
  meses: number | null;
  temperatura: Temperatura;
  probabilidad: number | null;
  canal: string | null;
  origen: string | null;
  resultado: string;
  fecha_cierre_estimada: string | null;
  dias_abierto: number;
  notas: string | null;
  stage: { id: string; nombre: string; orden: number };
  cliente: { id: string; nombre: string } | null;
  vendedor: { id: string; nombre: string } | null;
  tipo: { id: string; nombre: string } | null;
  contactos: DealContactoItem[];
  actividades: DealActividadItem[];
  historial: { ordenes_total: number; proyectos_ganados: number; total_facturado: number };
}

// ── Inbox de acciones ──
export interface AccionItem {
  id: string;
  tipo: TipoActividad;
  contenido: string;
  fecha_tarea: string | null;
  deal: {
    id: string;
    nombre: string;
    valor: number;
    temperatura: Temperatura;
    vendedor: { id: string; nombre: string } | null;
  };
}

export const ROL_CONTACTO_LABEL: Record<RolContacto, string> = {
  DECISOR: "Decisor",
  INFLUENCIADOR: "Influenciador",
  USUARIO: "Usuario",
  OTRO: "Contacto",
};

