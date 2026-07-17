"use client";

// Acciones de la derecha de una fila de actividad: las MISMAS en la bitácora y en la
// agenda (destacar / editar / borrar / reprogramar). Lo propio de cada pantalla entra por
// `children` — hoy solo "Abrir deal", que en la bitácora no tiene sentido porque ya estás
// dentro del deal.
import { useState, type ReactNode } from "react";
import { Star, Pencil, Trash2, CalendarClock } from "lucide-react";
import InputFechaHora from "@/components/ui/InputFechaHora";
import { fechaInput, inputAUtc } from "@/lib/tz";

interface Props {
  destacada: boolean;
  canWrite: boolean;
  /** Las entradas de SISTEMA no se editan ni se borran. */
  editable: boolean;
  /**
   * Fecha del pendiente a reprogramar. null = no se reprograma: o es un registro de algo
   * que ya pasó, o la tarea ya se completó (mover la fecha de algo hecho no significa nada).
   */
  fechaTarea: string | null;
  onDestacar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onReprogramar: (iso: string) => void;
  children?: ReactNode;
}

export default function AccionesActividad({
  destacada, canWrite, editable, fechaTarea, onDestacar, onEditar, onEliminar, onReprogramar, children,
}: Props) {
  // El estado del reprogramar vive acá: antes cada pantalla se lo guardaba por su cuenta.
  const [reprogramando, setReprogramando] = useState(false);
  const [valor, setValor] = useState("");

  function guardar() {
    setReprogramando(false);
    if (!valor) return;
    // Lo tipeado es hora de pared de CDMX, igual que en el compositor y en el server
    // (lib/actividad-input). El reprogramar de la agenda hacía new Date(valor), que
    // interpreta en la zona del NAVEGADOR: desde afuera de CDMX guardaba otro instante
    // del que mostraba.
    const cuando = inputAUtc(valor);
    if (!cuando) return;
    onReprogramar(cuando.toISOString());
  }

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

      {canWrite && fechaTarea && (
        reprogramando ? (
          <span className="flex items-center gap-1.5">
            <InputFechaHora autoFocus value={valor} onChange={setValor} />
            <button
              onClick={guardar}
              disabled={!valor.includes("T") || !valor.split("T")[1]}
              className="rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              Guardar
            </button>
          </span>
        ) : (
          <button
            onClick={() => {
              setValor(fechaInput(fechaTarea));
              setReprogramando(true);
            }}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-orange"
          >
            <CalendarClock size={11} /> Reprogramar
          </button>
        )
      )}
      {children}
    </>
  );
}
