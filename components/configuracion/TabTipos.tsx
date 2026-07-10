"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import type { TipoCotizacion } from "@/types/configuracion";

interface TabTiposProps {
  initialTipos: TipoCotizacion[];
}

interface FormState {
  nombre: string;
  descripcion: string;
  texto_contrato: string;
  color: string;
  activo: boolean;
}

const COLOR_DEFAULT = "#6B7A99";

const emptyForm: FormState = {
  nombre: "",
  descripcion: "",
  texto_contrato: "",
  color: COLOR_DEFAULT,
  activo: true,
};

export default function TabTipos({ initialTipos }: TabTiposProps) {
  const [tipos, setTipos] = useState<TipoCotizacion[]>(initialTipos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoCotizacion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const normalizeMarkdownText = (value: string) =>
    value.replace(/<br\s*\/?>/gi, "\n").trim();

  const openCreate = () => {
    setEditingTipo(null);
    setForm(emptyForm);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (tipo: TipoCotizacion) => {
    setEditingTipo(tipo);
    setForm({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion ?? "",
      texto_contrato: tipo.texto_contrato ?? "",
      color: tipo.color ?? COLOR_DEFAULT,
      activo: tipo.activo,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTipo(null);
    setFormError("");
  };

  const handleToggleActivo = async (tipo: TipoCotizacion) => {
    try {
      const res = await fetch(
        `/api/configuracion/tipos-cotizacion/${tipo.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: tipo.nombre,
            descripcion: tipo.descripcion,
            texto_contrato: tipo.texto_contrato,
            activo: !tipo.activo,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "Error al actualizar" });
        return;
      }

      const updated: TipoCotizacion = await res.json();
      setTipos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setToast({
        type: "success",
        message: updated.activo
          ? `"${updated.nombre}" activado`
          : `"${updated.nombre}" desactivado`,
      });
    } catch {
      setToast({ type: "error", message: "Error de conexión" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setFormError("El nombre es requerido");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const isEditing = editingTipo !== null;
      const url = isEditing
        ? `/api/configuracion/tipos-cotizacion/${editingTipo.id}`
        : "/api/configuracion/tipos-cotizacion";
      const method = isEditing ? "PUT" : "POST";

      const body = isEditing
        ? {
            nombre: form.nombre,
            descripcion: form.descripcion || null,
            texto_contrato: normalizeMarkdownText(form.texto_contrato) || null,
            color: form.color,
            activo: form.activo,
          }
        : {
            nombre: form.nombre,
            descripcion: form.descripcion || null,
            texto_contrato: normalizeMarkdownText(form.texto_contrato) || null,
            color: form.color,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.details)
          ? data.details.map((d: { campo: string; mensaje: string }) => d.mensaje).join(". ")
          : "";
        setFormError(details || data.error || "Error al guardar");
        return;
      }

      if (isEditing) {
        setTipos((prev) => prev.map((t) => (t.id === data.id ? data : t)));
        setToast({ type: "success", message: "Tipo actualizado correctamente" });
      } else {
        setTipos((prev) => [...prev, data]);
        setToast({ type: "success", message: "Tipo creado correctamente" });
      }

      closeModal();
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  // Separar activos e inactivos
  const activos = tipos.filter((t) => t.activo);
  const inactivos = tipos.filter((t) => !t.activo);

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      {/* Header de la sección */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Clasifica tus órdenes de venta según el tipo de proyecto o servicio.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary w-full justify-center sm:w-auto">
          <Plus size={16} />
          Agregar tipo
        </button>
      </div>

      <div className="space-y-3 md:hidden">
        {tipos.length === 0 && (
          <div className="rounded-xl border border-surface-border p-8 text-center text-sm text-gray-400">
            No hay tipos de cotización registrados
          </div>
        )}
        {[...activos, ...inactivos].map((tipo) => (
          <TipoCard key={tipo.id} tipo={tipo} onEdit={openEdit} onToggle={handleToggleActivo} />
        ))}
      </div>

      {/* Tabla */}
      <div className="hidden overflow-hidden rounded-xl border border-surface-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-surface-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Nombre
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Descripción
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                Estado
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {tipos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay tipos de cotización registrados
                </td>
              </tr>
            )}

            {/* Activos primero */}
            {activos.map((tipo) => (
              <TipoRow
                key={tipo.id}
                tipo={tipo}
                onEdit={openEdit}
                onToggle={handleToggleActivo}
              />
            ))}

            {/* Separador si hay inactivos */}
            {inactivos.length > 0 && activos.length > 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-2 bg-gray-50">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Inactivos
                  </span>
                </td>
              </tr>
            )}

            {inactivos.map((tipo) => (
              <TipoRow
                key={tipo.id}
                tipo={tipo}
                onEdit={openEdit}
                onToggle={handleToggleActivo}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      {isModalOpen && (
        <Modal
          title={editingTipo ? "Editar tipo de cotización" : "Nuevo tipo de cotización"}
          onClose={closeModal}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre *</label>
              <input
                autoFocus
                className={`input ${formError && !form.nombre.trim() ? "border-red-400" : ""}`}
                value={form.nombre}
                onChange={(e) => {
                  setForm((f) => ({ ...f, nombre: e.target.value }));
                  setFormError("");
                }}
                placeholder="Ej: Proyecto Fijo"
              />
            </div>

            <div>
              <label className="label">Descripción</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción opcional del tipo de cotización..."
              />
            </div>

            <div>
              <label className="label">Color en reportes</label>
              <p className="mb-2 text-xs text-gray-400">
                Pinta la porción de este tipo en el gráfico &quot;ventas por tipo&quot;.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-surface-border bg-white p-0.5"
                  aria-label="Selector de color"
                />
                <input
                  className="input font-mono uppercase"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#6B7A99"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className="label">Texto de contrato / condición</label>
              <p className="mb-2 text-xs text-gray-400">
                Puedes pegar texto largo desde Notion en formato Markdown. Si pegas saltos como &lt;br&gt;, se convertirán a saltos de línea en el PDF.
              </p>
              <textarea
                className="input min-h-[260px] resize-y font-mono text-sm leading-relaxed"
                rows={12}
                value={form.texto_contrato}
                onChange={(e) =>
                  setForm((f) => ({ ...f, texto_contrato: e.target.value }))
                }
                placeholder={"Ej:\n## Alcance contractual\n- Servicio incluido\n- Condición especial\n\nTexto adicional..."}
              />
            </div>

            {/* Toggle activo solo en edición */}
            {editingTipo && (
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Estado</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.activo}
                  onClick={() => setForm((f) => ({ ...f, activo: !f.activo }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${form.activo ? "bg-navy" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                      ${form.activo ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            )}

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2 sm:flex sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary justify-center">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className="btn-primary justify-center">
                {isSaving ? "Guardando..." : editingTipo ? "Guardar cambios" : "Crear tipo"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function TipoCard({
  tipo,
  onEdit,
  onToggle,
}: {
  tipo: TipoCotizacion;
  onEdit: (t: TipoCotizacion) => void;
  onToggle: (t: TipoCotizacion) => void;
}) {
  return (
    <div className={`rounded-xl border border-surface-border bg-white p-4 ${!tipo.activo ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{tipo.nombre}</p>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{tipo.descripcion || "Sin descripción"}</p>
          {tipo.texto_contrato && (
            <span className="mt-2 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
              Texto PDF configurado
            </span>
          )}
        </div>
        <span className={`badge shrink-0 ${tipo.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {tipo.activo ? "Activo" : "Inactivo"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => onEdit(tipo)} className="btn-secondary justify-center text-xs">
          <Pencil size={14} />
          Editar
        </button>
        <button onClick={() => onToggle(tipo)} className="btn-secondary justify-center text-xs">
          {tipo.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-componente: fila de tabla ────────────────────────────
function TipoRow({
  tipo,
  onEdit,
  onToggle,
}: {
  tipo: TipoCotizacion;
  onEdit: (t: TipoCotizacion) => void;
  onToggle: (t: TipoCotizacion) => void;
}) {
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${!tipo.activo ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ background: tipo.color || "#6B7A99" }}
            title={tipo.color || "#6B7A99"}
          />
          <span className="font-medium text-gray-900">{tipo.nombre}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500 max-w-xs">
        <div className="space-y-1">
          <span className="line-clamp-1">{tipo.descripcion || "—"}</span>
          {tipo.texto_contrato && (
            <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
              Texto PDF configurado
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`badge ${
            tipo.activo
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {tipo.activo ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(tipo)}
            className="p-1.5 text-gray-400 hover:text-navy hover:bg-navy-50 rounded-md transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onToggle(tipo)}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors
              ${
                tipo.activo
                  ? "text-red-500 hover:bg-red-50"
                  : "text-green-600 hover:bg-green-50"
              }`}
            title={tipo.activo ? "Desactivar" : "Activar"}
          >
            {tipo.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
