"use client";

// Carcasa de una fila de actividad: la MISMA en la agenda global y en la bitácora.
//
// Las dos pantallas muestran la misma entidad —una actividad— con el mismo objetivo, así
// que se ven igual. Lo único que cambia es el contexto: en la agenda cruzás deals (por eso
// su meta trae deal/monto/vendedor); en la bitácora ya estás dentro de uno (por eso trae
// autor/desenlace). Eso viaja por props; el layout vive acá una sola vez.
import type { ReactNode } from "react";

interface Props {
  /** Check si es tarea; espaciador si es un registro (mantiene la alineación). */
  control: ReactNode;
  /** La nota, o el tipo si no hay nota (ver tituloActividad). */
  titulo: ReactNode;
  meta: ReactNode;
  fecha: ReactNode;
  /** Acciones de la derecha (en la bitácora aparecen al pasar el mouse). */
  acciones?: ReactNode;
  destacada?: boolean;
  resaltada?: boolean;
  /** Si se puede abrir (agenda: va al deal). */
  onAbrir?: () => void;
}

export default function ActividadFila({
  control, titulo, meta, fecha, acciones, destacada = false, resaltada = false, onAbrir,
}: Props) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border bg-white px-4 py-3
                  transition-shadow hover:shadow-sm ${
                    destacada ? "border-amber-300 bg-amber-50/30" : "border-surface-border"
                  } ${resaltada ? "ring-2 ring-orange/40" : ""}`}
    >
      {control}
      <div
        className={`min-w-0 flex-1 ${onAbrir ? "cursor-pointer" : ""}`}
        onClick={onAbrir}
      >
        <div className="text-sm font-semibold leading-snug text-navy">{titulo}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          {meta}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {fecha}
        {acciones}
      </div>
    </div>
  );
}

/** Ocupa el lugar del check en los registros, para que el texto no baile entre filas. */
export function ControlVacio() {
  return <div className="mt-0.5 h-[18px] w-[18px] shrink-0" />;
}

/**
 * Nombre del tipo de movimiento: punto de color + nombre, una sola vez por fila.
 * Antes convivían el ícono del tipo y su nombre en la misma fila — el tipo dicho dos
 * veces. Si la fila no tiene nota, el título YA es el tipo y esto no se muestra.
 */
export function TipoMovimiento({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-semibold" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {nombre}
    </span>
  );
}
