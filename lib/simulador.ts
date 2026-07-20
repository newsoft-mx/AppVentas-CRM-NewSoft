// Motor del Simulador de Casos de Negocio (migración a nativo).
//
// Cálculo PURO (sin UI): compara el embudo del cliente Estado Actual vs Con Mejora y deriva el
// ingreso incremental. SSOT y testeable. El shape de `SimuladorState` es EXACTAMENTE el que
// guardaba el HTML original (datos = state), para que las cotizaciones ya guardadas sigan
// cargando sin migración de datos.

export type Periodo = "diario" | "semanal" | "mensual";
export type Modo = "absolute" | "percent";

export interface LadoInputs {
  leads: number;
  precio: number;
  cotiz: number;
  cierre: number; // % de cierre de cotizaciones
}

/** Estado completo del simulador = lo que se persiste como `datos` (shape del HTML original). */
export interface SimuladorState {
  name?: string;
  period: Periodo;
  mode: Modo;
  /** Mejora en modo %: variación sobre el actual (cierre en puntos porcentuales). */
  pct: { leads: number; precio: number; cotiz: number; cierre: number };
  actual: LadoInputs;
  /** Mejora en modo absoluto (valores directos). */
  mejoraAbsolute: LadoInputs;
  notes?: string;
  savedAt?: string;
}

export interface LadoCalc {
  ventasNative: number;
  ingresoNative: number;
  leadsMensual: number;
  cotizMensual: number;
  ventas: number; // mensualizado
  ingreso: number; // mensualizado
  tasaLeadCotiz: number;
}

export interface SimuladorResultado {
  actual: LadoCalc;
  mejora: LadoCalc;
  /** Inputs de la mejora ya resueltos (útil para mostrar en modo %). */
  mejoraInputs: LadoInputs;
  deltaMensual: number;
  deltaAnual: number;
  pctCrecimiento: number; // NaN si el actual es 0
  deltaVentas: number;
}

export const periodMult = (p: Periodo): number => (p === "diario" ? 30 : p === "semanal" ? 4.33 : 1);
export const periodLabel = (p: Periodo): string => (p === "diario" ? "día" : p === "semanal" ? "semana" : "mes");

export function computeSide(inp: LadoInputs, period: Periodo): LadoCalc {
  const mult = periodMult(period);
  const ventasNative = inp.cotiz * (inp.cierre / 100);
  const ingresoNative = ventasNative * inp.precio;
  const leadsMensual = inp.leads * mult;
  const cotizMensual = inp.cotiz * mult;
  return {
    ventasNative,
    ingresoNative,
    leadsMensual,
    cotizMensual,
    ventas: ventasNative * mult,
    ingreso: ingresoNative * mult,
    tasaLeadCotiz: leadsMensual > 0 ? (cotizMensual / leadsMensual) * 100 : 0,
  };
}

/** Resuelve los inputs de la mejora según el modo (absoluto directo, o % sobre el actual). */
export function resolverMejora(state: SimuladorState): LadoInputs {
  if (state.mode === "absolute") return state.mejoraAbsolute;
  const { actual, pct } = state;
  return {
    leads: actual.leads * (1 + pct.leads / 100),
    precio: actual.precio * (1 + pct.precio / 100),
    cotiz: actual.cotiz * (1 + pct.cotiz / 100),
    cierre: Math.min(100, actual.cierre + pct.cierre),
  };
}

export function computeSimulador(state: SimuladorState): SimuladorResultado {
  const actual = computeSide(state.actual, state.period);
  const mejoraInputs = resolverMejora(state);
  const mejora = computeSide(mejoraInputs, state.period);
  // Impacto: siempre mensualizado → anualizado, para comparabilidad.
  const deltaMensual = mejora.ingreso - actual.ingreso;
  return {
    actual,
    mejora,
    mejoraInputs,
    deltaMensual,
    deltaAnual: deltaMensual * 12,
    pctCrecimiento: actual.ingreso > 0 ? (deltaMensual / actual.ingreso) * 100 : NaN,
    deltaVentas: mejora.ventas - actual.ventas,
  };
}

export const SIMULADOR_DEFAULT: SimuladorState = {
  period: "mensual",
  mode: "absolute",
  pct: { leads: 50, precio: 0, cotiz: 55, cierre: 7 },
  actual: { leads: 120, precio: 4500, cotiz: 45, cierre: 28 },
  mejoraAbsolute: { leads: 180, precio: 4500, cotiz: 70, cierre: 35 },
  notes: "",
};
