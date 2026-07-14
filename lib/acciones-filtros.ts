/**
 * Contrato de filtros de Próximas Acciones para persistirlos en la URL (pilar 3).
 * Puro; compartido por el server component (hidrata) y el cliente (espeja vía useUrlFilters).
 */
import type { TipoActividad, EstadoAccion } from "@/types/crm";

const TIPOS: TipoActividad[] = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP", "SISTEMA"];
const ESTADOS: EstadoAccion[] = ["PENDIENTE", "EN_PROCESO", "TERMINADO"];

export interface AccionesFiltros {
  vista: "lista" | "calendario";
  vendedor: string; // "todos" | id
  tipo: "todos" | TipoActividad;
  estado: "todos" | EstadoAccion;
}

export function emptyAccionesFiltros(): AccionesFiltros {
  return { vista: "lista", vendedor: "todos", tipo: "todos", estado: "todos" };
}

export function serializeAccionesFiltros(f: AccionesFiltros): string {
  const p = new URLSearchParams();
  if (f.vista !== "lista") p.set("vista", f.vista);
  if (f.vendedor !== "todos") p.set("vendedor", f.vendedor);
  if (f.tipo !== "todos") p.set("tipo", f.tipo);
  if (f.estado !== "todos") p.set("estado", f.estado);
  return p.toString();
}

type ParamMap = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export function parseAccionesFiltros(sp: ParamMap): AccionesFiltros {
  const tipo = one(sp.tipo) as TipoActividad;
  const estado = one(sp.estado) as EstadoAccion;
  return {
    vista: one(sp.vista) === "calendario" ? "calendario" : "lista",
    vendedor: one(sp.vendedor) || "todos",
    tipo: TIPOS.includes(tipo) ? tipo : "todos",
    estado: ESTADOS.includes(estado) ? estado : "todos",
  };
}
