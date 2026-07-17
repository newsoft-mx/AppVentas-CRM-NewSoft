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
  resultado: DealResultado;
  stage_id: string;
  /** Días que lleva el deal en su etapa actual */
  dias_en_etapa: number;
  /** Nº de actividades registradas (para ordenar por engagement) */
  actividades_count: number;
  /** Próximo seguimiento agendado pendiente (ISO con hora), o null */
  proximo_seguimiento: string | null;
  /** Estado de atención derivado (stand-by): EN_SEGUIMIENTO | VENCIDO | SIN_PROXIMA */
  atencion: EstadoAtencion;
  cliente: { id: string; nombre: string } | null;
  vendedor: { id: string; nombre: string } | null;
  tipo: { id: string; nombre: string } | null;
  /** Nombres de los contactos del deal (para el buscador, SOL-17) */
  contactos: string[];
  /** Motivo de pérdida (solo si resultado = PERDIDO), para el desglose (SOL-06/18) */
  razon_perdida: string | null;
  /** Fecha de ingreso al pipeline (ISO) — dato de negocio, editable en la vista lista */
  fecha_ingreso: string;
}

// Estado del deal (resultado): label + color central (pilar 5). Un solo lugar
// para el badge/columna/chip de estado en el pipeline.
export const ESTADO_DEAL_META: Record<DealResultado, { label: string; color: string }> = {
  ABIERTO: { label: "Activo", color: "#6B7A99" },
  SUSPENDIDO: { label: "Pausado", color: "#2A5298" },
  GANADO: { label: "Ganado", color: "#1D9E75" },
  PERDIDO: { label: "Perdido", color: "#E8330A" },
};

export type EstadoAtencion = "EN_SEGUIMIENTO" | "VENCIDO" | "SIN_PROXIMA";

// Metadata de presentación del estado de atención (REQ-01 stand-by)
export const ATENCION_META: Record<
  EstadoAtencion,
  { label: string; chip: string; dot: string }
> = {
  EN_SEGUIMIENTO: { label: "En seguimiento", chip: "bg-emerald-50 text-emerald-700", dot: "#1D9E75" },
  VENCIDO: { label: "Vencido", chip: "bg-red-50 text-red-700", dot: "#E8330A" },
  SIN_PROXIMA: { label: "Sin próxima acción", chip: "bg-amber-50 text-amber-700", dot: "#F5A623" },
};

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

// Rango numérico de temperatura (para ordenar: calientes arriba)
export const TEMPERATURA_RANK: Record<Temperatura, number> = {
  MUY_CALIENTE: 5,
  CALIENTE: 4,
  TIBIO: 3,
  FRIO: 2,
  MUY_FRIO: 1,
};

// SSOT del conjunto de valores de temperatura (frío → caliente). Única fuente para
// validar/ofrecer temperaturas; no re-hardcodear la lista en handlers ni formularios.
export const TEMPERATURAS: Temperatura[] = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

// ── Detalle del deal ──

export type TipoActividad = "NOTA" | "LLAMADA" | "EMAIL" | "WHATSAPP" | "SISTEMA";
export type RolContacto = "DECISOR" | "INFLUENCIADOR" | "USUARIO" | "OTRO";
// Estado de una tarea: solo dos (SOL-21/23). DERIVADO de es_tarea+completada — ver
// lib/tareas → estadoTarea(). Reemplaza a EstadoAccion (EN_PROCESO no aplicaba) y a
// EstadoPlaneacion (PLANEADA/REALIZADA): eran el mismo concepto por triplicado.
export type EstadoTarea = "PENDIENTE" | "LISTO";
export type DealResultado = "ABIERTO" | "GANADO" | "PERDIDO" | "SUSPENDIDO";
export type EstatusCliente = "PROSPECTO" | "ACTIVO" | "INACTIVO";
export type TamanoEmpresa = "MICRO" | "PEQUENA" | "MEDIANA" | "GRANDE";

// SSOT de tamaños de empresa (por empleados) — orden + etiquetas en un solo lugar.
export const TAMANOS_EMPRESA: TamanoEmpresa[] = ["MICRO", "PEQUENA", "MEDIANA", "GRANDE"];
export const TAMANO_EMPRESA_LABEL: Record<TamanoEmpresa, string> = {
  MICRO: "1–10 empleados",
  PEQUENA: "11–50 empleados",
  MEDIANA: "51–250 empleados",
  GRANDE: "250+ empleados",
};

// SSOT del conjunto de resultados válidos del deal. Los handlers validan contra
// esta lista (no re-hardcodean el enum).
export const RESULTADOS_DEAL: DealResultado[] = ["ABIERTO", "GANADO", "PERDIDO", "SUSPENDIDO"];

// Metadata del estado de una tarea (SOL-21/23). Solo dos: se está por hacer, o ya está.
// El estado se DERIVA de es_tarea+completada (lib/tareas → estadoTarea), no se almacena.
export const ESTADO_TAREA_META: Record<EstadoTarea, { label: string; dot: string; chip: string }> = {
  PENDIENTE: { label: "Pendiente", dot: "#9BA5BE", chip: "bg-gray-100 text-gray-600" },
  LISTO: { label: "Listo", dot: "#1D9E75", chip: "bg-emerald-50 text-emerald-700" },
};

