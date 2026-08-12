/**
 * Ordenamiento de tablas por encabezado (SSOT).
 *
 * Roldán fijó una ley el 07-ago: "cada vez que hagas una tabla debe de poderse ordenar...
 * SIEMPRE que hagas una tabla, puedes poner esa alternativa". La app tenía 13 tablas de datos
 * y **una sola** ordenaba — y no porque faltara el mecanismo, sino porque había TRES conviviendo,
 * con comparadores distintos: `localeCompare("es",{numeric:true})` en Órdenes, `localeCompare`
 * pelado en Contactos, y restas hardcodeadas en el Pipeline.
 *
 * Acá vive el único. La lógica es pura y sin React a propósito: jest corre en `node` y solo
 * toma `.ts`, así que todo lo que viva en un `.tsx` es intestable. Por eso el componente
 * (components/ui/ThOrdenable) es solo pintura.
 *
 * INVARIANTE que define el alcance: **el orden por columna nunca cruza un límite estructural.**
 * Reordena filas dentro de su tramo; no reordena ni disuelve los tramos. Eso cubre los grupos
 * por cliente de Órdenes y la partición activos/inactivos de Configuración, que tiene una fila
 * separadora en el medio — si el orden la cruzara, los inactivos se intercalarían.
 */

export type SentidoOrden = "asc" | "desc";

/** `campo: null` = orden natural, el que trae el dataset del server. */
export interface OrdenTabla<K extends string> {
  campo: K | null;
  sentido: SentidoOrden;
}

export type ValorOrdenable = string | number | boolean | Date | null | undefined;

/**
 * Cómo se extrae el valor comparable de cada columna. Es un `Record`, no un `switch`: si se
 * agrega un campo a `K` y se olvida el extractor, **tsc falla**. Un switch infiere `undefined`
 * en la rama faltante y no avisa nada.
 */
export type ExtractoresOrden<T, K extends string> = Record<K, (fila: T) => ValorOrdenable>;

/** Vacío = no hay dato. `0` y `false` NO son vacíos: un total en cero es un valor real. */
function esVacio(v: ValorOrdenable): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (typeof v === "number" && Number.isNaN(v)) ||
    (v instanceof Date && Number.isNaN(v.getTime()))
  );
}

function aNumero(v: ValorOrdenable): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  return null;
}

/**
 * Comparación base. No adivina fechas desde strings a propósito: un folio como "2024-001" se
 * leería como fecha y el orden de Folio quedaría roto. Las fechas se manejan como `Date`
 * porque el extractor las construye explícitamente.
 */
export function compararValores(a: ValorOrdenable, b: ValorOrdenable): number {
  const na = aNumero(a);
  const nb = aNumero(b);
  if (na !== null && nb !== null) return na - nb;
  // Mismo comparador que ya usaba Órdenes: locale "es" + numeric, para que "OV-2" venga
  // antes que "OV-10". Sin `sensitivity`, que cambiaría el desempate entre acentos.
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

/**
 * Ordena una lista. No muta la entrada.
 *
 * Los vacíos van SIEMPRE al final, en asc y en desc: se comparan afuera de la inversión de
 * signo. Antes, con `String(null)` = "null", una fila sin dato aterrizaba entre las N.
 *
 * Con `campo: null` devuelve la MISMA referencia, no una copia: preserva la identidad que los
 * `useMemo` de aguas abajo usan para no recalcular.
 */
export function ordenarFilas<T, K extends string>(
  filas: readonly T[],
  orden: OrdenTabla<K>,
  extractores: ExtractoresOrden<T, K>
): T[] {
  if (!orden.campo) return filas as T[];
  const extraer = extractores[orden.campo];
  const signo = orden.sentido === "asc" ? 1 : -1;
  // Array.sort es estable (ES2019): los empates conservan el orden del server.
  return [...filas].sort((a, b) => {
    const va = extraer(a);
    const vb = extraer(b);
    const aVacio = esVacio(va);
    const bVacio = esVacio(vb);
    if (aVacio || bVacio) return aVacio && bVacio ? 0 : aVacio ? 1 : -1;
    return signo * compararValores(va, vb);
  });
}

/**
 * Aplica el orden a cada tramo por separado. Ni el orden de los tramos ni su composición se
 * tocan — es la invariante del encabezado del módulo, hecha función.
 */
export function ordenarPorTramos<T, K extends string>(
  tramos: readonly (readonly T[])[],
  orden: OrdenTabla<K>,
  extractores: ExtractoresOrden<T, K>
): T[][] {
  return tramos.map((t) => ordenarFilas(t, orden, extractores));
}

/** Ciclo de tres estados: asc → desc → sin orden. Cambiar de columna arranca en asc. */
export function siguienteOrden<K extends string>(
  actual: OrdenTabla<K>,
  campo: K
): OrdenTabla<K> {
  if (actual.campo !== campo) return { campo, sentido: "asc" };
  if (actual.sentido === "asc") return { campo, sentido: "desc" };
  return { campo: null, sentido: "asc" };
}

export interface PropsOrden<K extends string> {
  campo: K;
  orden: OrdenTabla<K>;
  onOrdenar: (campo: K) => void;
}

/**
 * Fabrica las props de cada encabezado. Evita repetir el mismo
 * `onSort={(c) => setSort((s) => siguienteOrden(s, c))}` en cada columna — en Órdenes estaba
 * escrito literal 7 veces, que es justo lo que mide el gate de duplicación.
 */
export function propsOrdenables<K extends string>(
  orden: OrdenTabla<K>,
  onOrdenar: (campo: K) => void
): (campo: K) => PropsOrden<K> {
  return (campo) => ({ campo, orden, onOrdenar });
}

/** "campo:sentido" para la URL. Sin orden → "" (deja la URL limpia, como los filtros). */
export function serializeOrden<K extends string>(orden: OrdenTabla<K>): string {
  return orden.campo ? `${orden.campo}:${orden.sentido}` : "";
}

export function parseOrden<K extends string>(
  valor: string | undefined,
  camposValidos: readonly K[]
): OrdenTabla<K> {
  const sinOrden: OrdenTabla<K> = { campo: null, sentido: "asc" };
  if (!valor) return sinOrden;
  const [campo, sentido] = valor.split(":");
  if (!camposValidos.includes(campo as K)) return sinOrden;
  return { campo: campo as K, sentido: sentido === "desc" ? "desc" : "asc" };
}
