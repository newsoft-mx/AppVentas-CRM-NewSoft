"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface TipoAccion {
  id: string;
  nombre: string;
  color: string;
  agendable: boolean;
  con_resultado: boolean;
  activo: boolean;
}
interface ResultadoAccion {
  id: string;
  nombre: string;
  efecto: "POSITIVO" | "NEUTRO" | "NEGATIVO";
  sugiere_reagendar: boolean;
  activo: boolean;
}

const EFECTO_META: Record<string, { label: string; clase: string }> = {
  POSITIVO: { label: "Positivo", clase: "text-emerald-700" },
  NEUTRO: { label: "Neutro", clase: "text-gray-500" },
  NEGATIVO: { label: "Negativo", clase: "text-red-700" },
};

// Config del modelo de actividad (SOL-04): tipos de acción + resultados.
export default function TabModeloActividad({
  initialTipos,
  initialResultados,
}: {
  initialTipos: TipoAccion[];
  initialResultados: ResultadoAccion[];
}) {
  const [tipos, setTipos] = useState<TipoAccion[]>(initialTipos);
  const [resultados, setResultados] = useState<ResultadoAccion[]>(initialResultados);
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [nuevoRes, setNuevoRes] = useState("");

  async function patchTipo(id: string, data: Partial<TipoAccion>) {
    setTipos((t) => t.map((x) => (x.id === id ? { ...x, ...data } : x)));
    await fetch(`/api/configuracion/tipos-accion/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
  }
  async function addTipo() {
    const nombre = nuevoTipo.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/tipos-accion", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }),
    });
    if (res.ok) { const nuevo = await res.json(); setTipos((t) => [...t, nuevo]); setNuevoTipo(""); }
  }
  async function delTipo(id: string) {
    if (!window.confirm("¿Eliminar este tipo de acción?")) return;
    const res = await fetch(`/api/configuracion/tipos-accion/${id}`, { method: "DELETE" });
    if (res.ok) setTipos((t) => t.filter((x) => x.id !== id));
    else window.alert("No se pudo eliminar (puede tener actividades asociadas).");
  }

  async function patchRes(id: string, data: Partial<ResultadoAccion>) {
    setResultados((r) => r.map((x) => (x.id === id ? { ...x, ...data } : x)));
    await fetch(`/api/configuracion/resultados-accion/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
  }
  async function addRes() {
    const nombre = nuevoRes.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/resultados-accion", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }),
    });
    if (res.ok) { const nuevo = await res.json(); setResultados((r) => [...r, nuevo]); setNuevoRes(""); }
  }
  async function delRes(id: string) {
    if (!window.confirm("¿Eliminar este resultado?")) return;
    const res = await fetch(`/api/configuracion/resultados-accion/${id}`, { method: "DELETE" });
    if (res.ok) setResultados((r) => r.filter((x) => x.id !== id));
    else window.alert("No se pudo eliminar (puede tener actividades asociadas).");
  }

  return (
    <div className="space-y-8">
      {/* Tipos de acción */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Tipos de acción</h2>
          <p className="mt-1 text-sm text-gray-500">
            Naturaleza de cada entrada de bitácora. <b>Agendable</b>: admite fecha futura y ciclo planeada→realizada.
            <b> Con resultado</b>: produce un desenlace que mueve el termómetro.
          </p>
        </div>
        <div className="divide-y divide-surface-border rounded-lg border border-surface-border">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 bg-gray-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Color</span><span>Nombre</span><span>¿Agendable?</span><span>¿Con resultado?</span><span></span>
          </div>
          {tipos.map((t) => (
            <div key={t.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-3 py-2 ${t.activo ? "" : "opacity-50"}`}>
              <input type="color" value={t.color} onChange={(e) => patchTipo(t.id, { color: e.target.value })} className="h-7 w-7 cursor-pointer rounded border border-surface-border" title="Color" />
              <input value={t.nombre} onChange={(e) => setTipos((ts) => ts.map((x) => x.id === t.id ? { ...x, nombre: e.target.value } : x))} onBlur={(e) => patchTipo(t.id, { nombre: e.target.value.trim() })} className="input py-1 text-sm" />
              <input type="checkbox" checked={t.agendable} onChange={(e) => patchTipo(t.id, { agendable: e.target.checked })} className="mx-auto h-4 w-4" />
              <input type="checkbox" checked={t.con_resultado} onChange={(e) => patchTipo(t.id, { con_resultado: e.target.checked })} className="mx-auto h-4 w-4" />
              <button onClick={() => delTipo(t.id)} className="text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTipo()} placeholder="Nuevo tipo de acción…" className="input flex-1" />
          <button onClick={addTipo} className="btn-primary shrink-0"><Plus size={16} /> Agregar</button>
        </div>
      </section>

      {/* Resultados de acción */}
      <section className="space-y-3 border-t border-surface-border pt-6">
        <div>
          <h2 className="text-base font-semibold text-navy">Resultados de acción</h2>
          <p className="mt-1 text-sm text-gray-500">
            Desenlaces posibles al marcar una acción como realizada. El <b>efecto</b> mueve el termómetro; <b>sugerir reagendar</b> ofrece crear el siguiente paso.
          </p>
        </div>
        <div className="divide-y divide-surface-border rounded-lg border border-surface-border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 bg-gray-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Nombre</span><span>Efecto termómetro</span><span>¿Sugiere reagendar?</span><span></span>
          </div>
          {resultados.map((r) => (
            <div key={r.id} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 ${r.activo ? "" : "opacity-50"}`}>
              <input value={r.nombre} onChange={(e) => setResultados((rs) => rs.map((x) => x.id === r.id ? { ...x, nombre: e.target.value } : x))} onBlur={(e) => patchRes(r.id, { nombre: e.target.value.trim() })} className="input py-1 text-sm" />
              <select value={r.efecto} onChange={(e) => patchRes(r.id, { efecto: e.target.value as ResultadoAccion["efecto"] })} className={`input py-1 text-sm font-medium ${EFECTO_META[r.efecto].clase}`}>
                <option value="POSITIVO">Positivo</option>
                <option value="NEUTRO">Neutro</option>
                <option value="NEGATIVO">Negativo</option>
              </select>
              <input type="checkbox" checked={r.sugiere_reagendar} onChange={(e) => patchRes(r.id, { sugiere_reagendar: e.target.checked })} className="mx-auto h-4 w-4" />
              <button onClick={() => delRes(r.id)} className="text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={nuevoRes} onChange={(e) => setNuevoRes(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRes()} placeholder="Nuevo resultado…" className="input flex-1" />
          <button onClick={addRes} className="btn-primary shrink-0"><Plus size={16} /> Agregar</button>
        </div>
      </section>
    </div>
  );
}
