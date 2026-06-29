"use client";

import { useState, useCallback } from "react";
import { Pencil, Plus, ChevronUp, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import CrmConfigPanel from "@/components/configuracion/CrmConfigPanel";
import type { PipelineStageConfig } from "@/types/configuracion";

interface FormState {
  nombre: string;
  color: string;
  orden: number;
  probabilidad_base: number;
  umbral_avance: string; // "" = sin umbral
  activo: boolean;
}

const emptyForm: FormState = {
  nombre: "",
  color: "#9BA5BE",
  orden: 0,
  probabilidad_base: 0,
  umbral_avance: "",
  activo: true,
};

const TEMP_OPCIONES: { value: string; label: string }[] = [
  { value: "", label: "Sin avance automático" },
  { value: "TIBIO", label: "Tibio" },
  { value: "CALIENTE", label: "Caliente" },
  { value: "MUY_CALIENTE", label: "Muy caliente" },
];

export default function TabPipelineStages({ initialStages }: { initialStages: PipelineStageConfig[] }) {
  const [stages, setStages] = useState<PipelineStageConfig[]>(initialStages);
  const [editing, setEditing] = useState<PipelineStageConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const ordered = [...stages].sort((a, b) =>
    a.activo === b.activo ? a.orden - b.orden : a.activo ? -1 : 1
  );
  const activos = ordered.filter((s) => s.activo);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, orden: (activos.at(-1)?.orden ?? 0) + 1 });
    setFormError("");
    setIsModalOpen(true);
  };
  const openEdit = (s: PipelineStageConfig) => {
    setEditing(s);
    setForm({
      nombre: s.nombre,
      color: s.color,
      orden: s.orden,
      probabilidad_base: s.probabilidad_base,
      umbral_avance: s.umbral_avance ?? "",
      activo: s.activo,
    });
    setFormError("");
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); setFormError(""); };

  async function save(body: Record<string, unknown>, target?: PipelineStageConfig): Promise<PipelineStageConfig> {
    const res = await fetch(
      target ? `/api/configuracion/pipeline-stages/${target.id}` : "/api/configuracion/pipeline-stages",
      { method: target ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Error al guardar");
    return data as PipelineStageConfig;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError("El nombre es requerido"); return; }
    setIsSaving(true); setFormError("");
    try {
      const payload = {
        nombre: form.nombre.trim(),
        color: form.color,
        orden: form.orden,
        probabilidad_base: form.probabilidad_base,
        umbral_avance: form.umbral_avance || null,
        ...(editing && { activo: form.activo }),
      };
      const saved = await save(payload, editing ?? undefined);
      setStages((prev) => editing ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]);
      setToast({ type: "success", message: editing ? "Etapa actualizada" : "Etapa creada" });
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error de conexión");
    } finally { setIsSaving(false); }
  }

  async function toggle(s: PipelineStageConfig) {
    try {
      const saved = await save({ activo: !s.activo }, s);
      setStages((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setToast({ type: "success", message: saved.activo ? `"${saved.nombre}" activada` : `"${saved.nombre}" desactivada` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Error" });
    }
  }

  // Reordenar: intercambia el `orden` con la etapa activa vecina
  async function mover(s: PipelineStageConfig, dir: -1 | 1) {
    const idx = activos.findIndex((x) => x.id === s.id);
    const vecino = activos[idx + dir];
    if (!vecino) return;
    try {
      const [a, b] = await Promise.all([
        save({ orden: vecino.orden }, s),
        save({ orden: s.orden }, vecino),
      ]);
      setStages((prev) => prev.map((x) => (x.id === a.id ? a : x.id === b.id ? b : x)));
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Error al reordenar" });
    }
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      <CrmConfigPanel />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Define las etapas del pipeline CRM y su orden. Los deals se mueven entre estas columnas.
        </p>
        <button type="button" onClick={openCreate} className="btn-primary w-full justify-center sm:w-auto">
          <Plus size={16} /> Agregar etapa
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-gray-50">
              <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Orden</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Etapa</th>
              <th className="w-20 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Prob.</th>
              <th className="w-32 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Umbral avance</th>
              <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
              <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {ordered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No hay etapas</td></tr>
            )}
            {ordered.map((s) => {
              const activeIdx = activos.findIndex((x) => x.id === s.id);
              return (
                <tr key={s.id} className={!s.activo ? "bg-gray-50/60 opacity-70" : ""}>
                  <td className="px-4 py-3">
                    {s.activo && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => mover(s, -1)} disabled={activeIdx === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-navy disabled:opacity-30" title="Subir">
                          <ChevronUp size={15} />
                        </button>
                        <button onClick={() => mover(s, 1)} disabled={activeIdx === activos.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-navy disabled:opacity-30" title="Bajar">
                          <ChevronDown size={15} />
                        </button>
                        <span className="ml-1 text-xs text-gray-400">{s.orden}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-navy">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.color }} />
                      {s.nombre}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-navy">{s.probabilidad_base}%</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {TEMP_OPCIONES.find((o) => o.value === (s.umbral_avance ?? ""))?.label ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy" title="Editar"><Pencil size={15} /></button>
                      <button onClick={() => toggle(s)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">{s.activo ? "Desactivar" : "Activar"}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={editing ? "Editar etapa" : "Nueva etapa"} onClose={closeModal} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Negociación" />
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className="label">Color</label>
                <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-10 w-16 cursor-pointer rounded border border-surface-border" />
              </div>
              <div className="flex-1">
                <label className="label">Orden</label>
                <input type="number" className="input" value={form.orden} onChange={(e) => setForm((p) => ({ ...p, orden: Number(e.target.value) }))} />
              </div>
              <div className="flex-1">
                <label className="label">Probabilidad base (%)</label>
                <input type="number" min={0} max={100} className="input" value={form.probabilidad_base} onChange={(e) => setForm((p) => ({ ...p, probabilidad_base: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="label">Umbral de avance (termómetro)</label>
              <select className="input" value={form.umbral_avance} onChange={(e) => setForm((p) => ({ ...p, umbral_avance: e.target.value }))}>
                {TEMP_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">Al alcanzar esta temperatura, el deal sugiere (o avanza) a la siguiente etapa.</p>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
                Activa
              </label>
            )}
            <div className="grid grid-cols-1 gap-2 border-t border-surface-border pt-4 sm:flex sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary justify-center">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary justify-center">
                {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear etapa"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
