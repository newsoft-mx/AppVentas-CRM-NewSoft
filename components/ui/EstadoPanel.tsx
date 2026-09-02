import type { ReactNode } from "react";
import { Loader2, XCircle, SearchX, Lock, Inbox } from "lucide-react";

/**
 * La tarjeta que ocupa el lugar del contenido cuando el contenido no está.
 *
 * Cargando, error, vacío y "no te toca" son cuatro estados distintos que la app venía
 * resolviendo cada uno por su lado —o no resolviendo—: ninguna pantalla tenía aviso de carga
 * ni de error, así que al navegar la app se quedaba quieta y, si la base fallaba, Next mostraba
 * su pantalla cruda en inglés, sin el menú, sin forma de volver.
 *
 * A propósito **sin** `"use client"`: la usan tanto `loading.tsx` (componente de server) como
 * `error.tsx` (que sí es de cliente). Un componente sin estado ni handlers funciona en los dos
 * lados; ponerle la directiva lo mandaría al bundle sin necesidad.
 *
 * Los colores no son nuevos: son los que ya usa `Toast` para el error y el mismo spinner del
 * login. Un estado de sistema no es el lugar para estrenar una paleta.
 */

type Variante = "cargando" | "error" | "vacio" | "denegado";

const ICONO: Record<Variante, typeof Loader2> = {
  cargando: Loader2,
  error: XCircle,
  vacio: Inbox,
  denegado: Lock,
};

const TONO: Record<Variante, string> = {
  cargando: "text-gray-400",
  error: "text-red-600",
  vacio: "text-gray-400",
  denegado: "text-gray-400",
};

export interface EstadoPanelProps {
  variante: Variante;
  titulo: string;
  /** Una línea explicando qué pasó o qué hacer. Opcional: a veces el título alcanza. */
  detalle?: ReactNode;
  /** Botones. Van debajo del detalle, separados. */
  acciones?: ReactNode;
  /** Reemplaza el ícono de la variante (p. ej. el ícono propio de una lista vacía). */
  icono?: typeof SearchX;
  /** Para meter la tarjeta dentro de una tabla o un espacio ya acotado. */
  compacto?: boolean;
}

export default function EstadoPanel({
  variante,
  titulo,
  detalle,
  acciones,
  icono,
  compacto = false,
}: EstadoPanelProps) {
  const Icono = icono ?? ICONO[variante];

  // Quien no ve la pantalla también tiene que enterarse: "cargando" se anuncia sin interrumpir,
  // un error interrumpe. El resto son contenido común y no necesitan región viva.
  const rol = variante === "cargando" ? "status" : variante === "error" ? "alert" : undefined;

  return (
    <div
      role={rol}
      aria-live={variante === "cargando" ? "polite" : undefined}
      className={`flex flex-col items-center justify-center rounded-xl border border-surface-border bg-white text-center ${
        compacto ? "p-8" : "p-12"
      }`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        {/* El ícono es decoración: lo que se anuncia es el texto. */}
        <Icono
          size={26}
          className={`${TONO[variante]} ${variante === "cargando" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      </div>

      <p className="text-base font-medium text-gray-700">{titulo}</p>
      {detalle && <div className="mt-1 max-w-md text-sm text-gray-500">{detalle}</div>}
      {acciones && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{acciones}</div>}
    </div>
  );
}
