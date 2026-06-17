import type { EstatusOrden, FiltroOrdenes, OrdenResumen } from "@/types/ordenes";
import type { FiltroReportes } from "@/types/reportes";

export const CURRENT_YEAR = new Date().getFullYear();

export function getAllParam(searchParams: URLSearchParams, key: string): string[] {
  const repeated = searchParams.getAll(key).filter(Boolean);
  const bracket = searchParams.getAll(`${key}[]`).filter(Boolean);
  const comma = (searchParams.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...repeated, ...bracket, ...comma]));
}

export function parseNumberList(values: unknown): number[] {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return Array.from(
    new Set(
      list
        .flatMap((value) => String(value).split(","))
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  );
}

export function parseStringList(values: unknown): string[] {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return Array.from(
    new Set(
      list
        .flatMap((value) => String(value).split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function parseEstatusList(values: unknown): EstatusOrden[] {
  const allowed = new Set(["BORRADOR", "COTIZADO", "VENTA"]);
  return parseStringList(values).filter((value): value is EstatusOrden => allowed.has(value));
}

export function appendArrayParams(params: URLSearchParams, key: string, values: Array<string | number>) {
  values.forEach((value) => params.append(key, String(value)));
}

export function emptyOrdenFilters(): FiltroOrdenes {
  return {
    ano: [],
    q: [],
    mes: [],
    estatus: [],
    cliente_id: [],
    tipo_cotizacion_id: [],
    vendedor_id: [],
  };
}

export function emptyReporteFilters(): FiltroReportes {
  return {
    ano: [],
    q: [],
    mes: [],
  };
}

export function matchPeriod(dateValue: string | Date, filtros: Pick<FiltroOrdenes | FiltroReportes, "ano" | "q" | "mes">) {
  if (!filtros.ano.length && !filtros.q.length && !filtros.mes.length) return true;

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const quarter = Math.ceil(month / 3);

  if (filtros.ano.length && !filtros.ano.includes(year)) return false;
  if (filtros.mes.length) return filtros.mes.includes(month);
  if (filtros.q.length) return filtros.q.includes(quarter);

  return true;
}

export function fechaFiltroOrden(orden: OrdenResumen) {
  return orden.fecha_venta ?? orden.created_at;
}

export function buildDateOrFilters(filtros: Pick<FiltroOrdenes | FiltroReportes, "ano" | "q" | "mes">) {
  const years = filtros.ano.length ? filtros.ano : [CURRENT_YEAR];
  const ranges = years.flatMap((year) => {
    if (filtros.mes.length) {
      return filtros.mes.map((month) => ({
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      }));
    }

    if (filtros.q.length) {
      return filtros.q.map((quarter) => {
        const startMonth = (quarter - 1) * 3;
        return {
          gte: new Date(Date.UTC(year, startMonth, 1)),
          lt: new Date(Date.UTC(year, startMonth + 3, 1)),
        };
      });
    }

    return [{
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    }];
  });

  return ranges;
}

export function selectedMonths(filtros: Pick<FiltroOrdenes | FiltroReportes, "q" | "mes">) {
  if (filtros.mes.length) return Array.from(new Set(filtros.mes)).sort((a, b) => a - b);
  if (filtros.q.length) {
    return Array.from(
      new Set(
        filtros.q.flatMap((quarter) => {
          const start = (quarter - 1) * 3 + 1;
          return [start, start + 1, start + 2];
        })
      )
    ).sort((a, b) => a - b);
  }
  return Array.from({ length: 12 }, (_, index) => index + 1);
}
