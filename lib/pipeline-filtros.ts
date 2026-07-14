/**
 * Contrato de filtros del Pipeline (SOL-17/18 + orden) para persistirlos en la URL.
 * Funciones puras (serializar/parsear) — un solo lugar que define cómo se guardan los
 * filtros del pipeline, compartido por el server component (hidrata desde searchParams)
 * y el cliente (espeja a la URL vía useUrlFilters).
 */
import type { DealResultado } from "@/types/crm";

export type OrdenPipeline =
  | "none"
  | "valor"
  | "temperatura"
  | "probabilidad"
  | "actividad"
  | "seguimiento";

export const ORDENES_PIPELINE: OrdenPipeline[] = [
  "none", "valor", "temperatura", "probabilidad", "actividad", "seguimiento",
];

const ESTADOS_VALIDOS: DealResultado[] = ["ABIERTO", "SUSPENDIDO", "GANADO", "PERDIDO"];
// Vista por defecto del pipeline: solo los estados activos (SOL-18).
export const ESTADOS_DEFAULT: DealResultado[] = ["ABIERTO", "SUSPENDIDO"];

export interface PipelineFiltros {
  q: string;
  estados: DealResultado[];
  orden: OrdenPipeline;
  vendedor: string; // "todos" | id
  tipo: string; // "todos" | id
  vista: "tablero" | "lista";
}

export function emptyPipelineFiltros(): PipelineFiltros {
  return { q: "", estados: [...ESTADOS_DEFAULT], orden: "none", vendedor: "todos", tipo: "todos", vista: "tablero" };
}

function esDefaultEstados(estados: DealResultado[]): boolean {
  return estados.length === ESTADOS_DEFAULT.length && ESTADOS_DEFAULT.every((e) => estados.includes(e));
}

// Filtros → query string. Solo se escriben los valores que difieren del default,
// para dejar la URL limpia cuando el pipeline está en su vista base.
export function serializePipelineFiltros(f: PipelineFiltros): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (!esDefaultEstados(f.estados)) f.estados.forEach((e) => p.append("estado", e));
  if (f.orden !== "none") p.set("orden", f.orden);
  if (f.vendedor !== "todos") p.set("vendedor", f.vendedor);
  if (f.tipo !== "todos") p.set("tipo", f.tipo);
  if (f.vista !== "tablero") p.set("vista", f.vista);
  return p.toString();
}

type ParamMap = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const many = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

// searchParams (objeto del server component) → filtros. Valores inválidos caen al default.
export function parsePipelineFiltros(sp: ParamMap): PipelineFiltros {
  const estados = Array.from(
    new Set(
      many(sp.estado)
        .flatMap((s) => s.split(","))
        .map((s) => s.trim())
        .filter((e): e is DealResultado => ESTADOS_VALIDOS.includes(e as DealResultado))
    )
  );
  const orden = one(sp.orden) as OrdenPipeline;
  return {
    q: one(sp.q),
    estados: estados.length ? estados : [...ESTADOS_DEFAULT],
    orden: ORDENES_PIPELINE.includes(orden) ? orden : "none",
    vendedor: one(sp.vendedor) || "todos",
    tipo: one(sp.tipo) || "todos",
    vista: one(sp.vista) === "lista" ? "lista" : "tablero",
  };
}
