"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";

export type TipoCatalogo = "CANAL" | "ORIGEN";

export interface OpcionCatalogo {
  id: string;
  tipo: TipoCatalogo;
  nombre: string;
  orden: number;
  activo: boolean;
}

// Catálogo administrable de Canal y Origen del deal. Un solo componente maneja ambos
// tipos reusando la misma lista (DRY): se instancia dos veces con el tipo distinto.
export default function TabCanalesOrigenes({ initial }: { initial: OpcionCatalogo[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-navy">Canales y Orígenes</h2>
        <p className="mt-1 text-sm text-gray-500">
          Listas administrables para el alta/edición de deals. Reemplazan al texto libre: mismos valores para todos.
        </p>
      </div>
      <ListaCatalogo tipo="CANAL" titulo="Canal" initial={initial.filter((o) => o.tipo === "CANAL")} />
      <ListaCatalogo tipo="ORIGEN" titulo="Origen" initial={initial.filter((o) => o.tipo === "ORIGEN")} />
    </div>
  );
}

function ListaCatalogo({ tipo, titulo, initial }: { tipo: TipoCatalogo; titulo: string; initial: OpcionCatalogo[] }) {
  const [opciones, setOpciones] = useState<OpcionCatalogo[]>(initial);
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [error, setError] = useState("");

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/catalogo-deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, nombre }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "No se pudo agregar");
    setOpciones((o) => [...o, data]);
    setNuevo("");
    setError("");
  }

  async function guardarEdicion(id: string) {
    const nombre = editNombre.trim();
    if (!nombre) return setEditId(null);
    const res = await fetch(`/api/configuracion/catalogo-deal/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = await res.json();
    if (res.ok) setOpciones((o) => o.map((x) => (x.id === id ? data : x)));
    setEditId(null);
  }

  async function toggleActivo(op: OpcionCatalogo) {
    const res = await fetch(`/api/configuracion/catalogo-deal/${op.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !op.activo }),
    });
    if (res.ok) setOpciones((o) => o.map((x) => (x.id === op.id ? { ...x, activo: !op.activo } : x)));
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar esta opción? Los deals que la usaban quedan sin ese dato (no se borran).")) return;
    const res = await fetch(`/api/configuracion/catalogo-deal/${id}`, { method: "DELETE" });
    if (res.ok) setOpciones((o) => o.filter((x) => x.id !== id));
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-navy">{titulo}</h3>
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder={`Nuevo ${titulo.toLowerCase()}…`}
          className="input flex-1"
        />
        <button onClick={agregar} className="btn-primary shrink-0">
          <Plus size={16} /> Agregar
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 divide-y divide-surface-border rounded-lg border border-surface-border">
        {opciones.length === 0 && <p className="p-4 text-sm text-gray-400">Sin opciones. Agregá la primera.</p>}
        {opciones.map((op) => (
          <div key={op.id} className={`flex items-center gap-2 px-3 py-2 ${op.activo ? "" : "opacity-50"}`}>
            {editId === op.id ? (
              <>
                <input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardarEdicion(op.id)}
                  className="input flex-1"
                />
                <button onClick={() => guardarEdicion(op.id)} className="text-emerald-600" title="Guardar">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditId(null)} className="text-gray-400" title="Cancelar">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-navy">
                  {op.nombre}
                  {!op.activo && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}
                </span>
                <button
                  onClick={() => { setEditId(op.id); setEditNombre(op.nombre); }}
                  className="text-xs font-medium text-gray-500 hover:text-navy"
                >Editar</button>
                <button
                  onClick={() => toggleActivo(op)}
                  className="text-xs font-medium text-gray-500 hover:text-navy"
                >{op.activo ? "Desactivar" : "Activar"}</button>
                <button
                  onClick={() => eliminar(op.id)}
                  className="text-gray-300 hover:text-red-500" title="Eliminar"
                ><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
