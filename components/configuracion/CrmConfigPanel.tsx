"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";

interface CrmConfig {
  umbral_inactividad_dias: number;
  avance_modo: "SUGERIR" | "AUTOMATICO";
  enfriamiento_nivel: number;
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
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
        <Settings2 size={16} /> Termómetro y atención
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Modo de avance de etapa</label>
          <select
            className="input"
            value={cfg.avance_modo}
            onChange={(e) => setCfg({ ...cfg, avance_modo: e.target.value as CrmConfig["avance_modo"] })}
          >
            <option value="SUGERIR">Sugerir (recomendado)</option>
            <option value="AUTOMATICO">Automático</option>
          </select>
        </div>
        <div>
          <label className="label">Umbral de inactividad (días)</label>
          <input
            type="number"
            min={1}
            className="input w-32"
            value={cfg.umbral_inactividad_dias}
            onChange={(e) => setCfg({ ...cfg, umbral_inactividad_dias: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Niveles que enfría</label>
          <input
            type="number"
            min={0}
            className="input w-28"
            value={cfg.enfriamiento_nivel}
            onChange={(e) => setCfg({ ...cfg, enfriamiento_nivel: Number(e.target.value) })}
          />
        </div>
        <button onClick={guardar} disabled={saving} className="btn-primary justify-center">
          {saving ? "Guardando..." : "Guardar parámetros"}
        </button>
      </div>
    </div>
  );
}
