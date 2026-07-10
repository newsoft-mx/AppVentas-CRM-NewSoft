"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";

interface CrmConfig {
  avance_modo: "SUGERIR" | "AUTOMATICO";
  umbral_inactividad_dias: number;
  score_inicial: number;
  decay_por_dia: number;
  sensibilidad_prob: number;
  niveles_umbral: number[]; // [FRIO, TIBIO, CALIENTE, MUY_CALIENTE]
}

// Parámetros globales del termómetro / estado de atención (REQ-06). Admin only.
export default function CrmConfigPanel() {
  const [cfg, setCfg] = useState<CrmConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    fetch("/api/configuracion/crm-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => {});
  }, []);

  async function guardar() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/crm-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      setToast({ type: "success", message: "Parámetros guardados" });
    } catch {
      setToast({ type: "error", message: "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) return null;

  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-gray-50 p-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy">
        <Settings2 size={16} /> Motor de scoring
      </div>
      <p className="mb-3 text-xs text-gray-500">El score (0–100) define color, probabilidad y avance. Ajustá cómo se comporta.</p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Modo de avance</label>
          <select className="input" value={cfg.avance_modo} onChange={(e) => setCfg({ ...cfg, avance_modo: e.target.value as CrmConfig["avance_modo"] })}>
            <option value="SUGERIR">Sugerir (recomendado)</option>
            <option value="AUTOMATICO">Automático</option>
          </select>
        </div>
        <div>
          <label className="label">Score inicial</label>
          <input type="number" min={0} max={100} className="input w-24" value={cfg.score_inicial} onChange={(e) => setCfg({ ...cfg, score_inicial: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Días de gracia</label>
          <input type="number" min={1} className="input w-24" value={cfg.umbral_inactividad_dias} onChange={(e) => setCfg({ ...cfg, umbral_inactividad_dias: Number(e.target.value) })} title="Días sin actividad antes de enfriar" />
        </div>
        <div>
          <label className="label">Enfría por día</label>
          <input type="number" min={0} className="input w-24" value={cfg.decay_por_dia} onChange={(e) => setCfg({ ...cfg, decay_por_dia: Number(e.target.value) })} title="Puntos que pierde por día de inactividad" />
        </div>
        <div>
          <label className="label">Sensib. prob.</label>
          <input type="number" min={0} max={5} step={0.1} className="input w-24" value={cfg.sensibilidad_prob} onChange={(e) => setCfg({ ...cfg, sensibilidad_prob: Number(e.target.value) })} title="Etapas sin umbral: cuánto mueve el score a la probabilidad" />
        </div>
        <div>
          <label className="label">Cortes de nivel (frío→caliente)</label>
          <div className="flex items-center gap-1">
            {cfg.niveles_umbral.map((c, i) => (
              <input key={i} type="number" min={1} max={99} className="input w-14 text-center" value={c}
                onChange={(e) => setCfg({ ...cfg, niveles_umbral: cfg.niveles_umbral.map((x, j) => (j === i ? Number(e.target.value) : x)) })} />
            ))}
          </div>
        </div>
        <button onClick={guardar} disabled={saving} className="btn-primary justify-center">
          {saving ? "Guardando..." : "Guardar parámetros"}
        </button>
      </div>
    </div>
  );
}
