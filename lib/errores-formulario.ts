/**
 * Reparto de los errores de validación del server entre los campos de un formulario.
 *
 * Las rutas responden 422 con `{ error, details: [{ campo, mensaje }] }`, donde `campo` es el
 * path de zod: `"rfc"`, `"partidas.0.precio_unitario"`, o `""` cuando la queja es de un refine
 * global. Los formularios venían usando ese `campo` como clave de su estado de errores sin
 * preguntarse si alguien lo dibujaba en pantalla. Cuando el server se quejaba de un campo que
 * el formulario no pinta —`telefono` en clientes, una partida en órdenes— el mensaje quedaba
 * guardado en una clave que ningún `<p>` lee: el modal no se cerraba, no aparecía nada rojo, y
 * el usuario veía que apretar "Guardar" simplemente no hacía nada.
 *
 * Acá quien decide dónde va cada mensaje es `ubicar`, y lo que no tiene dónde mostrarse cae al
 * banner general. La regla que sostiene esto: un mensaje del server siempre termina en pantalla.
 *
 * @param details  El `details` crudo de la respuesta (puede ser cualquier cosa).
 * @param ubicar   Devuelve la clave del formulario donde mostrar ese campo, o `null` si no hay.
 * @returns        El mapa de errores, o `null` si no hubo nada utilizable — ahí el que llama
 *                 cae a `data.error`, que es el mensaje genérico de la respuesta.
 */
export function repartirDetalles(
  details: unknown,
  ubicar: (campo: string) => string | null
): Record<string, string> | null {
  if (!Array.isArray(details)) return null;

  const errores: Record<string, string> = {};
  // Zod puede emitir más de una queja por el mismo campo; se acumulan en vez de pisarse.
  const agregar = (clave: string, texto: string) => {
    errores[clave] = errores[clave] ? `${errores[clave]}. ${texto}` : texto;
  };

  for (const item of details) {
    if (!item || typeof item !== "object") continue;
    const { campo, mensaje } = item as { campo?: unknown; mensaje?: unknown };
    const texto = typeof mensaje === "string" ? mensaje.trim() : "";
    if (!texto) continue;

    const clave = typeof campo === "string" ? campo.trim() : "";
    const destino = clave ? ubicar(clave) : null;
    if (destino) agregar(destino, texto);
    // Sin lugar propio: al banner. Se conserva el nombre del campo como pista — un mensaje
    // suelto ("Debe ser mayor a 0") sin decir de qué, no ayuda a arreglarlo.
    else agregar("general", clave ? `${clave}: ${texto}` : texto);
  }

  return Object.keys(errores).length > 0 ? errores : null;
}

/**
 * El texto más específico que trae una respuesta de error, para pantallas SIN campos donde
 * mostrarlo — una pastilla de estatus, un toast, una fila de configuración.
 *
 * Prioriza `details` sobre `error` porque el genérico ("Datos inválidos") no le dice a nadie
 * qué corregir, mientras que el detalle sí ("Formato de fecha inválido"). Esta lógica estaba
 * copiada en cinco componentes; acá vive una sola vez.
 */
export function mensajeDeError(data: unknown, porDefecto: string): string {
  const cuerpo = (data ?? {}) as { details?: unknown; error?: unknown };

  if (Array.isArray(cuerpo.details)) {
    const textos = cuerpo.details
      .map((d) => (d && typeof d === "object" ? (d as { mensaje?: unknown }).mensaje : null))
      .filter((m): m is string => typeof m === "string" && m.trim() !== "")
      .map((m) => m.trim());
    if (textos.length > 0) return textos.join(". ");
  }

  return typeof cuerpo.error === "string" && cuerpo.error.trim() !== ""
    ? cuerpo.error
    : porDefecto;
}