export interface DealContactoItem {
  /** id del link deal↔contacto (DealContacto) */
  id: string;
  /** id del contacto compartido (Contacto, dueño del cliente) */
  contacto_id: string;
  nombre: string;
  rol: RolContacto;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  cargo: string | null;
  es_principal: boolean;
}

export interface ContactoCliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  cargo: string | null;
  es_principal: boolean;
}

// Modelo de actividad (SOL-04)
export type EfectoTermometro = "POSITIVO" | "NEUTRO" | "NEGATIVO";

export const EFECTO_META: Record<EfectoTermometro, { label: string; chip: string; arrow: string }> = {
  POSITIVO: { label: "Positivo", chip: "bg-emerald-50 text-emerald-700", arrow: "▲" },
  NEUTRO: { label: "Neutro", chip: "bg-gray-100 text-gray-600", arrow: "" },
  NEGATIVO: { label: "Negativo", chip: "bg-red-50 text-red-700", arrow: "▼" },
};

export interface DealActividadItem {
  id: string;
  tipo: TipoActividad;
  contenido: string;
  autor: string;
  contacto_nombre: string | null;
  /** id del DealContacto vinculado (para precargar el compositor al editar) */
  contacto_id: string | null;
  fecha_evento: string | null;
  /** ¿Es una tarea agendada? Con `completada` deriva el estado (lib/tareas → estadoTarea). */
  es_tarea: boolean;
  completada: boolean;
  destacada: boolean;
  editada: boolean;
  enlace_url: string | null;
  fecha_tarea: string | null;
  /**
   * ¿La hora la eligió el usuario? La fecha siempre está; la hora es opcional (SOL-22).
   * Si es false, mostrar SOLO la fecha: el instante guardado es el fin del día, no una
   * hora elegida. Usar formatCuando, que ya aplica la regla.
   */
  hora_definida: boolean;
  created_at: string;
  // Modelo de actividad (SOL-04): tipo del catálogo + resultado (desenlace, solo al completar)
  tipo_accion: { id: string; nombre: string; color: string } | null;
  resultado: { id: string; nombre: string; efecto: EfectoTermometro } | null;
}

export interface DealDetalle {
  id: string;
  nombre: string;
  moneda: string;
  valor: number;
  setup: number | null;
  mensualidad: number | null;
  meses: number | null;
  score: number; // 0-100, derivado (dealScoreView)
  temperatura: Temperatura;
  probabilidad: number | null;
  canal: { id: string; nombre: string } | null;
  origen: { id: string; nombre: string } | null;
  resultado: DealResultado;
  fecha_cierre_estimada: string | null;
  dias_abierto: number;
  fecha_ingreso: string; // ISO — fecha de ingreso al pipeline (editable)
  notas: string | null;
  stage: { id: string; nombre: string; orden: number };
  cliente: {
    id: string;
    nombre: string;
    estatus: EstatusCliente;
    website: string | null;
    tamano_empresa: TamanoEmpresa | null;
  } | null;
  vendedor: { id: string; nombre: string } | null;
  tipo: { id: string; nombre: string } | null;
  contactos: DealContactoItem[];
  actividades: DealActividadItem[];
  historial: { ordenes_total: number; proyectos_ganados: number; total_facturado: number };
}

// ── Próximas Acciones (agregador de seguimientos de la bitácora) ──
/**
 * Una actividad vista desde la agenda global: la MISMA actividad de la bitácora, más el
 * deal del que cuelga (ahí se cruzan deals; en la bitácora ya estás dentro de uno).
 *
 * Era una forma aparte y recortada, y por eso la agenda no podía mostrar autor, desenlace
 * ni enlace, ni ofrecer editar/destacar: no tenía los datos. Es la misma entidad → una
 * sola forma, serializada por el mismo lib/actividad-input.
 */
export interface AccionItem extends DealActividadItem {
  deal: {
    id: string;
    nombre: string;
    valor: number;
    temperatura: Temperatura;
    vendedor: { id: string; nombre: string } | null;
  };
}

// Grupos de urgencia temporal para Próximas Acciones (REQ-01)
export type GrupoUrgencia = "VENCIDAS" | "HOY" | "SEMANA" | "DESPUES";
export const GRUPO_URGENCIA_META: Record<GrupoUrgencia, { label: string }> = {
  VENCIDAS: { label: "Vencidas" },
  HOY: { label: "Hoy" },
  SEMANA: { label: "Esta semana" },
  DESPUES: { label: "Más adelante" },
};

export const ROL_CONTACTO_LABEL: Record<RolContacto, string> = {
  DECISOR: "Decisor",
  INFLUENCIADOR: "Influenciador",
  USUARIO: "Usuario",
  OTRO: "Contacto",
};

