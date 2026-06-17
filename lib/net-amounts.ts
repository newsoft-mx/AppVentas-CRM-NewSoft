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

export function netAmount(order: NetAmountFields) {
  return toNumber(order.subtotal_con_descuento);
}

export function netAmountMxn(order: NetAmountFields) {
  const net = netAmount(order);
  return order.moneda === "USD" ? net * (toNumber(order.tipo_cambio) || 1) : net;
}
