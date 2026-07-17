"use client";

// Acciones de la derecha de una fila de actividad: las MISMAS en la bitácora y en la
// agenda (destacar / editar / borrar). Lo propio de cada pantalla entra por `children` —
// hoy solo "Abrir deal", que en la bitácora no tiene sentido porque ya estás dentro.
//
// Reagendar no está acá: el gesto es clic en la fecha (ver FechaActividad). El botón
// "Reprogramar" decía lo mismo que la fecha que tenía al lado.
import type { ReactNode } from "react";
import { Star, Pencil, Trash2 } from "lucide-react";

interface Props {
  destacada: boolean;
  canWrite: boolean;
  /** Las entradas de SISTEMA no se editan ni se borran. */
  editable: boolean;
  onDestacar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  children?: ReactNode;
}

export default function AccionesActividad({
  destacada, canWrite, editable, onDestacar, onEliminar, onEditar, children,
}: Props) {
  return (
    <>
      {/* Destacar / editar / borrar: aparecen al pasar el mouse o al enfocar con teclado.
          Encendidas en cada fila eran ruido permanente. La estrella se queda si está
          destacada: ahí sí dice algo. */}
      {canWrite && (
        <span
          className={`flex items-center gap-1.5 transition-opacity focus-within:opacity-100
                      group-hover:opacity-100 ${destacada ? "" : "opacity-0"}`}
        >
          <button
            onClick={onDestacar}
            title={destacada ? "Quitar destacado" : "Destacar"}
            className="text-gray-300 hover:text-amber-500"
          >
            <Star
              size={13}
              fill={destacada ? "#F5A623" : "none"}
              color={destacada ? "#F5A623" : "currentColor"}
            />
          </button>
          {editable && (
            <>
              <button onClick={onEditar} title="Editar" className="text-gray-300 hover:text-navy">
                <Pencil size={12} />
              </button>
              <button onClick={onEliminar} title="Eliminar" className="text-gray-300 hover:text-red-500">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </span>
      )}

      {children}
    </>
  );
}
