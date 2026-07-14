/**
 * SSOT de "seguimiento pendiente" y su vencimiento (pilar 3).
 *
 * Una misma definición para: las queries de Prisma (Próximas Acciones, próximo
 * seguimiento del pipeline), el estado de atención (`lib/atencion`), el banner del
 * detalle, el inbox y el calendario. Antes esto estaba hardcodeado en ~6 lugares que
 * debían coincidir; ahora viven acá y no pueden desincronizarse.
 */
import type { Prisma } from "@prisma/client";
import type { GrupoUrgencia } from "@/types/crm";

// Fragmento `where` de Prisma: una actividad es tarea pendiente si está agendada
// (es_tarea + fecha_tarea), no está terminada y no está eliminada.
export const WHERE_TAREA_PENDIENTE = {
  es_tarea: true,
  completada: false,
  fecha_tarea: { not: null },
  eliminada: false,
} satisfies Prisma.DealActividadWhereInput;

// Mismo criterio, para arrays ya cargados en memoria (las vistas cliente ya vienen
// filtradas por `eliminada: false`).
export function esTareaPendiente(a: {
  es_tarea: boolean;
  completada: boolean;
  fecha_tarea: string | Date | null;
}): boolean {
  return a.es_tarea && !a.completada && a.fecha_tarea != null;
}

// Vencida = su fecha ya pasó, al instante. `ahoraMs` se pasa como parámetro para no
// llamar Date.now() durante el render (evita mismatch de hidratación).
export function estaVencida(fechaTarea: string | Date, ahoraMs: number): boolean {
  const t = fechaTarea instanceof Date ? fechaTarea.getTime() : new Date(fechaTarea).getTime();
  return t < ahoraMs;
}

// Agrupamiento por DÍA para Próximas Acciones y el calendario (día-granular; distinto
// del "vencido al instante" de arriba). VENCIDAS = día anterior a hoy.
export function grupoUrgencia(fechaTarea: string | Date | null, ahora: Date): GrupoUrgencia {
  if (!fechaTarea) return "DESPUES";
  const t = fechaTarea instanceof Date ? fechaTarea.getTime() : new Date(fechaTarea).getTime();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const finHoy = inicioHoy + 86_400_000;
  if (t < inicioHoy) return "VENCIDAS";
  if (t < finHoy) return "HOY";
  if (t < inicioHoy + 7 * 86_400_000) return "SEMANA";
  return "DESPUES";
}
