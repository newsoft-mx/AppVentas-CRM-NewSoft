/**
 * Zona horaria del negocio (Bloque B — bordes).
 *
 * Los reportes reciben rangos como fechas-solo ("YYYY-MM-DD"). Interpretarlas con
 * `new Date("...T00:00:00")` las ancla a la TZ del proceso — que en prod (Vercel/
 * Lightsail) es UTC —, corriendo los límites de día ~6h para un negocio en México.
 * Acá se resuelve el límite de día en la TZ del negocio (configurable) y se devuelve
 * el instante UTC correcto para filtrar en la BD.
 *
 * Usa Intl (sin dependencias) y es DST-safe: deriva el offset real de la TZ para
 * la fecha dada, no un offset fijo.
 */

export const TZ_NEGOCIO = process.env.REPORTE_TZ || "America/Mexico_City";

// Partes de fecha/hora de un instante, en la TZ del negocio (para display/prefill).
function partesEnTZ(fecha: Date, tz: string): Record<string, string> {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(fecha)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  if (p.hour === "24") p.hour = "00"; // algunas plataformas dan "24" a medianoche
  return p;
}

/**
 * "Ahora" como string de <input type="datetime-local"> (YYYY-MM-DDTHH:mm) en la TZ
 * del negocio. Reemplaza el uso de la hora del navegador para precargar inputs.
 */
export function ahoraInput(tz: string = TZ_NEGOCIO): string {
  const p = partesEnTZ(new Date(), tz);
  // Alinear al slot de 30 min (piso): 00 o 30, para que el prefill sea un slot válido.
  const min = Number(p.minute) < 30 ? "00" : "30";
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${min}`;
}

// Milisegundos que la TZ está adelante de UTC, para el instante utcMs dado.
function offsetMs(tz: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  const hour = m.hour === "24" ? 0 : Number(m.hour); // algunas plataformas dan "24"
  const asUtc = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), hour, Number(m.minute), Number(m.second));
  return asUtc - utcMs;
}

// Instante UTC que corresponde a la hora de pared (y/mo/d hh:mm:ss.ms) en la TZ dada.
function wallEnTZaUtc(
  y: number, mo: number, d: number, hh: number, mm: number, ss: number, ms: number, tz: string
): Date {
  // offsetMs opera a granularidad de segundos (Intl no expone ms); los ms se suman
  // al final para no arrastrar un error sub-segundo.
  const guess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const off = offsetMs(tz, guess);
  let utc = guess - off;
  // Segunda pasada: en bordes de DST el offset puede diferir cerca del instante real.
  const off2 = offsetMs(tz, utc);
  if (off2 !== off) utc = guess - off2;
  return new Date(utc + ms);
}

// Regex de fecha-solo YYYY-MM-DD.
const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Límite de día en la TZ del negocio para una fecha "YYYY-MM-DD".
 * borde="inicio" → 00:00:00.000; borde="fin" → 23:59:59.999.
 * Devuelve null si la fecha no es válida.
 */
export function limiteDiaNegocio(
  fechaStr: string,
  borde: "inicio" | "fin",
  tz: string = TZ_NEGOCIO
): Date | null {
  const match = FECHA_RE.exec(fechaStr);
  if (!match) return null;
  const [, y, mo, d] = match.map(Number);
  const dt =
    borde === "inicio"
      ? wallEnTZaUtc(y, mo, d, 0, 0, 0, 0, tz)
      : wallEnTZaUtc(y, mo, d, 23, 59, 59, 999, tz);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
