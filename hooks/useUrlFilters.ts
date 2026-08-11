"use client";

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cookieDeMemoria, type ContratoFiltros } from "@/lib/filtros-memoria";

/**
 * Filtros persistentes (pilar 3 — un solo mecanismo para todas las superficies de listado).
 *
 * Dos capas, con el MISMO códec:
 *  1. **URL** — para compartir el link y sobrevivir a un F5. Se espeja con
 *     `router.replace(..., { scroll: false })` dentro de una transición.
 *  2. **Cookie** — para sobrevivir a salir de la pantalla y volver por el menú lateral, que
 *     navega a la ruta pelada. Es la capa que faltaba: sin ella, "cada vez que vuelves y
 *     sales se resetean los filtros".
 *
 * El estado inicial lo hidrata el server component (`filtrosIniciales`), que es quien resuelve
 * la precedencia URL > cookie > default. **Este hook nunca lee la cookie**: solo la escribe.
 * Por eso no hay mismatch de hidratación posible.
 *
 * `contrato.serialize` debe ser PURA sobre `filtros`; por eso no va en las deps del effect.
 *
 * Devuelve `[filtros, setFiltros, pending]`. `pending` es el estado de la transición de
 * navegación (para atenuar la vista mientras se aplica).
 */
export function useUrlFilters<T>(
  initial: T,
  contrato: Pick<ContratoFiltros<T>, "pantalla" | "serialize" | "serializeMemoria">
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [filtros, setFiltros] = useState<T>(initial);

  useEffect(() => {
    const qs = contrato.serialize(filtros);

    // Memoria. Con `qs` vacío, cookieDeMemoria devuelve un borrado — así "limpié los filtros"
    // no necesita ninguna bandera: el default no se recuerda. Si las cookies están
    // deshabilitadas esto falla en silencio y todo degrada al comportamiento anterior.
    if (contrato.serializeMemoria && typeof document !== "undefined") {
      document.cookie = cookieDeMemoria(contrato.pantalla, contrato.serializeMemoria(filtros));
    }

    // Si la URL ya dice lo mismo, no navegar. Estas páginas son `force-dynamic`, así que un
    // replace de más es un render completo de server al pedo: antes ocurría en CADA montaje,
    // incluso entrando por un link que ya traía los filtros.
    if (typeof window !== "undefined" && qs === window.location.search.replace(/^\?/, "")) return;

    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  return [filtros, setFiltros, pending];
}
