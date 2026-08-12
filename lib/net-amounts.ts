/**
 * Montos netos de una orden (sin IVA) y su conversión a pesos.
 *
 * Regla del proyecto: los montos de cara al usuario en vistas agregadas son NETOS SIN IVA
 * (`subtotal_con_descuento`), nunca el total con impuestos.
 *
 * El bug que este módulo tenía: `net * (toNumber(tipo_cambio) || 1)`. Con `tipo_cambio` en
 * null, `toNumber` devuelve 0 y el `|| 1` lo convertía en 1 → **una orden en dólares se
 * sumaba a pesos 1 a 1, en silencio**. Un cliente podía aparecer en el puesto equivocado de
 * un ranking y nadie tenía cómo notarlo.
 *
 * Por eso `netAmountMxn` ahora devuelve `null` cuando no se puede convertir. El cambio de
 * firma es deliberado: convierte a `tsc --noEmit` en la checklist del arreglo, así ningún
 * agregado se puede olvidar. Omitir un monto es honesto; inventarlo no.
 */

type NumberLike = number | { toNumber(): number } | null | undefined;

function toNumber(value: NumberLike) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export interface NetAmountFields {
  moneda: string;
  subtotal_con_descuento: NumberLike;
  tipo_cambio?: NumberLike;
}

/** Neto sin IVA, en la moneda ORIGINAL de la orden. */
export function netAmount(order: NetAmountFields) {
  return toNumber(order.subtotal_con_descuento);
}

/** ¿Se puede expresar en pesos? Falso solo para USD sin tipo de cambio cargado. */
export function tieneTipoCambio(order: NetAmountFields): boolean {
  return order.moneda !== "USD" || toNumber(order.tipo_cambio) > 0;
}

/**
 * Neto sin IVA convertido a pesos. **`null` = no convertible** (USD sin tipo de cambio).
 * Nunca inventa una paridad 1:1.
 */
export function netAmountMxn(order: NetAmountFields): number | null {
  const net = netAmount(order);
  if (order.moneda !== "USD") return net;
  const tc = toNumber(order.tipo_cambio);
  return tc > 0 ? net * tc : null;
}

/**
 * La única forma correcta de sumar una lista con monedas mezcladas.
 *
 * Devuelve también cuántas quedaron afuera, para que la pantalla pueda decirlo en vez de
 * mostrar un total que miente por omisión silenciosa.
 */
export function sumaNetaMxn(ordenes: readonly NetAmountFields[]): {
  mxn: number;
  sin_tipo_cambio: number;
} {
  let mxn = 0;
  let sin_tipo_cambio = 0;
  for (const o of ordenes) {
    const v = netAmountMxn(o);
    if (v === null) sin_tipo_cambio++;
    else mxn += v;
  }
  return { mxn, sin_tipo_cambio };
}

/**
 * Ticket promedio en pesos.
 *
 * El denominador son SOLO las órdenes convertibles. Dividir por el total le imputaría cero
 * pesos a las que no tienen tipo de cambio, que es exactamente lo que este módulo evita:
 * omitir es honesto, inventar un monto no. Con 100.000 MXN y una orden USD sin tipo de cambio,
 * el promedio es 100.000 — no 50.000.
 */
export function ticketPromedioMxn(ordenes: readonly NetAmountFields[]): {
  promedio: number;
  sin_tipo_cambio: number;
} {
  const { mxn, sin_tipo_cambio } = sumaNetaMxn(ordenes);
  const convertibles = ordenes.length - sin_tipo_cambio;
  return { promedio: convertibles > 0 ? mxn / convertibles : 0, sin_tipo_cambio };
}
