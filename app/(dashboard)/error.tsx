"use client";

import { useEffect } from "react";
import Link from "next/link";
import EstadoPanel from "@/components/ui/EstadoPanel";

/**
 * Qué ve el usuario cuando una pantalla del dashboard revienta.
 *
 * Antes: la pantalla de error cruda de Next, en inglés, fuera del layout —sin menú y sin
 * forma de volver—. En producción ni siquiera dice qué pasó. Ahora: una tarjeta en español,
 * dentro del layout, con el menú al costado para poder irse a otro lado.
 */
export default function ErrorDashboard({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Para que quede en la consola del navegador y en los logs del cliente. En producción
    // React redacta el mensaje, pero el `digest` sí viaja y permite cruzarlo con el server.
    console.error("Error en el dashboard:", error);
  }, [error]);

  return (
    <EstadoPanel
      variante="error"
      titulo="No pudimos cargar esta pantalla"
      detalle={
        <>
          Fue un problema de nuestro lado, no algo que hayas hecho mal. Podés reintentar; si
          sigue pasando, avisale a soporte.
          {/*
            Se muestra `digest`, NO `error.message`: en producción React reemplaza el mensaje
            real por uno genérico, así que mostrarlo no informa a nadie — y si algún día no lo
            reemplazara, filtraría detalles internos. El digest es el número que sí sirve para
            encontrar el error en los logs del servidor.
          */}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs text-gray-500">
              Código: {error.digest}
            </span>
          )}
        </>
      }
      acciones={
        <>
          {/*
            `unstable_retry` y no `reset`: `reset` solo limpia el estado del boundary y vuelve
            a renderizar el MISMO payload de server que ya falló, así que el botón no haría
            nada visible. `unstable_retry` pide el árbol de server de nuevo antes de resetear
            (next/dist/client/components/error-boundary.js), que es lo que "Reintentar"
            promete.
          */}
          <button type="button" onClick={unstable_retry} className="btn-primary text-sm">
            Reintentar
          </button>
          <Link href="/ventas" className="btn-secondary text-sm">
            Ir a Órdenes
          </Link>
        </>
      }
    />
  );
}
