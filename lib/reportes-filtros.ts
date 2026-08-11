/**
 * Contrato de filtros de Reportes de ventas (pilar 3). Puro; compartido por el server
 * component y el cliente. Mismo motivo de existir que lib/ordenes-filtros: acá el códec
 * también estaba partido entre el componente y la página.
 *
 * **Esta pantalla NO recuerda nada, y es a propósito**: sus tres filtros (`ano`/`q`/`mes`)
 * son período ABSOLUTO. Guardar "2026" haría que en enero se abra vacía sin causa visible.
 * Por eso el contrato no declara `serializeMemoria` — la ausencia es la decisión, no un olvido.
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
  // Sin serializeMemoria: ver el comentario del encabezado.
};
