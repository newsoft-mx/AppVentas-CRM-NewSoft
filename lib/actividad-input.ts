// Resolución + validación + serialización de una actividad de la bitácora.
//
// SSOT del "input de actividad": una entrada nace en el alta (POST) y se puede editar
// en todos sus campos (PATCH). Ambos comparten estas reglas para no divergir (DRY):
// tipo válido, contenido obligatorio, enlace http/https, contacto que pertenece al deal,
// tipo/resultado del catálogo, y la derivación de fecha_evento/fecha_tarea/estado_plan.
import { prisma } from "@/lib/prisma";
import { inputAUtc } from "@/lib/tz";
import { MAX_CONTENIDO, MSG_CONTENIDO_LARGO } from "@/lib/actividad";
import type { DealActividadItem, TipoActividad, EfectoTermometro } from "@/types/crm";

const TIPOS = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP"] as const;
type TipoCreable = (typeof TIPOS)[number];

/** Campos escribibles de una actividad, ya validados y normalizados. */
export interface ActividadResuelta {
  tipo: TipoCreable;
  contenido: string;
  contacto_id: string | null;
  enlace_url: string | null;
  fecha_evento: Date | null;
  es_tarea: boolean;
  fecha_tarea: Date | null;
  tipo_accion_id: string | null;
  resultado_id: string | null;
}

// Hora por defecto cuando se agenda sin especificarla (SOL-21: la hora es opcional y no
// debe impedir que el pendiente se agende).
const HORA_DEFAULT = "09:00";

export type ResolveActividad =
  | { ok: false; error: string; campo?: string; status: number }
  | { ok: true; data: ActividadResuelta; sugiereReagendar: boolean };

/**
 * Valida y resuelve el body de una actividad contra el deal. Devuelve los campos listos
 * para `create`/`update`, o un error con su status. Compartido por POST (alta) y PATCH (edición).
 */
export async function resolveActividadInput(body: unknown, dealId: string): Promise<ResolveActividad> {
  const {
    tipo, contenido, contacto_id, fecha, hora, enlace_url, tipo_accion_id, resultado_id,
  } = (body ?? {}) as {
    tipo?: string; contenido?: string; contacto_id?: string; fecha?: string; hora?: string;
    enlace_url?: string; tipo_accion_id?: string; resultado_id?: string;
  };

  if (!tipo || !TIPOS.includes(tipo as TipoCreable)) {
    return { ok: false, error: "Tipo inválido", campo: "tipo", status: 422 };
  }
  // SOL-21: lo ÚNICO que bloquea el guardado es tipo + fecha (el cliente/deal es el contexto).
  // La nota, la hora, el contacto y el desenlace son opcionales y nunca bloquean.
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "La fecha es obligatoria", campo: "fecha", status: 422 };
  }
  if (contenido && contenido.length > MAX_CONTENIDO) {
    return { ok: false, error: MSG_CONTENIDO_LARGO, campo: "contenido", status: 422 };
  }

  // Enlace externo: solo http/https. Bloquea javascript:/data: (XSS almacenado vía href).
  const enlaceLimpio = typeof enlace_url === "string" ? enlace_url.trim() : "";
  if (enlaceLimpio && !/^https?:\/\//i.test(enlaceLimpio)) {
    return { ok: false, error: "El enlace debe empezar con http:// o https://", campo: "enlace_url", status: 422 };
  }
  if (enlaceLimpio.length > 500) {
    return { ok: false, error: "El enlace es demasiado largo (máx. 500)", campo: "enlace_url", status: 422 };
  }

  const tipoActividad = tipo as TipoCreable;

  // El contacto (si viene) debe pertenecer al deal
  let contactoId: string | null = null;
  if (contacto_id) {
    const c = await prisma.dealContacto.findFirst({ where: { id: contacto_id, deal_id: dealId }, select: { id: true } });
    contactoId = c?.id ?? null;
  }
  // Tipo del catálogo (SOL-04): valida contra el catálogo activo y trae su bandera `agendable`,
  // que sigue rigiendo si una fecha futura se convierte en pendiente o no (SOL-21).
  let tipoAccionId: string | null = null;
  let agendable = true; // sin tipo del catálogo → se asume agendable
  if (tipo_accion_id) {
    const ta = await prisma.tipoAccion.findFirst({
      where: { id: tipo_accion_id, activo: true },
      select: { id: true, agendable: true },
    });
    if (ta) {
      tipoAccionId = ta.id;
      agendable = ta.agendable;
    }
  }
  // Regla de agendado (SOL-21).
  // El "cuándo" es fecha (obligatoria) + hora (opcional → HORA_DEFAULT). Los valores son
  // hora de pared CDMX → inputAUtc los ancla al instante correcto.
  //   futura + tipo agendable → PENDIENTE (es_tarea, aparece en Próximas Acciones),
  //                             con o sin hora. Sin desenlace: aún no ocurrió.
  //   hoy/pasada             → registro de algo que ya ocurrió (fecha_evento), y ahí sí
  //                             admite desenlace (opcional).
  const horaUsada = /^\d{2}:\d{2}$/.test(hora ?? "") ? (hora as string) : HORA_DEFAULT;
  const cuando = inputAUtc(`${fecha}T${horaUsada}`) ?? new Date(`${fecha}T${horaUsada}`);
  if (Number.isNaN(cuando.getTime())) {
    return { ok: false, error: "Fecha inválida", campo: "fecha", status: 422 };
  }
  const esFutura = cuando.getTime() > Date.now();
  const esTarea = esFutura && agendable;

  // Desenlace (SOL-23): solo tiene sentido en lo que YA ocurrió. Al agendar se ignora.
  let resultadoId: string | null = null;
  let sugiereReagendar = false;
  if (resultado_id && !esTarea) {
    const r = await prisma.resultadoAccion.findFirst({
      where: { id: resultado_id, activo: true },
      select: { id: true, sugiere_reagendar: true },
    });
    if (r) { resultadoId = r.id; sugiereReagendar = r.sugiere_reagendar; }
  }

  return {
    ok: true,
    sugiereReagendar,
    data: {
      tipo: tipoActividad,
      contenido: (contenido ?? "").trim(),
      contacto_id: contactoId,
      enlace_url: enlaceLimpio || null,
      fecha_evento: esTarea ? null : cuando,
      es_tarea: esTarea,
      fecha_tarea: esTarea ? cuando : null,
      tipo_accion_id: tipoAccionId,
      resultado_id: resultadoId,
    },
  };
}

