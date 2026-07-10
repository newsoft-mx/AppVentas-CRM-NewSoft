// SSOT de las reglas de la bitácora/actividad.
// El contenido de una nota/actividad se guarda en Markdown y se renderiza
// sanitizado (ver components/ui/Markdown.tsx). El límite vive acá una sola vez:
// lo consumen el POST y el PATCH del endpoint y el editor del front.
export const MAX_CONTENIDO = 20_000;

export const MSG_CONTENIDO_LARGO =
  `El contenido es demasiado largo (máx. ${MAX_CONTENIDO.toLocaleString("es-MX")} caracteres)`;
