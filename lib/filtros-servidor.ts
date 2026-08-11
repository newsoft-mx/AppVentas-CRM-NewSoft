/**
 * Hidratación de filtros en el server. Separado de lib/filtros-memoria porque ese módulo es
 * puro y lo importan componentes cliente: `next/headers` no puede aparecer ahí.
 *
 * **Invariante de seguridad de la hidratación**: el server es el único que LEE la cookie; el
 * cliente es el único que la ESCRIBE. El cliente nunca inicializa estado desde
 * `document.cookie`, así que server y primer render coinciden siempre y no hay mismatch
 * posible. La regla a defender en revisión: nunca leer `document.cookie` en render ni en un
 * `useState(() => …)`.
 */
import { cookies } from "next/headers";
import {
  nombreCookie,
  resolverFiltros,
  type ContratoFiltros,
  type ParamMap,
} from "@/lib/filtros-memoria";

/**
 * Los filtros con los que arranca la pantalla: **URL > cookie > default**.
 *
 * La cookie es entrada NO confiable (el usuario puede editarla a mano). El punto de
 * validación es el `parse` del contrato, que es total y descarta cualquier valor inválido.
 * No hay escalada posible: los ids validados van a un `in` de Prisma parametrizado y por
 * encima sigue el scoping por rol (`scopeOrdenWhere`/`scopeDealWhere`), así que una cookie
 * manipulada puede a lo sumo filtrar de MÁS, nunca ampliar el alcance.
 */
export async function filtrosIniciales<T>(c: ContratoFiltros<T>, sp: ParamMap): Promise<T> {
  const guardado = c.serializeMemoria
    ? (await cookies()).get(nombreCookie(c.pantalla))?.value
    : undefined;
  return resolverFiltros(c, sp, guardado).filtros;
}
