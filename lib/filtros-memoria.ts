/**
 * Memoria de filtros por pantalla (pilar 3, segunda capa).
 *
 * El problema que resuelve: los filtros se persistían SOLO en la URL, y los links del menú
 * lateral navegan a la ruta pelada. Salir de una vista y volver por el menú los borraba —
 * "cada vez que vuelves y sales se resetean" (Roldán, 07-ago).
 *
 * La idea, en una línea: **la cookie guarda el mismo query string que la URL**. Un solo códec
 * (`serialize`/`parse`) sirve a los dos medios, así que la cookie es "la última URL que
 * dejaste, recortada a lo que es seguro recordar". No hay un segundo formato que mantener.
 *
 * Qué se recuerda, y qué no:
 *  · SÍ — preferencia de vista: estado, tipo, vendedor, orden, modo de vista, preset relativo.
 *  · NO — texto de búsqueda: es transitorio; recordarlo lo convierte en un filtro invisible.
 *  · NO — período ABSOLUTO (año, trimestre, mes, desde/hasta): guardar "2026" es una trampa,
 *    porque en enero volvés a una pantalla vacía sin ninguna causa visible. Los presets
 *    RELATIVOS ("mes en curso") sí se guardan: se re-evalúan solos.
 *
 * Módulo puro (sin next/headers ni DOM): lo importan tanto componentes cliente como el
 * helper de servidor, y así es testeable en jest, que corre en `node` y solo toma `.ts`.
 */

export type Pantalla = "ventas" | "reportes" | "pipeline" | "acciones" | "funnel";

export type ParamMap = Record<string, string | string[] | undefined>;

/**
 * Todo lo que el mecanismo necesita saber de una pantalla, en un solo objeto. Vive junto a
 * las funciones puras de esa pantalla (lib/pipeline-filtros.ts, etc.) para que agregar un
 * filtro y declararlo sean el mismo gesto.
 */
export interface ContratoFiltros<T> {
  /** Identidad de la pantalla → nombre de la cookie. */
  pantalla: Pantalla;
  /** Claves que esta pantalla reconoce en la URL (sin el sufijo "[]"). */
  claves: readonly string[];
  /** Total y validante: cualquier basura cae al default. Es la defensa contra una cookie editada. */
  parse: (sp: ParamMap) => T;
  /** Filtros → query string de la URL. */
  serialize: (f: T) => string;
  /**
   * Subconjunto persistible. **Ausente = esta pantalla no recuerda nada** (es el caso de
   * Reportes, que solo tiene filtros de período absoluto).
   */
  serializeMemoria?: (f: T) => string;
}

export const COOKIE_PREFIX = "ns-f.";
/** 90 días rodantes: es preferencia de UI, no una credencial (la sesión dura 7 días). */
export const COOKIE_MAX_EDAD = 60 * 60 * 24 * 90;
export const COOKIE_MAX_LARGO = 512;

/**
 * La memoria solo contiene ids, enums y palabras fijas — nada de texto libre. Por eso su
 * serialización cae siempre en este charset, que es punto fijo de cualquier capa de
 * encode/decode (Next decodifica al leer la cookie; `document.cookie` no codifica al
 * escribir, así que el viaje solo es simétrico si el valor no necesita escaparse).
 *
 * Esto lo ENFORCEA en vez de dejarlo como accidente: si mañana alguien mete un campo de
 * texto en la memoria, la cookie se borra (degrada) en vez de corromperse, y el test
 * unitario se pone rojo.
 */
const CHARSET_SEGURO = /^[A-Za-z0-9._~=&-]*$/;

export function nombreCookie(p: Pantalla): string {
  return COOKIE_PREFIX + p;
}

export function esValorCookieSeguro(qs: string): boolean {
  return CHARSET_SEGURO.test(qs) && qs.length <= COOKIE_MAX_LARGO;
}

/**
 * El string a asignar a `document.cookie`.
 *
 * Con `qs` vacío devuelve un borrado (`Max-Age=0`), y de ahí sale gratis distinguir
 * "limpié los filtros a propósito" de "es mi primera visita": como los serializadores solo
 * escriben lo que difiere del default, limpiar produce `""` → la cookie se borra sola, sin
 * que los handlers de "Limpiar" sepan siquiera que existe una cookie.
 */
export function cookieDeMemoria(p: Pantalla, qs: string): string {
  const base = `${nombreCookie(p)}=`;
  if (!qs || !esValorCookieSeguro(qs)) return `${base}; Path=/; Max-Age=0; SameSite=Lax`;
  return `${base}${qs}; Path=/; Max-Age=${COOKIE_MAX_EDAD}; SameSite=Lax`;
}

/** Todas las cookies de memoria, para borrarlas al cerrar sesión. */
export const COOKIES_MEMORIA: string[] = (
  ["ventas", "reportes", "pipeline", "acciones", "funnel"] as Pantalla[]
).map(nombreCookie);

/** Query string → el mismo objeto que Next arma para `searchParams` (repetidos → array). */
export function qsAParamMap(qs: string | undefined): ParamMap {
  const out: ParamMap = {};
  if (!qs) return out;
  for (const [k, v] of new URLSearchParams(qs)) {
    const previo = out[k];
    if (previo === undefined) out[k] = v;
    else if (Array.isArray(previo)) previo.push(v);
    else out[k] = [previo, v];
  }
  return out;
}

/** ¿La URL trae alguna clave de esta pantalla? Acepta el alias `clave[]`. */
export function hayFiltrosEnUrl(sp: ParamMap, claves: readonly string[]): boolean {
  return claves.some((k) => {
    const v = sp[k] ?? sp[`${k}[]`];
    if (v === undefined) return false;
    return Array.isArray(v) ? v.some((s) => s !== "") : v !== "";
  });
}

/**
 * Precedencia: **URL > cookie > default**, y la URL gana EN BLOQUE, no campo por campo.
 *
 * Por qué en bloque: los serializadores omiten los defaults, así que la *ausencia* de una
 * clave es ambigua por construcción (`orden` ausente puede ser "no lo puse" o "lo puse en
 * none"). Con precedencia por campo sería imposible compartir un link que diga "sin orden"
 * si el receptor tiene `orden=valor` en su cookie — y poder compartir links es justamente
 * el motivo por el que la URL gana. En bloque, un link es exactamente reproducible y la
 * regla se explica en una frase: un link con filtros manda; un link pelado usa tu memoria.
 *
 * Consecuencia asumida: abrir un link con filtros ACTUALIZA tu memoria. La memoria es
 * siempre "lo último que estuviste mirando".
 */
export function resolverFiltros<T>(
  c: ContratoFiltros<T>,
  sp: ParamMap,
  cookieRaw: string | undefined
): { filtros: T; origen: "url" | "cookie" | "default" } {
  if (hayFiltrosEnUrl(sp, c.claves)) return { filtros: c.parse(sp), origen: "url" };
  if (c.serializeMemoria && cookieRaw) {
    return { filtros: c.parse(qsAParamMap(cookieRaw)), origen: "cookie" };
  }
  return { filtros: c.parse({}), origen: "default" };
}
