/**
 * Fuente única de colores categóricos y de estatus (SOL-07, fundamento #5).
 * Nadie repinta por su cuenta: gráficas, tarjetas, leyendas y badges toman el
 * color de acá para que el mismo tipo/estatus se vea igual en toda la app.
 *
 * Nota: los colores por tipo de cotización todavía no son configurables por
 * fila de catálogo (TipoCotizacion no tiene campo `color`). Cuando se agregue,
 * `colorCategoria` pasa a leer ese color y el resto de la app no cambia.
 */

// Paleta categórica estable (naranja de marca primero, luego navy y acentos).
export const PALETA_CATEGORICA = [
  "#E8751A", // naranja marca
  "#1B2A4A", // navy
  "#22C55E", // verde
  "#3B82F6", // azul
  "#F59E0B", // ámbar
  "#64748B", // gris
  "#A855F7", // violeta
  "#14B8A6", // teal
] as const;

// Color categórico por posición en una lista ordenada (misma data → mismo color
// en la torta y su leyenda). Estable mientras el orden de la data no cambie.
export function colorCategoria(index: number): string {
  return PALETA_CATEGORICA[index % PALETA_CATEGORICA.length];
}
