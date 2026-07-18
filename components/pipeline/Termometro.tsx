"use client";

import { useState } from "react";
import { Thermometer } from "lucide-react";
import { TEMPERATURA_META, type Temperatura } from "@/types/crm";
import Toast, { ToastData } from "@/components/ui/Toast";

const ESCALA: Temperatura[] = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

// Termómetro del deal (REQ-06): barra frío→caliente con override manual.
export default function Termometro({
  dealId,
  temperatura,
  score,
  canWrite,
  onChange,
}: {
  dealId: string;
  temperatura: Temperatura;
  score: number;
  canWrite: boolean;
  onChange?: (t: Temperatura) => void;
}) {
  const [valor, setValor] = useState<Temperatura>(temperatura);
  const [scoreVal, setScoreVal] = useState<number>(score);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  // Re-sincronizar si el padre actualiza (ej. tras registrar actividad). Se ajusta durante
  // el render —patrón de React para "estado derivado de una prop"— en vez de en un efecto,
  // que agregaría un render extra con el valor viejo.
  const [propsPrev, setPropsPrev] = useState({ temperatura, score });
  if (propsPrev.temperatura !== temperatura || propsPrev.score !== score) {
    setPropsPrev({ temperatura, score });
    setValor(temperatura);
    setScoreVal(score);
  }
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
      // El server recalcula el score real (ajuste_manual + fórmula); reflejamos su respuesta.
      const j = await res.json();
      if (typeof j.score === "number") setScoreVal(j.score);
      if (j.temperatura) { setValor(j.temperatura); onChange?.(j.temperatura); }
    } catch {
      setValor(prev);
      onChange?.(prev);
      setToast({ type: "error", message: "No se pudo ajustar la temperatura." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
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
      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-gray-600" title="Score de salud (0-100)">
        {scoreVal}
      </span>
      </div>
    </>
  );
}
