import { ESTATUS_ORDEN, type EstatusOrden, type FiltroOrdenes, type OrdenResumen } from "@/types/ordenes";
import { MODO_VISTA_DEFAULT } from "@/lib/ventas-vista";
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
  const allowed = new Set<string>(ESTATUS_ORDEN);
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
    vista: MODO_VISTA_DEFAULT,
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

// ── ¿En qué período cae una orden? ───────────────────────────
//
// `buildDateOrFilters` da el RANGO. Esto de acá decide sobre QUÉ FECHA se aplica, que es la
// parte que estaba escrita a mano en once lugares —con tres significados distintos— y por eso
// dos pantallas que dicen medir lo mismo daban números que no cuadraban.
//
// Las tres semánticas conviven A PROPÓSITO. La diferencia no es un descuido; el descuido era
// que estuviera implícita en un `flatMap` copiado y pegado, donde nadie la veía al leer.

type RangoFecha = { gte: Date; lt: Date };

/** Cómo se decide que una orden pertenece al período. */
export type AlcancePeriodo =
  /**
   * La VENTA se cerró en el período (`fecha_venta` dentro del rango). Es la única semántica
   * válida para plata: un reporte de ingresos cuenta lo que se cerró, no lo que se capturó.
   * Los call-sites la combinan con `estatus: "VENTA"`.
   */
  | "venta_cerrada"
  /**
   * La orden es del período por su fecha efectiva: `fecha_venta` si la tiene, si no
   * `created_at`. Es la vista de trabajo (la lista de Ventas), donde un borrador de este mes
   * tiene que aparecer aunque nunca se cierre.
   */
  | "fecha_efectiva"
  /**
   * Igual que `fecha_efectiva`, pero una orden marcada VENTA **sin** fecha de venta NO se
   * fecha por su creación: queda afuera.
   *
   * Es lo que usan los reportes, y es la razón por la que /ventas y /reportes pueden mostrar
   * conteos distintos sobre el mismo período. La diferencia solo aparece con filas en un
   * estado que no debería existir (VENTA sin fecha); PATCH /fecha-venta las podía crear.
   * Se conserva tal cual estaba: cambiar cuál de las dos gana mueve números de plata, y esa
   * es una decisión del negocio, no de un refactor.
   */
  | "fecha_efectiva_estricta";

/**
 * El `OR` que hay que ponerle al `where` para acotar al período pedido.
 *
 * OJO con el caso "sin filtros": hereda el default de `buildDateOrFilters`, que **no** es
 * "todos los años" sino **el año en curso**. Por eso esta función nunca devuelve vacío y por
 * eso los call-sites que quieren "sin restricción" tienen que decidirlo ellos, ANTES de
 * llamar — como ya hacen /ventas y /reportes con su `if`. Hacer que devolviera `null` sin
 * filtros parece más prolijo y es un cambio de plata: los tres reportes de ventas pasarían
 * de mostrar el año en curso a mostrar la historia entera.
 */
export function wherePeriodoOrden(
  filtros: Pick<FiltroOrdenes | FiltroReportes, "ano" | "q" | "mes">,
  alcance: AlcancePeriodo
): Array<Record<string, unknown>> {
  const rangos: RangoFecha[] = buildDateOrFilters(filtros);

  if (alcance === "venta_cerrada") {
    return rangos.map((rango) => ({ fecha_venta: rango }));
  }

  return rangos.flatMap((rango) => [
    { fecha_venta: rango },
    alcance === "fecha_efectiva_estricta"
      ? { estatus: { not: "VENTA" }, fecha_venta: null, created_at: rango }
      : { fecha_venta: null, created_at: rango },
  ]);
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

// Fecha-hora actual en formato de <input type="datetime-local"> (YYYY-MM-DDTHH:mm),
// en hora local. Para precargar inputs de fecha/hora con "ahora" (SOL-03).
export function ahoraLocal(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
