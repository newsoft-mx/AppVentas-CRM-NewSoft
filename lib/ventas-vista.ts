/**
 * Cómo se mira la lista de Órdenes: agrupada por cliente o como una lista plana.
 *
 * Roldán pidió poder desagrupar. El modo NO es estado local del componente: es lo que uno espera
 * poder compartir —"mandame el link del ranking"— así que viaja en la URL, y como vive dentro
 * del objeto de filtros, la cookie de memoria ya lo recuerda sin que haya que coordinar nada.
 *
 * El default es `agrupado`, que es lo que la pantalla hace hoy: nadie ve un cambio al entrar.
 */
export const MODOS_VISTA = ["agrupado", "lista"] as const;
export type ModoVista = (typeof MODOS_VISTA)[number];

export const MODO_VISTA_DEFAULT: ModoVista = "agrupado";

/** Vuelve al default ante cualquier basura de la URL, en vez de romper la pantalla. */
export function parseModoVista(valor: string | undefined): ModoVista {
  return MODOS_VISTA.includes(valor as ModoVista) ? (valor as ModoVista) : MODO_VISTA_DEFAULT;
}

/** El default no se serializa: deja la URL limpia, igual que los filtros vacíos. */
export function serializeModoVista(modo: ModoVista): string {
  return modo === MODO_VISTA_DEFAULT ? "" : modo;
}
