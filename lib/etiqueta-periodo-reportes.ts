/**
 * Qué período está mirando la pantalla de Reportes, en palabras.
 *
 * El problema que resuelve es el que llevó a la usuaria a llevar sus indicadores a mano:
 * la pantalla muestra cifras sin decir de cuándo son. Peor todavía, ahí conviven DOS ventanas
 * de tiempo distintas —el número grande sale de un endpoint y las tarjetas de otro— y ninguna
 * está rotulada, así que cuando no coinciden no hay forma de saber cuál creer.
 *
 * La etiqueta se DERIVA del mismo objeto de filtros que se serializa al fetch. Es a propósito:
 * si se calculara aparte, podría decir "julio" mientras los datos son de agosto, que es peor
 * que no decir nada. El precedente es `etiquetaRango` (lib/rangos-reporte), que ya hace esto
 * bien en el reporte de embudo — la única pantalla de la app que hoy declara su período.
 */
import type { FiltroReportes } from "@/types/reportes";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Une una lista en lenguaje natural: [a] → "a"; [a,b] → "a y b"; [a,b,c] → "a, b y c". */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Alcance de la cifra, porque en esta pantalla no todas miran lo mismo:
 *  - "ventas": lo que responde a los filtros de año/trimestre/mes.
 *  - "historico": las cifras que NO se filtran por período y suman todo el histórico.
 * Rotular las dos con la misma etiqueta sería mentir sobre una de ellas.
 */
export type AlcanceCifra = "ventas" | "historico";

export function etiquetaPeriodo(f: FiltroReportes, alcance: AlcanceCifra = "ventas"): string {
  if (alcance === "historico") return "Histórico completo";

  const anos = [...(f.ano ?? [])].sort((a, b) => a - b);
  const meses = [...(f.mes ?? [])].sort((a, b) => a - b);
  const trimestres = [...(f.q ?? [])].sort((a, b) => a - b);

  const etiquetaAnos = anos.length ? enumerar(anos.map(String)) : "todos los años";

  if (meses.length) {
    return `${enumerar(meses.map((m) => MESES[m - 1] ?? String(m)))} · ${etiquetaAnos}`;
  }
  if (trimestres.length) {
    return `${enumerar(trimestres.map((q) => `Q${q}`))} · ${etiquetaAnos}`;
  }
  if (anos.length) return etiquetaAnos;
  return "Todos los años";
}
