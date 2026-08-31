/**
 * Contrato de filtros del Pipeline (SOL-17/18 + orden) para persistirlos en la URL.
 * Funciones puras (serializar/parsear) — un solo lugar que define cómo se guardan los
 * filtros del pipeline, compartido por el server component (hidrata desde searchParams)
 * y el cliente (espeja a la URL vía useUrlFilters).
 */
import { ESTADO_DEAL_META, type DealResultado } from "@/types/crm";
import type { ContratoFiltros, ParamMap } from "@/lib/filtros-memoria";

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

/** Claves que esta pantalla reconoce en la URL. Si se agrega un filtro, va acá también. */
export const CLAVES_PIPELINE = ["q", "estado", "orden", "vendedor", "tipo", "vista"] as const;

/**
 * Qué se recuerda entre visitas. `q` (la búsqueda) NO: es texto transitorio, y recordarlo
 * lo convertiría en un filtro invisible que sigue al usuario entre sesiones.
 * Se define reusando `serialize` sobre un objeto podado — no hay un segundo formato.
 */
export function serializePipelineMemoria(f: PipelineFiltros): string {
  return serializePipelineFiltros({ ...f, q: "" });
}

export const PIPELINE_FILTROS: ContratoFiltros<PipelineFiltros> = {
  pantalla: "pipeline",
  claves: CLAVES_PIPELINE,
  parse: parsePipelineFiltros,
  serialize: serializePipelineFiltros,
  serializeMemoria: serializePipelineMemoria,
};

/**
 * Qué está mirando el usuario, en una línea.
 *
 * El encabezado decía «Prospectos activos» escrito en duro. Con el filtro por defecto era
 * cierto —el tablero arranca en ABIERTO + SUSPENDIDO—, pero en cuanto alguien filtraba por
 * Ganados, o por un vendedor, la pantalla seguía afirmando lo mismo. Un rótulo que no depende
 * de lo que muestra es un rótulo que tarde o temprano miente.
 *
 * Se deriva del MISMO objeto de filtros que se manda a la URL, así que no pueden desfasarse.
 * Las etiquetas de estado salen de `ESTADO_DEAL_META`, no de una segunda lista.
 *
 * @param nombres Cómo se llaman el vendedor y el tipo elegidos. Los ids no le dicen nada a
 *                nadie, y esta función no puede resolverlos sola.
 */
export function etiquetaDelTablero(
  f: PipelineFiltros,
  nombres: { vendedor?: string; tipo?: string } = {}
): string {
  const partes: string[] = [];

  // El default se nombra por lo que significa, no enumerando sus dos estados: "Activos y
  // pausados" es exacto pero peor de leer que la frase que el equipo ya usa.
  partes.push(
    esDefaultEstados(f.estados)
      ? "Prospectos activos"
      : f.estados.length === 0
        ? "Sin estados seleccionados"
        : f.estados.map((e) => ESTADO_DEAL_META[e].label).join(" y ")
  );

  if (f.vendedor !== "todos") partes.push(nombres.vendedor ?? "un vendedor");
  if (f.tipo !== "todos") partes.push(nombres.tipo ?? "una línea");
  if (f.q.trim()) partes.push(`«${f.q.trim()}»`);

  return partes.join(" · ");
}
