/**
 * Contrato de filtros del reporte de Funnel/conversión para persistirlos en la URL
 * (pilar 3). Puro; compartido por el server component (hidrata) y el cliente.
 */
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

type ParamMap = Record<string, string | string[] | undefined>;
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
