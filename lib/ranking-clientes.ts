/**
 * Cuánto vale cada cliente, en un solo lugar.
 *
 * Antes esta pregunta tenía TRES respuestas distintas conviviendo, y ninguna coincidía con las
 * otras: el "Top clientes" de Reportes sumaba solo las ventas; el subtotal por grupo de Órdenes
 * sumaba los tres estatus; y la ficha del cliente sumaba todo, de todos los tiempos. Roldán
 * pidió un ranking, y un ranking sobre tres definiciones no es un ranking.
 *
 * Vive en `lib/` y es puro porque lo consumen tres runtimes distintos —un server component, un
 * route handler y un componente de cliente— y porque jest corre en `node` con `testMatch` de
 * solo `.ts`: nada que viva en un `.tsx` es testeable.
 *
 * LA REGLA, ESCRITA UNA VEZ: **facturado siempre significa `VENTA`.** El filtro de la pantalla
 * decide QUÉ ÓRDENES entran al cálculo; lo que nunca cambia es qué estatus cuenta como
 * facturado. Por eso el conjunto se filtra afuera y acá solo se agrupa.
 */
import { netAmountMxn, type NetAmountFields } from "@/lib/net-amounts";

/** Lo mínimo que necesita una orden para entrar al ranking. */
export interface OrdenAgrupable extends NetAmountFields {
  estatus: string;
  cliente: { id: string; nombre: string };
}

export interface ClienteAgrupado<T> {
  cliente_id: string;
  nombre: string;
  /** Posición en el ranking, 1-based. Empata por monto, desempata por nombre. */
  posicion: number;
  /** Suma en pesos de las órdenes VENTA. Nunca incluye borradores ni cotizaciones. */
  facturado_mxn: number;
  /** Cuántas de sus órdenes están facturadas. */
  ordenes_venta: number;
  /** Cuántas órdenes suyas hay en el conjunto (todos los estatus). */
  ordenes_totales: number;
  /** Órdenes en USD sin tipo de cambio que quedaron FUERA de `facturado_mxn`. */
  sin_tipo_cambio: number;
  /** Las órdenes del cliente, en el orden en que venían. */
  ordenes: T[];
}

export interface OpcionesRanking {
  /**
   * Si un cliente sin ninguna venta aparece o no.
   *
   * `false` en Reportes: "Top clientes por venta" con un cliente en $0 arriba de la lista no
   * dice nada. `true` en Órdenes: ahí la tabla muestra TODAS las órdenes, y esconder al cliente
   * que solo tiene cotizaciones haría desaparecer filas que el usuario está viendo.
   */
  incluirSinVenta: boolean;
}

function esVenta(orden: { estatus: string }): boolean {
  return orden.estatus === "VENTA";
}

/**
 * Agrupa por cliente y ordena por monto facturado descendente.
 *
 * El desempate por nombre no es cosmético: sin él, dos clientes con el mismo monto salían en el
 * orden de inserción del `Map`, o sea en el orden en que el server devolvió sus órdenes. El
 * ranking "saltaba" entre renders sin que cambiara ningún dato.
 */
export function agruparPorCliente<T extends OrdenAgrupable>(
  ordenes: readonly T[],
  opciones: OpcionesRanking
): ClienteAgrupado<T>[] {
  const mapa = new Map<string, ClienteAgrupado<T>>();

  for (const orden of ordenes) {
    const id = orden.cliente.id;
    let grupo = mapa.get(id);
    if (!grupo) {
      grupo = {
        cliente_id: id,
        nombre: orden.cliente.nombre,
        posicion: 0, // se asigna al final, cuando ya están ordenados
        facturado_mxn: 0,
        ordenes_venta: 0,
        ordenes_totales: 0,
        sin_tipo_cambio: 0,
        ordenes: [],
      };
      mapa.set(id, grupo);
    }

    grupo.ordenes_totales += 1;
    grupo.ordenes.push(orden);

    if (esVenta(orden)) {
      grupo.ordenes_venta += 1;
      const mxn = netAmountMxn(orden);
      // `null` = orden en USD sin tipo de cambio. No se puede expresar en pesos, así que queda
      // fuera del monto y se cuenta aparte: un total que omite en silencio miente por omisión.
      if (mxn === null) grupo.sin_tipo_cambio += 1;
      else grupo.facturado_mxn += mxn;
    }
  }

  const grupos = Array.from(mapa.values()).filter(
    (g) => opciones.incluirSinVenta || g.ordenes_venta > 0
  );

  grupos.sort(
    (a, b) => b.facturado_mxn - a.facturado_mxn || a.nombre.localeCompare(b.nombre, "es")
  );

  // La posición se asigna DESPUÉS de ordenar y filtrar: es la posición en la lista que el
  // usuario ve, no en el universo. Si el ranking dice "#1" tiene que ser la primera fila.
  grupos.forEach((g, i) => {
    g.posicion = i + 1;
  });

  return grupos;
}

/**
 * El ranking de Reportes: los N primeros, sin los clientes que no facturaron.
 *
 * Es `agruparPorCliente` con dos decisiones fijas, no un cálculo aparte. Cuando esto eran dos
 * implementaciones separadas, `/ventas` y `/reportes` daban números distintos para la misma
 * pregunta y nadie sabía cuál creer.
 */
export function rankingClientes<T extends OrdenAgrupable>(
  ordenes: readonly T[],
  limite = 10
): ClienteAgrupado<T>[] {
  return agruparPorCliente(ordenes, { incluirSinVenta: false }).slice(0, limite);
}
