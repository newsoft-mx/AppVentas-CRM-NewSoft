"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";

interface Motivo {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

// Catálogo editable de motivos de pérdida (SOL-10).
export default function TabMotivosPerdida({ initialMotivos }: { initialMotivos: Motivo[] }) {
  const [motivos, setMotivos] = useState<Motivo[]>(initialMotivos);
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [error, setError] = useState("");

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/motivos-perdida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "No se pudo agregar");
    setMotivos((m) => [...m, data]);
    setNuevo("");
    setError("");
  }

  async function guardarEdicion(id: string) {
    const nombre = editNombre.trim();
    if (!nombre) return setEditId(null);
    const res = await fetch(`/api/configuracion/motivos-perdida/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (res.ok) setMotivos((m) => m.map((x) => (x.id === id ? data : x)));
    setEditId(null);
  }

  async function toggleActivo(mo: Motivo) {
    const res = await fetch(`/api/configuracion/motivos-perdida/${mo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !mo.activo }),
    });
    if (res.ok) setMotivos((m) => m.map((x) => (x.id === mo.id ? { ...x, activo: !mo.activo } : x)));
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este motivo? Los deals históricos conservan la razón registrada.")) return;
    const res = await fetch(`/api/configuracion/motivos-perdida/${id}`, { method: "DELETE" });
    if (res.ok) setMotivos((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-navy">Motivos de pérdida</h2>
        <p className="mt-1 text-sm text-gray-500">
          Lista editable de razones para marcar un deal como perdido. Alimenta el modal de pérdida y el análisis del funnel.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nuevo motivo…"
          className="input flex-1"
        />
        <button onClick={agregar} className="btn-primary shrink-0">
          <Plus size={16} /> Agregar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="divide-y divide-surface-border rounded-lg border border-surface-border">
        {motivos.length === 0 && <p className="p-4 text-sm text-gray-400">Sin motivos. Agregá el primero.</p>}
        {motivos.map((mo) => (
          <div key={mo.id} className={`flex items-center gap-2 px-3 py-2 ${mo.activo ? "" : "opacity-50"}`}>
            {editId === mo.id ? (
              <>
                <input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardarEdicion(mo.id)}
                  className="input flex-1"
                />
                <button onClick={() => guardarEdicion(mo.id)} className="text-emerald-600" title="Guardar"><Check size={16} /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400" title="Cancelar"><X size={16} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-navy">
                  {mo.nombre}
                  {!mo.activo && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}
                </span>
                <button onClick={() => { setEditId(mo.id); setEditNombre(mo.nombre); }} className="text-xs font-medium text-gray-500 hover:text-navy">Editar</button>
                <button onClick={() => toggleActivo(mo)} className="text-xs font-medium text-gray-500 hover:text-navy">{mo.activo ? "Desactivar" : "Activar"}</button>
                <button onClick={() => eliminar(mo.id)} className="text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
