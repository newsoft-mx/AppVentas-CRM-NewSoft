// Termómetro del deal (REQ-06).
//
// El "termómetro" es la temperatura del deal (enum de 5 niveles). Estas funciones puras
// describen cómo se mueve, atadas a parámetros CONFIGURABLES (CrmConfig) para que Roldán
// los calibre sin tocar código:
//   - actividad exitosa  → sube (según puntos por tipo)
//   - actividad fallida  → no mueve (se decide en el caller; acá no se llama)
//   - inactividad        → enfría
//   - cruce de umbral    → sugiere/dispara avance de etapa

import type { Temperatura, TipoActividad } from "@/types/crm";

// Orden ascendente de temperatura (índice = nivel)
export const TEMP_ORDEN: Temperatura[] = [
  "MUY_FRIO",
  "FRIO",
  "TIBIO",
  "CALIENTE",
  "MUY_CALIENTE",
];

export interface ParametrosTermometro {
  /** Niveles que sube cada tipo de actividad exitosa */
  puntos_actividad: Partial<Record<TipoActividad, number>>;
  /** Niveles que enfría una racha de inactividad */
  enfriamiento_nivel: number;
}

function nivel(t: Temperatura): number {
  const i = TEMP_ORDEN.indexOf(t);
  return i < 0 ? 2 : i; // default TIBIO
}

function desdeNivel(n: number): Temperatura {
  const clamped = Math.max(0, Math.min(TEMP_ORDEN.length - 1, n));
  return TEMP_ORDEN[clamped];
}

/** Sube la temperatura según el tipo de actividad exitosa registrada. */
export function subirTemperatura(
  actual: Temperatura,
  tipo: TipoActividad,
  params: ParametrosTermometro
): Temperatura {
  const sube = params.puntos_actividad[tipo] ?? 0;
  if (sube <= 0) return actual;
  return desdeNivel(nivel(actual) + sube);
}

/** Enfría la temperatura cuando el deal supera el umbral de inactividad. */
export function enfriarPorInactividad(
  actual: Temperatura,
  diasInactivo: number,
  umbralDias: number,
  params: ParametrosTermometro
): Temperatura {
  if (diasInactivo <= umbralDias) return actual;
  return desdeNivel(nivel(actual) - params.enfriamiento_nivel);
}

/**
 * ¿La temperatura alcanzó el umbral de avance de la etapa actual?
 * Devuelve true si hay que sugerir/avanzar a la siguiente etapa.
 */
export function cruzaUmbralAvance(
  temperatura: Temperatura,
  umbralEtapa: Temperatura | null
): boolean {
  if (!umbralEtapa) return false;
  return nivel(temperatura) >= nivel(umbralEtapa);
}

/** Determina si una actividad cuenta como "exitosa" para mover el termómetro. */
export function actividadExitosa(tipo: TipoActividad, exitosa: boolean | null): boolean {
  // La llamada solo cuenta si contestó; el resto de interacciones cuentan como éxito.
  if (tipo === "LLAMADA") return exitosa === true;
  return tipo === "EMAIL" || tipo === "WHATSAPP" || tipo === "NOTA";
}

/**
 * Temperatura efectiva para mostrar: parte de la temperatura guardada y la enfría si el deal
 * lleva inactivo más del umbral. No se persiste — es display (decay visual por inactividad).
 */
export function temperaturaEfectiva(
  guardada: Temperatura,
  ultimaActividad: Date | string | null,
  umbralDias: number,
  params: ParametrosTermometro,
  ahora: Date
): Temperatura {
  if (!ultimaActividad) return guardada;
  const ultimaMs = ultimaActividad instanceof Date ? ultimaActividad.getTime() : new Date(ultimaActividad).getTime();
  const dias = Math.floor((ahora.getTime() - ultimaMs) / 86_400_000);
  return enfriarPorInactividad(guardada, dias, umbralDias, params);
}
