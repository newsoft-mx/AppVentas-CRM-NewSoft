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
import type { FiltroOrdenes } from "@/types/ordenes";

export const CLAVES_ORDENES = [
  "ano", "q", "mes", "estatus", "cliente_id", "tipo_cotizacion_id", "vendedor_id",
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
  return p.toString();
}

/**
 * Qué sobrevive entre visitas: los filtros categóricos. NO el período (`ano`/`q`/`mes`),
 * porque es ABSOLUTO — guardar "2026" significa que en enero volvés a una pantalla vacía sin
 * ninguna causa visible. El día que Órdenes tenga períodos relativos ("Año en curso"), esos
 * sí se pueden recordar.
 *
 * Consecuencia a tener presente: quien tenía "Venta + 2026" vuelve a ver "Venta" de todos
 * los años. Se recuerda el filtro que pidió el cliente, no el recorte temporal.
 */
export function serializeOrdenMemoria(f: FiltroOrdenes): string {
  return serializeOrdenFiltros({ ...f, ano: [], q: [], mes: [] });
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
  };
}

export const ORDENES_FILTROS: ContratoFiltros<FiltroOrdenes> = {
  pantalla: "ventas",
  claves: CLAVES_ORDENES,
  parse: parseOrdenFiltros,
  serialize: serializeOrdenFiltros,
  serializeMemoria: serializeOrdenMemoria,
};
