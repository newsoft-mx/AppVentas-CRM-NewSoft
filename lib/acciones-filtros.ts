/**
 * Contrato de filtros de Próximas Acciones para persistirlos en la URL (pilar 3).
 * Puro; compartido por el server component (hidrata) y el cliente (espeja vía useUrlFilters).
 *
 * Nota (SOL-21/23): NO hay filtro de estado. El inbox carga solo tareas pendientes
 * (WHERE_TAREA_PENDIENTE) y los estados quedaron en dos (Pendiente/Listo) → filtrar por
 * estado acá sería siempre "Pendiente". El filtro existía para separar Pendiente de
 * "En proceso", estado que se eliminó por no aplicar.
 */
import type { TipoActividad } from "@/types/crm";
import type { ContratoFiltros, ParamMap } from "@/lib/filtros-memoria";

const TIPOS: TipoActividad[] = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP", "SISTEMA"];

export interface AccionesFiltros {
  vista: "lista" | "calendario";
  vendedor: string; // "todos" | id
  tipo: "todos" | TipoActividad;
}

export function emptyAccionesFiltros(): AccionesFiltros {
  return { vista: "lista", vendedor: "todos", tipo: "todos" };
}

export function serializeAccionesFiltros(f: AccionesFiltros): string {
  const p = new URLSearchParams();
  if (f.vista !== "lista") p.set("vista", f.vista);
  if (f.vendedor !== "todos") p.set("vendedor", f.vendedor);
  if (f.tipo !== "todos") p.set("tipo", f.tipo);
  return p.toString();
}

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export function parseAccionesFiltros(sp: ParamMap): AccionesFiltros {
  const tipo = one(sp.tipo) as TipoActividad;
  return {
    vista: one(sp.vista) === "calendario" ? "calendario" : "lista",
    vendedor: one(sp.vendedor) || "todos",
    tipo: TIPOS.includes(tipo) ? tipo : "todos",
  };
}

export const CLAVES_ACCIONES = ["vista", "vendedor", "tipo"] as const;

export const ACCIONES_FILTROS: ContratoFiltros<AccionesFiltros> = {
  pantalla: "acciones",
  claves: CLAVES_ACCIONES,
  parse: parseAccionesFiltros,
  serialize: serializeAccionesFiltros,
  // Los tres son preferencia de vista y ninguno es temporal → se recuerdan todos.
  serializeMemoria: serializeAccionesFiltros,
};
