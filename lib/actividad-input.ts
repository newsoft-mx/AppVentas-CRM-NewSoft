// Resolución + validación + serialización de una actividad de la bitácora.
//
// SSOT del "input de actividad": una entrada nace en el alta (POST) y se puede editar
// en todos sus campos (PATCH). Ambos comparten estas reglas para no divergir (DRY):
// tipo válido, contenido obligatorio, enlace http/https, contacto que pertenece al deal,
// tipo/resultado del catálogo, y la derivación de fecha_evento/fecha_tarea/estado_plan.
import { prisma } from "@/lib/prisma";
import { inputAUtc } from "@/lib/tz";
import { MAX_CONTENIDO, MSG_CONTENIDO_LARGO } from "@/lib/actividad";
import type {
  DealActividadItem, TipoActividad, EstadoAccion, EstadoPlaneacion, EfectoTermometro,
} from "@/types/crm";

const TIPOS = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP"] as const;
type TipoCreable = (typeof TIPOS)[number];

/** Campos escribibles de una actividad, ya validados y normalizados. */
export interface ActividadResuelta {
  tipo: TipoCreable;
  contenido: string;
  contacto_id: string | null;
  enlace_url: string | null;
  fecha_evento: Date | null;
  exitosa: boolean | null;
  es_tarea: boolean;
  fecha_tarea: Date | null;
  tipo_accion_id: string | null;
  resultado_id: string | null;
  estado_plan: EstadoPlaneacion | null;
}

export type ResolveActividad =
  | { ok: false; error: string; campo?: string; status: number }
  | { ok: true; data: ActividadResuelta; sugiereReagendar: boolean };

/**
 * Valida y resuelve el body de una actividad contra el deal. Devuelve los campos listos
 * para `create`/`update`, o un error con su status. Compartido por POST (alta) y PATCH (edición).
 */
export async function resolveActividadInput(body: unknown, dealId: string): Promise<ResolveActividad> {
  const {
    tipo, contenido, contacto_id, fecha_evento, exitosa, fecha_tarea, enlace_url, tipo_accion_id, resultado_id,
  } = (body ?? {}) as {
    tipo?: string; contenido?: string; contacto_id?: string; fecha_evento?: string;
    exitosa?: boolean; fecha_tarea?: string; enlace_url?: string; tipo_accion_id?: string; resultado_id?: string;
  };

  if (!tipo || !TIPOS.includes(tipo as TipoCreable)) {
    return { ok: false, error: "Tipo inválido", campo: "tipo", status: 422 };
  }
  if (!contenido || !contenido.trim()) {
    return { ok: false, error: "El contenido es obligatorio", campo: "contenido", status: 422 };
  }
  if (contenido.length > MAX_CONTENIDO) {
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
  const exitosaVal = tipoActividad === "LLAMADA" ? (typeof exitosa === "boolean" ? exitosa : null) : null;

  // Tipo/resultado del catálogo (SOL-04): valida contra el catálogo activo y captura su efecto.
  let tipoAccionId: string | null = null;
  if (tipo_accion_id) {
    const ta = await prisma.tipoAccion.findFirst({ where: { id: tipo_accion_id, activo: true }, select: { id: true } });
    tipoAccionId = ta?.id ?? null;
  }
  let resultadoId: string | null = null;
  let sugiereReagendar = false;
  if (resultado_id) {
    const r = await prisma.resultadoAccion.findFirst({
      where: { id: resultado_id, activo: true },
      select: { id: true, sugiere_reagendar: true },
    });
    if (r) { resultadoId = r.id; sugiereReagendar = r.sugiere_reagendar; }
  }
  // Si capturó resultado, la acción está REALIZADA; si agenda a futuro, PLANEADA.
  const estadoPlan: EstadoPlaneacion | null = resultadoId ? "REALIZADA" : fecha_tarea ? "PLANEADA" : null;

  return {
    ok: true,
    sugiereReagendar,
    data: {
      tipo: tipoActividad,
      contenido: contenido.trim(),
      contacto_id: contactoId,
      enlace_url: enlaceLimpio || null,
      // "¿Cuándo?" (fecha_evento): si viene se respeta para cualquier tipo (incluida NOTA);
      // si no, NOTA queda sin fecha (usa created_at en el timeline) y el resto asume "ahora".
      // Los valores del input son hora de pared CDMX → inputAUtc los ancla al instante correcto.
      fecha_evento: fecha_evento ? inputAUtc(fecha_evento) ?? new Date(fecha_evento) : tipoActividad === "NOTA" ? null : new Date(),
      exitosa: exitosaVal,
      es_tarea: Boolean(fecha_tarea),
      fecha_tarea: fecha_tarea ? inputAUtc(fecha_tarea) ?? new Date(fecha_tarea) : null,
      tipo_accion_id: tipoAccionId,
      resultado_id: resultadoId,
      estado_plan: estadoPlan,
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
  exitosa: boolean | null;
  es_tarea: boolean;
  completada: boolean;
  estado_accion: EstadoAccion;
  destacada: boolean;
  editada: boolean;
  enlace_url: string | null;
  fecha_evento: Date | null;
  fecha_tarea: Date | null;
  created_at: Date;
  estado_plan: EstadoPlaneacion | null;
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
    exitosa: a.exitosa,
    es_tarea: a.es_tarea,
    completada: a.completada,
    estado_accion: a.estado_accion,
    destacada: a.destacada,
    editada: a.editada,
    enlace_url: a.enlace_url,
    fecha_tarea: a.fecha_tarea ? a.fecha_tarea.toISOString() : null,
    created_at: a.created_at.toISOString(),
    estado_plan: a.estado_plan,
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
