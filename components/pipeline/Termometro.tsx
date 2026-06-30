"use client";

import { useEffect, useState } from "react";
import { Thermometer } from "lucide-react";
import { TEMPERATURA_META, type Temperatura } from "@/types/crm";

const ESCALA: Temperatura[] = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

// Termómetro del deal (REQ-06): barra frío→caliente con override manual.
export default function Termometro({
  dealId,
  temperatura,
  canWrite,
  onChange,
}: {
  dealId: string;
  temperatura: Temperatura;
  canWrite: boolean;
  onChange?: (t: Temperatura) => void;
}) {
  const [valor, setValor] = useState<Temperatura>(temperatura);
  const [guardando, setGuardando] = useState(false);
  // Re-sincronizar si el padre actualiza la temperatura (ej. tras registrar actividad exitosa)
  useEffect(() => setValor(temperatura), [temperatura]);
  const meta = TEMPERATURA_META[valor];
  const nivel = ESCALA.indexOf(valor);

  async function setTemp(t: Temperatura) {
    if (!canWrite || t === valor || guardando) return;
    const prev = valor;
    setValor(t);
    onChange?.(t);
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/deals/${dealId}/temperatura`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperatura: t }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setValor(prev);
      onChange?.(prev);
      alert("No se pudo ajustar la temperatura.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Thermometer size={16} style={{ color: meta.color }} />
      <div className="flex items-center gap-1">
        {ESCALA.map((t, i) => {
          const tm = TEMPERATURA_META[t];
          const activo = i <= nivel;
          return (
            <button
              key={t}
              onClick={() => setTemp(t)}
              disabled={!canWrite}
              title={canWrite ? `Ajustar a ${tm.label}` : tm.label}
              className={`h-2.5 w-6 rounded-full transition-all ${canWrite ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              style={{ background: activo ? meta.color : "#E5E7EB" }}
            />
          );
        })}
      </div>
      <span className="text-xs font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}
