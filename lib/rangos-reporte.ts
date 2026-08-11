/**
 * Rangos de período para los reportes (SSOT).
 *
 * Roldán, 07-ago: "me pone mes, pero es los últimos treinta días. Si está tomando 30 días,
 * no tiene sentido. Yo quiero ver cómo vamos en el MES, de agosto, lo que va de agosto."
 *
 * Ese reclamo era la punta de cuatro defectos con una sola causa: el cálculo hacía
 * aritmética de fechas CIVILES usando instantes UTC (`Date` + `toISOString()`). Acá toda la
 * aritmética es sobre strings "YYYY-MM-DD" —que no tienen hora ni zona— y el reloj se
 * consulta una sola vez, afuera, con `hoyEnTZ`. Los cuatro mueren por construcción:
 *
 *  1. El período "anterior" se solapaba un día con el actual (su `hasta` era exactamente el
 *     `desde` del actual, y el server resuelve el `hasta` al FIN del día) → el delta "vs
 *     período anterior" venía inflado. Acá ninguno de los dos modos puede solapar.
 *  2. Restar un mes desbordaba: 31-mar menos 1 mes daba 3-mar. Ahora se hace clamp.
 *  3. `toISOString()` corría el día a partir de las 18:00 en México.
 *  4. "Semana" daba 8 días inclusive, no 7.
 *
 * Los períodos de escala contable (mes, trimestre, semestre, año) son CALENDARIO EN CURSO:
 * del día 1 del período a hoy, comparados contra el MISMO TRAMO del período anterior. Es lo
 * que ya hacía "año" —el único que estaba bien— generalizado al resto. Comparar 11 días
 * contra un mes completo haría que todo inicio de mes parezca una catástrofe.
 */

export type PresetRango = "hoy" | "semana" | "mes" | "trimestre" | "semestre" | "año" | "custom";

export const PRESETS_RANGO: readonly PresetRango[] = [
  "hoy", "semana", "mes", "trimestre", "semestre", "año", "custom",
];

export const PRESET_DEFAULT: PresetRango = "mes";

export function normalizarPreset(v: string | null | undefined): PresetRango {
  return PRESETS_RANGO.includes(v as PresetRango) ? (v as PresetRango) : PRESET_DEFAULT;
}

/** Fechas-solo, inclusivas en ambos extremos, en la TZ del negocio. */
export interface Rango {
  desde: string;
  hasta: string;
}

export interface RangoComparado {
  actual: Rango;
  anterior: Rango;
}

// ── Aritmética de calendario sobre "YYYY-MM-DD" ──

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function diasDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function sumarDias(iso: string, n: number): string {
  const [y, m, d] = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Suma meses conservando el día, recortado al último día del mes destino.
 * 31-mar menos 1 mes da 28-feb (29 en bisiesto), no 3-mar como daba `setMonth`.
 */
export function sumarMesesClamp(iso: string, n: number): string {
  const [y, m, d] = partes(iso);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(d, diasDelMes(ny, nm)));
}

/** Días entre dos fechas, contando ambos extremos. */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = partes(a);
  const [by, bm, bd] = partes(b);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000) + 1;
}

/** Cuántos meses dura cada tramo calendario. */
const MESES_TRAMO: Partial<Record<PresetRango, number>> = {
  mes: 1, trimestre: 3, semestre: 6, año: 12,
};

/** El día 1 del tramo calendario en curso que contiene a `hoy`. */
function inicioTramo(hoy: string, meses: number): string {
  const [y, m] = partes(hoy);
  const indice = Math.floor((m - 1) / meses) * meses; // 0-based
  return fmt(y, indice + 1, 1);
}

/**
 * El rango del preset y su comparable.
 *
 * Devuelve `null` solo con `custom` sin `desde` — mismo contrato que antes, para que la
 * pantalla sepa que todavía no hay nada que consultar.
 */
export function rangoDePreset(
  preset: PresetRango,
  hoy: string,
  custom?: { desde: string; hasta: string }
): RangoComparado | null {
  // Ventana rodante: el anterior termina el día ANTES de que empiece el actual, así que
  // nunca comparten un día.
  const rodante = (desde: string, hasta: string): RangoComparado => {
    const largo = diasEntre(desde, hasta);
    const finAnterior = sumarDias(desde, -1);
    return { actual: { desde, hasta }, anterior: { desde: sumarDias(finAnterior, -(largo - 1)), hasta: finAnterior } };
  };

  // Tramo calendario: se desplazan AMBOS extremos N meses atrás. Como el actual siempre
  // arranca el día 1 del período, el anterior termina estrictamente antes.
  const tramo = (meses: number): RangoComparado => {
    const desde = inicioTramo(hoy, meses);
    return {
      actual: { desde, hasta: hoy },
      anterior: { desde: sumarMesesClamp(desde, -meses), hasta: sumarMesesClamp(hoy, -meses) },
    };
  };

  if (preset === "custom") {
    if (!custom?.desde) return null;
    return rodante(custom.desde, custom.hasta || hoy);
  }
  if (preset === "hoy") return rodante(hoy, hoy);
  // Semana queda RODANTE a propósito: no tiene definición canónica (¿lunes o domingo?) y a
  // esa escala un "calendario en curso" mostraría 1 día contra 7 todos los lunes.
  if (preset === "semana") return rodante(sumarDias(hoy, -6), hoy);
  return tramo(MESES_TRAMO[preset] ?? 1);
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * El rango en palabras, para mostrarlo en pantalla: "1–11 ago", "1 jul – 11 ago",
 * "1 dic 2025 – 11 ene 2026". Hoy ninguna pantalla dice qué está mirando, que es el motivo
 * de fondo por el que el cliente no sabía que "mes" eran 30 días.
 */
export function etiquetaRango(r: Rango): string {
  const [ay, am, ad] = partes(r.desde);
  const [by, bm, bd] = partes(r.hasta);
  if (ay !== by) {
    return `${ad} ${MESES_CORTOS[am - 1]} ${ay} – ${bd} ${MESES_CORTOS[bm - 1]} ${by}`;
  }
  if (am !== bm) return `${ad} ${MESES_CORTOS[am - 1]} – ${bd} ${MESES_CORTOS[bm - 1]}`;
  if (ad === bd) return `${ad} ${MESES_CORTOS[am - 1]}`;
  return `${ad}–${bd} ${MESES_CORTOS[am - 1]}`;
}
