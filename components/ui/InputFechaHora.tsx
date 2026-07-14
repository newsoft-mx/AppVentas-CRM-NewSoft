"use client";

import { useMemo } from "react";

/**
 * Input de fecha/hora compartido (SSOT del comportamiento de datetime en la app).
 * Fecha (calendario nativo) + hora en un desplegable con slots de 30 min. Se usa un
 * <select> en vez del minutero nativo de datetime-local porque Chrome ignora `step`
 * en su picker y muestra minuto a minuto — el select garantiza 30 min en cualquier
 * navegador. Valor combinado "YYYY-MM-DDTHH:mm" (compatible con lo que ya se guardaba).
 */
const BASE =
  "rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange";

// 48 slots de 30 min: "00:00" … "23:30".
const HORAS_30 = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 === 0 ? "00" : "30"}`;
});

interface Props {
  value: string; // "YYYY-MM-DDTHH:mm" o ""
  onChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
}

export default function InputFechaHora({ value, onChange, className = "", autoFocus }: Props) {
  const [fecha, hora] = value ? value.split("T") : ["", ""];
  // Si la hora guardada no cae en un slot de 30 (dato viejo), se incluye para no perderla.
  const opciones = useMemo(
    () => (hora && !HORAS_30.includes(hora) ? [hora, ...HORAS_30] : HORAS_30),
    [hora]
  );

  const emitir = (f: string, h: string) => onChange(f || h ? `${f}T${h}` : "");

  return (
    <div className={`flex gap-2 ${className}`.trim()}>
      <input
        type="date"
        autoFocus={autoFocus}
        value={fecha}
        onChange={(e) => emitir(e.target.value, hora)}
        className={`${BASE} min-w-0 flex-1`}
      />
      <select
        value={hora}
        onChange={(e) => emitir(fecha, e.target.value)}
        className={BASE}
        aria-label="Hora"
      >
        <option value="">--:--</option>
        {opciones.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
