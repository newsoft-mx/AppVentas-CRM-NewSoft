import type { ComponentPropsWithoutRef } from "react";

/**
 * Input de fecha/hora compartido (SSOT del comportamiento de datetime en la app).
 * - Incrementos de 30 min (step=1800s) en el selector nativo.
 * - Estilo base consistente; se extiende con className.
 * Acepta todas las props nativas de <input> (controlado con value/onChange, o
 * no-controlado con defaultValue/onBlur), para servir a cualquier caso. Cualquier
 * ajuste futuro de fecha/hora (formato, TZ, min/max) vive acá, en un solo lugar.
 */
const BASE =
  "rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange";

// Paso de 30 minutos (en segundos) para el picker nativo.
const STEP_30_MIN = 1800;

type Props = Omit<ComponentPropsWithoutRef<"input">, "type" | "step">;

export default function InputFechaHora({ className = "", ...rest }: Props) {
  return <input type="datetime-local" step={STEP_30_MIN} className={`${BASE} ${className}`.trim()} {...rest} />;
}
