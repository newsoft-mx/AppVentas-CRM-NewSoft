/**
 * Contrato de filtros del reporte de Funnel/conversión para persistirlos en la URL
 * (pilar 3). Puro; compartido por el server component (hidrata) y el cliente.
 */
import type { ContratoFiltros, ParamMap } from "@/lib/filtros-memoria";

const PRESETS = ["hoy", "semana", "mes", "semestre", "año", "custom"];

export interface FunnelFiltros {
  preset: string;
  desde: string; // YYYY-MM-DD (solo con preset "custom")
  hasta: string; // YYYY-MM-DD (opcional)
  vendedor: string; // "" = todos | id
}

export function emptyFunnelFiltros(): FunnelFiltros {
  return { preset: "mes", desde: "", hasta: "", vendedor: "" };
}

export function serializeFunnelFiltros(f: FunnelFiltros): string {
  const p = new URLSearchParams();
  if (f.preset !== "mes") p.set("preset", f.preset);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.vendedor) p.set("vendedor", f.vendedor);
  return p.toString();
}

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const fecha = (v: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseFunnelFiltros(sp: ParamMap): FunnelFiltros {
  const preset = one(sp.preset);
  return {
    preset: PRESETS.includes(preset) ? preset : "mes",
    desde: fecha(one(sp.desde)),
    hasta: fecha(one(sp.hasta)),
    vendedor: one(sp.vendedor),
  };
}

export const CLAVES_FUNNEL = ["preset", "desde", "hasta", "vendedor"] as const;

/**
 * Se recuerda todo lo que se eligió, incluido el rango personalizado.
 *
 * Antes `desde`/`hasta` quedaban afuera —y con ellos el preset "custom", que sin sus fechas no
 * significa nada— con el argumento de que volver a un rango viejo era una trampa. Pero la
 * pantalla **muestra el rango debajo del título**, así que de trampa no tiene nada: dice
 * exactamente qué período está viendo. Y descartarlo obligaba a rearmar el rango a mano cada
 * vez, que era la molestia real.
 *
 * Las fechas son `YYYY-MM-DD`, o sea que pasan el charset de la cookie sin escaparse.
 */
export function serializeFunnelMemoria(f: FunnelFiltros): string {
  return serializeFunnelFiltros(f);
}

export const FUNNEL_FILTROS: ContratoFiltros<FunnelFiltros> = {
  pantalla: "funnel",
  claves: CLAVES_FUNNEL,
  parse: parseFunnelFiltros,
  serialize: serializeFunnelFiltros,
  serializeMemoria: serializeFunnelMemoria,
};
