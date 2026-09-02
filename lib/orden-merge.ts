/**
 * Estado final de los campos que mueven plata al EDITAR una orden.
 *
 * La regla parece obvia y no lo es: en un PATCH/PUT parcial, `undefined` y `null` significan
 * cosas distintas.
 *
 *   undefined = "no me lo mandaron"  → se conserva lo que ya estaba guardado
 *   null      = "borrámelo"          → se quita
 *
 * Confundirlos produjo una orden inconsistente en producción: la ruta usaba `??` para calcular
 * —que trata los dos casos como "conservar"— y `!== undefined` para guardar —que sí los
 * distingue—. Al BORRAR un descuento, el cálculo seguía aplicando el viejo mientras el update
 * escribía null: quedaba una orden que dice "sin descuento" con los montos descontados, y eso
 * sale impreso en la cotización que ve el cliente.
 *
 * Vive acá y no en la ruta para que la regla sea una sola, y para que se pueda probar sin
 * levantar media transacción de Prisma.
 */

/** Lo que Prisma devuelve para una columna Decimal nullable. */
type DecimalLike = { toNumber(): number } | null | undefined;

const num = (v: DecimalLike): number | undefined => (v == null ? undefined : v.toNumber());

export interface CamposDeMonto {
  descuento_porcentaje?: number | null;
  tasa_iva?: number | null;
  aplica_iva?: boolean;
  moneda?: "MXN" | "USD";
  tipo_cambio?: number | null;
}

export interface OrdenGuardada {
  descuento_porcentaje: DecimalLike;
  tasa_iva: DecimalLike;
  aplica_iva: boolean;
  moneda: string;
  tipo_cambio: DecimalLike;
}

/**
 * Mezcla lo que llegó en el body con lo que ya estaba guardado, respetando la distinción
 * entre "no vino" y "borrámelo". El resultado alimenta AL MISMO TIEMPO el cálculo de montos
 * y lo que se persiste: que esos dos lados puedan divergir es justamente el bug.
 */
export function resolverCamposDeMonto(entrada: CamposDeMonto, guardada: OrdenGuardada) {
  const mezclar = <T>(nuevo: T | null | undefined, actual: T | undefined): T | null | undefined =>
    nuevo !== undefined ? nuevo : actual;

  return {
    descuento_porcentaje: mezclar(entrada.descuento_porcentaje, num(guardada.descuento_porcentaje)),
    tasa_iva: mezclar(entrada.tasa_iva, num(guardada.tasa_iva)),
    aplica_iva: entrada.aplica_iva !== undefined ? entrada.aplica_iva : guardada.aplica_iva,
    moneda: (entrada.moneda !== undefined ? entrada.moneda : guardada.moneda) as "MXN" | "USD",
    tipo_cambio: mezclar(entrada.tipo_cambio, num(guardada.tipo_cambio)),
  };
}
