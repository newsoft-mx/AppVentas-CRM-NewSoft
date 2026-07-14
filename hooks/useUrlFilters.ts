"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Filtros persistentes en la URL (pilar 3 — un solo mecanismo para todas las
 * superficies de listado). El estado inicial lo hidrata el server component desde
 * `searchParams`; este hook mantiene `[filtros, setFiltros]` y espeja cada cambio a
 * la query (`?…`) con `router.replace(..., { scroll: false })` dentro de una
 * transición. Así el estado (filtros + orden) sobrevive a salir y volver a la
 * pantalla, a recargar y a compartir el link.
 *
 * `serialize` convierte los filtros a query string (sin el `?`). Debe ser PURA
 * (depende solo de `filtros`); por eso no va en las deps del effect.
 *
 * Devuelve `[filtros, setFiltros, pending]`. `pending` es el estado de la transición
 * de navegación (para atenuar la vista mientras se aplica); los llamadores que no lo
 * necesiten simplemente lo ignoran.
 */
export function useUrlFilters<T>(
  initial: T,
  serialize: (filtros: T) => string
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [filtros, setFiltros] = useState<T>(initial);

  useEffect(() => {
    const qs = serialize(filtros);
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
    // serialize es pura sobre `filtros`; solo re-sincronizamos cuando cambian los filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  return [filtros, setFiltros, pending];
}
