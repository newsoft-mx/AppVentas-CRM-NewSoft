"use client";

import type { ReactNode } from "react";
import { siguienteOrden, type PropsOrden } from "@/lib/tabla-orden";

/**
 * Encabezado de columna ordenable. La única pintura del cimiento: qué se ofrece y cómo se
 * compara lo decide lib/tabla-orden (puro y testeable), acá solo se dibuja.
 *
 * Accesibilidad — el repo no tenía NI UN `aria-sort`:
 *  · `aria-sort` va en el `<th>`, no en el botón (así lo ubica la spec de ARIA).
 *  · El glifo ↑/↓/↕ es decorativo (`aria-hidden`): un lector de pantalla lo anunciaría como
 *    un carácter suelto y lo metería dentro del nombre del botón.
 *  · El estado ya lo dice `aria-sort`, así que el texto oculto anuncia la ACCIÓN SIGUIENTE.
 *    Sin eso, el ciclo de tres estados es invisible para quien no ve el glifo.
 *
 * El "↕" en las columnas inactivas es deliberado: hace visible que la tabla se puede ordenar
 * sin tener que descubrirlo por prueba y error.
 */
export default function ThOrdenable<K extends string>({
  campo,
  orden,
  onOrdenar,
  children,
  align = "left",
  className = "",
}: PropsOrden<K> & {
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const activo = orden.campo === campo;
  const ariaSort = activo ? (orden.sentido === "asc" ? "ascending" : "descending") : "none";
  const proxima = siguienteOrden(orden, campo);
  const accion = proxima.campo === null
    ? "quitar el orden"
    : proxima.sentido === "asc"
      ? "ordenar ascendente"
      : "ordenar descendente";

  const alineacion = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  // El espaciado del encabezado es de la TABLA, no del cimiento: si quien lo usa pasa su propio
  // `className`, se queda con el control completo y estas clases ni se emiten. Concatenarlas
  // siempre dejaba a `px-3` peleando contra un `px-4` del caller, y quién gana lo decide el
  // orden del CSS generado, no el del atributo — o sea, funciona hasta que alguien actualice
  // Tailwind. Sin className, el default sigue siendo el de Órdenes y Contactos.
  const espaciado = className ? "" : "px-3 py-2.5 font-medium";

  return (
    <th scope="col" aria-sort={ariaSort} className={`${alineacion} ${espaciado} ${className}`}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors
                    hover:bg-navy/5 hover:text-navy focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-orange ${activo ? "text-navy" : ""}`}
      >
        {children}
        <span aria-hidden="true" className="text-[10px]">
          {activo ? (orden.sentido === "asc" ? "↑" : "↓") : "↕"}
        </span>
        <span className="sr-only">— activar para {accion}</span>
      </button>
    </th>
  );
}
