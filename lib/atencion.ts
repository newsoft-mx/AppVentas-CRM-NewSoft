// Estado de atención derivado de un deal (REQ-01 — "stand-by").
//
// NO se almacena: se calcula a partir de los seguimientos pendientes y de la última
// actividad. Resuelve el reclamo de Roldán: un deal con seguimiento agendado a futuro
// deja de aparecer en rojo y pasa a "en seguimiento" (stand-by), mostrando la fecha.

export type EstadoAtencion = "EN_SEGUIMIENTO" | "VENCIDO" | "SIN_PROXIMA";

export const UMBRAL_INACTIVIDAD_DIAS = 7;

export interface ActividadAtencion {
  es_tarea: boolean;
  /** TERMINADO ⟺ completada; una tarea terminada ya no cuenta como pendiente */
  completada: boolean;
  /** ISO datetime o Date; null si la actividad no es un seguimiento agendado */
  fecha_tarea: string | Date | null;
  /** Cuándo ocurrió / se registró la actividad — para medir inactividad */
  fecha_evento?: string | Date | null;
  created_at: string | Date;
}

export interface ResultadoAtencion {
  estado: EstadoAtencion;
  /** Próximo seguimiento pendiente (futuro o vencido), ISO o null */
  proximo_seguimiento: string | null;
  /** true si el próximo seguimiento ya pasó sin completarse */
  vencido: boolean;
  /** Días desde la última actividad (para SIN_PROXIMA) */
  dias_inactivo: number;
}

function ms(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Deriva el estado de atención de un deal.
 *
 * - EN_SEGUIMIENTO: tiene ≥1 seguimiento pendiente con fecha futura → stand-by, no alerta.
 * - VENCIDO: su próximo seguimiento pendiente ya pasó → requiere atención (rojo).
 * - SIN_PROXIMA: no tiene seguimiento futuro y la última actividad supera el umbral → alerta de inactividad.
 *   (Si no hay seguimiento futuro pero la última actividad es reciente, también es SIN_PROXIMA
 *    pero sin alerta fuerte; el consumidor decide el color según `dias_inactivo`.)
 */
export function estadoAtencion(
  actividades: ActividadAtencion[],
  ahora: Date = new Date(),
  umbralDias: number = UMBRAL_INACTIVIDAD_DIAS
): ResultadoAtencion {
  const ahoraMs = ahora.getTime();

  // Seguimientos pendientes (tareas no terminadas con fecha)
  const pendientes = actividades
    .filter((a) => a.es_tarea && !a.completada && a.fecha_tarea != null)
    .map((a) => ms(a.fecha_tarea as string | Date))
    .sort((x, y) => x - y);

  const proximoMs = pendientes[0] ?? null;

  if (proximoMs != null) {
    const vencido = proximoMs < ahoraMs;
    return {
      estado: vencido ? "VENCIDO" : "EN_SEGUIMIENTO",
      proximo_seguimiento: new Date(proximoMs).toISOString(),
      vencido,
      dias_inactivo: 0,
    };
  }

  // Sin seguimiento futuro: medir inactividad desde la última actividad registrada
  const fechas = actividades.map((a) => ms(a.fecha_evento ?? a.created_at));
  const ultimaMs = fechas.length ? Math.max(...fechas) : null;
  const diasInactivo =
    ultimaMs != null ? Math.floor((ahoraMs - ultimaMs) / 86_400_000) : Infinity;

  return {
    estado: "SIN_PROXIMA",
    proximo_seguimiento: null,
    vencido: false,
    dias_inactivo: diasInactivo === Infinity ? umbralDias + 1 : diasInactivo,
  };
}

/** ¿El estado de atención debe alertar (mostrar color de alerta)? */
export function requiereAtencion(
  r: ResultadoAtencion,
  umbralDias: number = UMBRAL_INACTIVIDAD_DIAS
): boolean {
  if (r.estado === "VENCIDO") return true;
  if (r.estado === "SIN_PROXIMA") return r.dias_inactivo > umbralDias;
  return false;
}
