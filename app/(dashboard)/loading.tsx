import EstadoPanel from "@/components/ui/EstadoPanel";

/**
 * Aviso de carga para TODAS las pantallas del dashboard, por anidamiento.
 *
 * Vive en el grupo y no en cada ruta a propósito: son 17 pantallas y no hay 17 esperas
 * distintas. Como el layout del grupo solo verifica el JWT (no toca Prisma), el menú queda
 * en pie mientras el contenido carga — la navegación no parpadea entera.
 *
 * Además de avisar, esto es lo que le da a Next un punto de corte para hacer streaming: sin
 * `loading.tsx`, una ruta dinámica no muestra NADA hasta que el server termina, y por eso la
 * app parecía congelarse al cambiar de pantalla.
 */
export default function CargandoDashboard() {
  return <EstadoPanel variante="cargando" titulo="Cargando…" />;
}
