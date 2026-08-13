/**
 * Contrato de filtros de Reportes de ventas (pilar 3). Puro; compartido por el server
 * component y el cliente. Mismo motivo de existir que lib/ordenes-filtros: acá el códec
 * también estaba partido entre el componente y la página.
 *
 * Recuerda sus tres filtros, igual que el resto de las pantallas. Sus filtros son período
 * absoluto, y durante un tiempo eso fue el motivo para NO recordarlos: se suponía que volver
 * con "2026" puesto abría la pantalla vacía. No es así — abre con los datos de 2026, y el chip
 * del año queda a la vista explicando por qué. Que una pantalla se comporte distinto de las
 * otras cuesta más que el riesgo que evitaba.
 */
import {
  appendArrayParams,
  emptyReporteFilters,
  parseNumberList,
} from "@/lib/filter-utils";
import type { ContratoFiltros, ParamMap } from "@/lib/filtros-memoria";
import type { FiltroReportes } from "@/types/reportes";

export const CLAVES_REPORTES = ["ano", "q", "mes"] as const;

export function serializeReporteFiltros(f: FiltroReportes): string {
  const p = new URLSearchParams();
  appendArrayParams(p, "ano", f.ano);
  appendArrayParams(p, "q", f.q);
  appendArrayParams(p, "mes", f.mes);
  return p.toString();
}

function lista(sp: ParamMap, clave: string): (string | string[])[] {
  return [sp[clave], sp[`${clave}[]`]].filter(Boolean) as (string | string[])[];
}

export function parseReporteFiltros(sp: ParamMap): FiltroReportes {
  return {
    ...emptyReporteFilters(),
    ano: parseNumberList(lista(sp, "ano").flat()),
    q: parseNumberList(lista(sp, "q").flat()).filter((q) => q >= 1 && q <= 4),
    mes: parseNumberList(lista(sp, "mes").flat()).filter((m) => m >= 1 && m <= 12),
  };
}

export const REPORTES_FILTROS: ContratoFiltros<FiltroReportes> = {
  pantalla: "reportes",
  claves: CLAVES_REPORTES,
  parse: parseReporteFiltros,
  serialize: serializeReporteFiltros,
  // Todos sus filtros son seleccionables (año, trimestre, mes): se recuerdan todos.
  serializeMemoria: serializeReporteFiltros,
};
