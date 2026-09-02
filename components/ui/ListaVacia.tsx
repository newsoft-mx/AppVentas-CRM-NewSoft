import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import EstadoPanel from "@/components/ui/EstadoPanel";

/**
 * "No hay nada todavía" y "tu filtro no deja ver nada" son dos situaciones distintas, y la app
 * las venía mostrando iguales: el día 1, con la base recién sembrada y cero filtros puestos,
 * /ventas decía «No hay órdenes que coincidan con los filtros seleccionados» y el pipeline
 * decía «Sin deals con estos filtros». La app le echaba la culpa a filtros que nadie puso, y
 * no le decía al usuario nuevo qué hacer.
 *
 * Cada caso pide una salida distinta: si no hay datos, un botón para crear el primero; si el
 * filtro tapa todo, un botón para limpiarlo. El mismo texto para los dos no sirve para ninguno.
 *
 * El molde no es nuevo: sale del estado vacío de Clientes (`ClientesClient`), que ya hacía
 * bien este reparto. Acá se promueve para que lo usen todas las pantallas en vez de que cada
 * una lo resuelva a su manera.
 */

export interface ListaVaciaProps {
  /**
   * ¿Hay algún filtro puesto? Lo decide quien conoce los filtros, no este componente: una
   * lista solo ve el resultado ya filtrado y estructuralmente NO puede distinguir "no hay
   * nada" de "el filtro no deja pasar nada".
   */
  filtrado: boolean;

  /** Lista vacía de verdad. */
  tituloVacio: string;
  detalleVacio?: ReactNode;
  /** El botón que arranca la pantalla: "Nueva orden", "Agregar cliente"… */
  accionVacio?: ReactNode;
  icono?: typeof SearchX;

  /** El filtro no deja ver nada. Por defecto dice lo genérico, que casi siempre alcanza. */
  tituloFiltrado?: string;
  detalleFiltrado?: ReactNode;
  onLimpiarFiltros?: () => void;

  /**
   * Para las listas que viven adentro de una tabla: envuelve la tarjeta en un `<tr><td>` que
   * cruza todas las columnas. Sin esto, cada tabla vuelve a escribir su propia fila vacía.
   */
  colSpan?: number;
}

export default function ListaVacia({
  filtrado,
  tituloVacio,
  detalleVacio,
  accionVacio,
  icono,
  tituloFiltrado = "Sin resultados",
  detalleFiltrado = "Ningún registro coincide con los filtros que tenés puestos.",
  onLimpiarFiltros,
  colSpan,
}: ListaVaciaProps) {
  const panel = filtrado ? (
    <EstadoPanel
      variante="vacio"
      icono={SearchX}
      titulo={tituloFiltrado}
      detalle={detalleFiltrado}
      compacto={colSpan !== undefined}
      acciones={
        onLimpiarFiltros && (
          <button type="button" onClick={onLimpiarFiltros} className="btn-secondary text-sm">
            Limpiar filtros
          </button>
        )
      }
    />
  ) : (
    <EstadoPanel
      variante="vacio"
      icono={icono}
      titulo={tituloVacio}
      detalle={detalleVacio}
      compacto={colSpan !== undefined}
      acciones={accionVacio}
    />
  );

  if (colSpan === undefined) return panel;

  return (
    <tr>
      {/* Sin borde ni padding: la tarjeta ya trae los suyos. */}
      <td colSpan={colSpan} className="p-0">
        {panel}
      </td>
    </tr>
  );
}
