"use client";

// El "cuándo" de una actividad, y —si es un pendiente— el gesto para reagendarlo.
//
// La fecha ES el control: clic en la fecha para reagendar. Antes había un botón
// "Reprogramar" aparte diciendo lo mismo que la fecha que tenía al lado.
import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { formatCuando } from "@/lib/utils";
import { fechaInput, inputAUtc } from "@/lib/tz";

interface Props {
  /** El instante a mostrar: vencimiento si es tarea, cuándo ocurrió si es registro. */
  cuando: string;
  /** ¿La hora la eligió el usuario? Si no, se muestra solo la fecha (SOL-22). */
  horaDefinida: boolean;
  esTarea: boolean;
  completada: boolean;
  vencida: boolean;
  editada: boolean;
  /** Cuándo se registró (va al tooltip: lo que importa de una tarea es cuándo vence). */
  createdAt: string;
  /** null = no se reagenda (registro, o tarea ya completada: mover algo hecho no dice nada). */
  onReagendar: ((iso: string, horaDefinida: boolean) => void) | null;
}

export default function FechaActividad({
  cuando, horaDefinida, esTarea, completada, vencida, editada, createdAt, onReagendar,
}: Props) {
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  function abrir() {
    const local = fechaInput(cuando); // "YYYY-MM-DDTHH:mm" en hora de pared CDMX
    setFecha(local.slice(0, 10));
    // Solo precargar la hora si la habían elegido: si no, se reagenda sin hora salvo que
    // la agreguen ahora.
    setHora(horaDefinida ? local.slice(11, 16) : "");
    setEditandoFecha(true);
  }

  function guardar() {
    if (!fecha) return;
    const conHora = /^\d{2}:\d{2}$/.test(hora);
    // Lo tipeado es hora de pared CDMX (igual que el compositor y el server). Sin hora, el
    // instante es el fin del día: así "vencida" y el agrupamiento por día salen solos.
    const instante = inputAUtc(`${fecha}T${conHora ? hora : "23:59"}`);
    if (!instante) return;
    setEditandoFecha(false);
    onReagendar?.(instante.toISOString(), conHora);
  }

  if (editandoFecha) {
    return (
      <span className="flex items-center gap-1.5">
        <input
          type="date"
          autoFocus
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded border border-surface-border px-2 py-1 text-[11px] text-navy
                     outline-none focus:border-orange"
        />
        <span className="flex items-center gap-0.5">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="rounded border border-surface-border px-1.5 py-1 text-[11px] text-navy
                       outline-none focus:border-orange"
          />
          {/* Quitar la hora: reagendar para el día, sin horario. Ponerla no puede ser
              irreversible. */}
          {hora && (
            <button
              onClick={() => setHora("")}
              title="Quitar la hora (dejar solo la fecha)"
              className="text-gray-300 hover:text-red-500"
            >
              <X size={11} />
            </button>
          )}
        </span>
        <button
          onClick={guardar}
          disabled={!fecha}
          className="rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          onClick={() => setEditandoFecha(false)}
          title="Cancelar"
          className="text-gray-400 hover:text-navy"
        >
          <X size={13} />
        </button>
      </span>
    );
  }

  const clases = completada
    ? "text-gray-400 line-through"
    : esTarea
      ? vencida
        ? "font-semibold text-red-600"
        : "font-medium text-blue-700"
      : "text-gray-400";
  const contenido = (
    <>
      {editada && <span className="mr-0.5 italic text-gray-300">editado ·</span>}
      {esTarea && <CalendarClock size={12} />}
      {formatCuando(cuando, horaDefinida)}
    </>
  );

  if (!onReagendar) {
    return (
      <span
        className={`flex shrink-0 items-center gap-1 text-[11px] ${clases}`}
        title={`Registrado el ${formatCuando(createdAt, true)}`}
      >
        {contenido}
      </span>
    );
  }

  return (
    <button
      onClick={abrir}
      title="Clic para reagendar"
      className={`flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11px]
                  hover:bg-surface hover:underline ${clases}`}
    >
      {contenido}
    </button>
  );
}
