// SSOT de los tipos de actividad de la bitácora (pilar 3).
//
// Antes cada superficie tenía su propia tabla tipo→(ícono/color/label/placeholder):
// ACT_ICON, TIPO_PILLS, PLACEHOLDER, FILTROS_VER en el detalle, y TIPO_ICON duplicado
// en AccionesInbox y CalendarioAcciones. Todas debían coincidir. Ahora hay UNA tabla:
// el ícono, color, etiquetas y si el tipo es creable viven acá y no pueden divergir.
import { StickyNote, Phone, Mail, MessageCircle, Cog, type LucideIcon } from "lucide-react";
import type { TipoActividad } from "@/types/crm";

export interface TipoActividadMeta {
  /** Etiqueta singular (pill del compositor) */
  label: string;
  /** Etiqueta plural (tab de filtro "Ver") */
  labelPlural: string;
  icon: LucideIcon;
  /** Color de acento (borde/ícono) */
  color: string;
  /** Fondo suave del ícono */
  bg: string;
  /** Placeholder del editor al componer este tipo */
  placeholder: string;
  /** ¿El usuario puede crear este tipo? SISTEMA es auto-generado (auditoría). */
  creable: boolean;
}

export const TIPO_ACTIVIDAD_META: Record<TipoActividad, TipoActividadMeta> = {
  NOTA: {
    label: "Nota", labelPlural: "Notas", icon: StickyNote, color: "#F5A623", bg: "#FFF8EB",
    placeholder: "Escribe una nota interna…", creable: true,
  },
  LLAMADA: {
    label: "Llamada", labelPlural: "Llamadas", icon: Phone, color: "#1D9E75", bg: "#E8F8F2",
    placeholder: "¿Qué pasó en la llamada?", creable: true,
  },
  EMAIL: {
    label: "Email", labelPlural: "Emails", icon: Mail, color: "#2A5298", bg: "#EAF0FA",
    placeholder: "Pega o resume el correo…", creable: true,
  },
  WHATSAPP: {
    label: "WhatsApp", labelPlural: "WhatsApp", icon: MessageCircle, color: "#1D9E75", bg: "#E8F8F2",
    placeholder: "¿Qué se conversó por WhatsApp?", creable: true,
  },
  SISTEMA: {
    label: "Sistema", labelPlural: "Sistema", icon: Cog, color: "#6B7A99", bg: "#F3F5F9",
    placeholder: "", creable: false,
  },
};

// Orden canónico de tipos creables (pills del compositor y tabs de filtro por tipo).
export const TIPOS_CREABLES: TipoActividad[] = (
  Object.keys(TIPO_ACTIVIDAD_META) as TipoActividad[]
).filter((t) => TIPO_ACTIVIDAD_META[t].creable);

/**
 * Qué tipo de movimiento es, para mostrarlo y para agrupar (SSOT).
 *
 * Hay dos fuentes: el catálogo (TipoAccion, configurable) y el tipo base del enum, para lo
 * cargado sin catálogo. La regla de cuál gana estaba repetida en cada consumidor, y el
 * filtro "Ver" tenía su propia versión que además agrupaba por la FUENTE del dato en vez
 * de por el tipo: una nota con catálogo y otra sin él caían en chips distintos ("Nota" y
 * "Notas"), aunque para quien lee son lo mismo. Con una sola regla, agrupan juntas.
 */
export function tipoMovimiento(a: {
  tipo: TipoActividad;
  tipo_accion?: { nombre: string; color: string } | null;
}): { nombre: string; color: string } {
  if (a.tipo_accion) return { nombre: a.tipo_accion.nombre, color: a.tipo_accion.color };
  const meta = TIPO_ACTIVIDAD_META[a.tipo];
  return { nombre: meta.label, color: meta.color };
}

/**
 * Cómo se titula un movimiento en una lista (SSOT).
 *
 * Desde SOL-21 la nota es opcional, así que quien la usaba de título se quedaba sin nada
 * (tarjetas descabezadas en la agenda, tooltips cortados). Sin nota, el tipo ES el
 * movimiento: "Llamada", "Reunión". La regla vive acá una vez porque ya la necesitan la
 * bitácora, la agenda y el calendario.
 */
export function tituloActividad(a: { contenido: string; tipo: TipoActividad }): string {
  return a.contenido.trim() || TIPO_ACTIVIDAD_META[a.tipo].label;
}
