/**
 * Contrato de filtros de Órdenes (pilar 3). Puro; compartido por el server component
 * (hidrata desde searchParams o desde la cookie de memoria) y el cliente (espeja a la URL).
 *
 * Existe porque acá el códec estaba PARTIDO: el serializador vivía dentro de VentasClient y
 * el parser estaba copiado a mano en la página, con su propia interfaz de 18 líneas. Dos
 * mitades de un mismo códec en dos archivos que nada obligaba a coincidir — que es, un nivel
 * más abajo, el mismo tipo de bug que estamos arreglando.
 */
import {
  appendArrayParams,
  emptyOrdenFilters,
  parseEstatusList,
  parseNumberList,
  parseStringList,
} from "@/lib/filter-utils";
import type { ContratoFiltros, ParamMap } from "@/lib/filtros-memoria";
import { parseModoVista, serializeModoVista } from "@/lib/ventas-vista";
import type { FiltroOrdenes } from "@/types/ordenes";

export const CLAVES_ORDENES = [
  "ano", "q", "mes", "estatus", "cliente_id", "tipo_cotizacion_id", "vendedor_id", "vista",
] as const;

export function serializeOrdenFiltros(f: FiltroOrdenes): string {
  const p = new URLSearchParams();
  appendArrayParams(p, "ano", f.ano);
  appendArrayParams(p, "q", f.q);
  appendArrayParams(p, "mes", f.mes);
  appendArrayParams(p, "estatus", f.estatus);
  appendArrayParams(p, "cliente_id", f.cliente_id);
  appendArrayParams(p, "tipo_cotizacion_id", f.tipo_cotizacion_id);
  appendArrayParams(p, "vendedor_id", f.vendedor_id);
  // El modo agrupado (default) no se escribe: la URL queda limpia salvo que se lo cambie.
  const vista = serializeModoVista(f.vista);
  if (vista) p.set("vista", vista);
  return p.toString();
}

/**
 * Qué sobrevive entre visitas: **todo lo que se puede elegir**, período incluido.
 *
 * Antes el período (`ano`/`q`/`mes`) quedaba afuera, con el argumento de que es absoluto y de
 * que guardarlo te devolvía a una pantalla vacía. Ese argumento estaba mal en los dos extremos:
 * volver con "2026" puesto no muestra una pantalla vacía sino datos de 2026, y la barra de
 * filtros muestra el chip "2026", así que la causa está a la vista. A cambio de cubrir un
 * problema chico y visible se rompía la expectativa básica —"dejé un filtro puesto y no está"—
 * que es exactamente como se reportó el bug.
 *
 * Eso incluye `vista` (agrupado/lista): quien desagrupó espera volver a encontrar la lista
 * desagrupada, igual que espera encontrar el año que dejó puesto.
 *
 * Si algún día entra un filtro de TEXTO LIBRE a esta pantalla, ese sí queda afuera: el charset
 * de la cookie (`esValorCookieSeguro`) no lo admite y la memoria se borraría en silencio.
 */
export function serializeOrdenMemoria(f: FiltroOrdenes): string {
  return serializeOrdenFiltros(f);
}

/** Acepta los tres formatos que la app ya emitía: `k=a&k=b`, `k[]=a` y `k=a,b`. */
function lista(sp: ParamMap, clave: string): (string | string[])[] {
  return [sp[clave], sp[`${clave}[]`]].filter(Boolean) as (string | string[])[];
}

export function parseOrdenFiltros(sp: ParamMap): FiltroOrdenes {
  return {
    ...emptyOrdenFilters(),
    ano: parseNumberList(lista(sp, "ano").flat()),
    q: parseNumberList(lista(sp, "q").flat()).filter((q) => q >= 1 && q <= 4),
    mes: parseNumberList(lista(sp, "mes").flat()).filter((m) => m >= 1 && m <= 12),
    estatus: parseEstatusList(lista(sp, "estatus").flat()),
    cliente_id: parseStringList(lista(sp, "cliente_id").flat()),
    tipo_cotizacion_id: parseStringList(lista(sp, "tipo_cotizacion_id").flat()),
    vendedor_id: parseStringList(lista(sp, "vendedor_id").flat()),
    vista: parseModoVista(typeof sp.vista === "string" ? sp.vista : undefined),
  };
}

export const ORDENES_FILTROS: ContratoFiltros<FiltroOrdenes> = {
  pantalla: "ventas",
  claves: CLAVES_ORDENES,
  parse: parseOrdenFiltros,
  serialize: serializeOrdenFiltros,
  serializeMemoria: serializeOrdenMemoria,
};

/**
 * ¿Hay algún filtro puesto?
 *
 * Lo necesitan dos lugares que tienen que coincidir sí o sí: la barra —para decidir si muestra
 * "Limpiar todo"— y el estado vacío de la tabla, para saber si decir "todavía no hay órdenes"
 * o "tu filtro no deja ver ninguna". Si cada uno lo calculara por su cuenta, el día que se
 * agregue un filtro nuevo uno de los dos se olvida y la pantalla vuelve a mentir.
 *
 * `vista` queda afuera: es cómo se mira la lista, no qué se filtra. Con la tabla agrupada por
 * cliente y sin ningún filtro, la lista sigue estando vacía porque no hay datos.
 */
export function hayFiltrosDeOrdenes(f: FiltroOrdenes): boolean {
  return (
    f.ano.length > 0 ||
    f.q.length > 0 ||
    f.mes.length > 0 ||
    f.estatus.length > 0 ||
    f.cliente_id.length > 0 ||
    f.tipo_cotizacion_id.length > 0 ||
    f.vendedor_id.length > 0
  );
}

/** Deja los filtros en cero sin tocar `vista`, por el mismo motivo. */
export function limpiarFiltrosDeOrdenes(f: FiltroOrdenes): FiltroOrdenes {
  return { ...f, ...emptyOrdenFilters(), vista: f.vista };
}
