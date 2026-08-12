/**
 * Estilo de los encabezados de las tablas de Configuración.
 *
 * Las cinco pestañas comparten un encabezado más denso y en versalitas que el del resto de la
 * app (Órdenes y Contactos usan el default de `ThOrdenable`). Ese string estaba escrito literal
 * en los ~18 `<th>` de la sección: acá vive una sola vez, así el día que se ajuste el look no
 * queda una pestaña desparejada.
 *
 * El ancho y la alineación NO van acá: son de cada columna. En un `<th>` común se agregan al
 * `className`; en un `ThOrdenable`, la alineación va por su prop `align`.
 */
export const TH_CONFIG =
  "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500";
