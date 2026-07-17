"use client";

// Control de "marcar Listo": el MISMO en la bitácora del deal y en la agenda global.
//
// Antes cada pantalla tenía el suyo (un checkbox acá, una pastilla "PENDIENTE" allá) y la
// pastilla no se leía como algo clickeable: parecía una etiqueta de estado. Un solo gesto
// para una sola acción (SOL-21/23: los estados son dos, Pendiente y Listo).
import { Check } from "lucide-react";

interface Props {
  completada: boolean;
  onToggle: () => void;
  /** Si no se puede alternar, se muestra igual pero apagado (solo lectura). */
  disabled?: boolean;
}

export default function CheckTarea({ completada, onToggle, disabled = false }: Props) {
  const etiqueta = completada ? "Marcar como Pendiente" : "Marcar como Listo";
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={completada}
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full
                  border transition-colors ${
                    completada
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : `border-gray-300 text-transparent ${
                          disabled
                            ? ""
                            : "hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500"
                        }`
                  } ${disabled ? "cursor-default opacity-60" : ""}`}
    >
      <Check size={11} strokeWidth={3.5} />
    </button>
  );
}