/** Forma cruda de una actividad con sus relaciones incluidas (para serializar). */
export interface ActividadConRelaciones {
  id: string;
  tipo: TipoActividad;
  contenido: string;
  autor: string;
  contacto_id: string | null;
  es_tarea: boolean;
  completada: boolean;
  destacada: boolean;
  editada: boolean;
  enlace_url: string | null;
  fecha_evento: Date | null;
  fecha_tarea: Date | null;
  created_at: Date;
  contacto: { contacto: { nombre: string } } | null;
  tipo_accion: { id: string; nombre: string; color: string } | null;
  resultado: { id: string; nombre: string; efecto: EfectoTermometro } | null;
}

/** Serializa una actividad Prisma (con relaciones) al item que consume el front. */
export function serializeActividad(a: ActividadConRelaciones): DealActividadItem {
  return {
    id: a.id,
    tipo: a.tipo,
    contenido: a.contenido,
    autor: a.autor,
    contacto_nombre: a.contacto?.contacto?.nombre ?? null,
    contacto_id: a.contacto_id,
    fecha_evento: a.fecha_evento ? a.fecha_evento.toISOString() : null,
    es_tarea: a.es_tarea,
    completada: a.completada,
    destacada: a.destacada,
    editada: a.editada,
    enlace_url: a.enlace_url,
    fecha_tarea: a.fecha_tarea ? a.fecha_tarea.toISOString() : null,
    created_at: a.created_at.toISOString(),
    tipo_accion: a.tipo_accion
      ? { id: a.tipo_accion.id, nombre: a.tipo_accion.nombre, color: a.tipo_accion.color }
      : null,
    resultado: a.resultado
      ? { id: a.resultado.id, nombre: a.resultado.nombre, efecto: a.resultado.efecto }
      : null,
  };
}

/** Relaciones a incluir al crear/editar una actividad para poder serializarla. */
export const ACTIVIDAD_INCLUDE = {
  contacto: { select: { contacto: { select: { nombre: true } } } },
  tipo_accion: { select: { id: true, nombre: true, color: true } },
  resultado: { select: { id: true, nombre: true, efecto: true } },
} as const;
