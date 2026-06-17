"use client";

import { useState, useCallback } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import type { Vendedor } from "@/types/configuracion";

interface TabVendedoresProps {
  initialVendedores: Vendedor[];
}

interface FormState {
  nombre: string;
  email: string;
  telefono: string;
  activo: boolean;
}

const emptyForm: FormState = {
  nombre: "",
  email: "",
  telefono: "",
  activo: true,
};

export default function TabVendedores({ initialVendedores }: TabVendedoresProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>(initialVendedores);
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (vendedor: Vendedor) => {
    setEditing(vendedor);
    setForm({
      nombre: vendedor.nombre,
      email: vendedor.email ?? "",
      telefono: vendedor.telefono ?? "",
      activo: vendedor.activo,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const saveVendedor = async (body: FormState, target?: Vendedor) => {
    const res = await fetch(
      target ? `/api/configuracion/vendedores/${target.id}` : "/api/configuracion/vendedores",
      {
        method: target ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: body.nombre.trim(),
          email: body.email.trim() || null,
          telefono: body.telefono.trim() || null,
          ...(target && { activo: body.activo }),
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const details = Array.isArray(data.details)
        ? data.details.map((d: { mensaje: string }) => d.mensaje).join(". ")
        : "";
      throw new Error(details || data.error || "Error al guardar");
    }
    return data as Vendedor;
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
      const updated = await saveVendedor(form, editing ?? undefined);
      if (editing) {
        setVendedores((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        setToast({ type: "success", message: "Vendedor actualizado correctamente" });
      } else {
        setVendedores((prev) => [...prev, updated]);
        setToast({ type: "success", message: "Vendedor creado correctamente" });
      }
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error de conexión");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (vendedor: Vendedor) => {
    try {
      const updated = await saveVendedor(
        {
          nombre: vendedor.nombre,
          email: vendedor.email ?? "",
          telefono: vendedor.telefono ?? "",
          activo: !vendedor.activo,
        },
        vendedor
      );
      setVendedores((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setToast({
        type: "success",
        message: updated.activo ? `"${updated.nombre}" activado` : `"${updated.nombre}" desactivado`,
      });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Error al actualizar" });
    }
  };

  const activas = vendedores.filter((v) => v.activo);
  const inactivas = vendedores.filter((v) => !v.activo);
  const ordered = [...activas, ...inactivas];

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Administra vendedores comerciales sin convertirlos en usuarios del sistema.
        </p>
        <button type="button" onClick={openCreate} className="btn-primary w-full justify-center sm:w-auto">
          <Plus size={16} />
          Agregar vendedor
        </button>
      </div>

      <div className="space-y-3 md:hidden">
        {ordered.length === 0 && (
          <div className="rounded-xl border border-surface-border p-8 text-center text-sm text-gray-400">
            No hay vendedores registrados
          </div>
        )}
        {ordered.map((vendedor) => (
          <div key={vendedor.id} className={`rounded-xl border border-surface-border bg-white p-4 ${!vendedor.activo ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy">{vendedor.nombre}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {vendedor.email || vendedor.telefono || "Sin datos de contacto"}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                vendedor.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {vendedor.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => openEdit(vendedor)} className="btn-secondary justify-center text-xs">
                <Pencil size={14} />
                Editar
              </button>
              <button type="button" onClick={() => handleToggle(vendedor)} className="btn-secondary justify-center text-xs">
                {vendedor.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-surface-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto</th>
              <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
              <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {ordered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay vendedores registrados
                </td>
              </tr>
            )}
            {ordered.map((vendedor) => (
              <tr key={vendedor.id} className={!vendedor.activo ? "bg-gray-50/60 opacity-70" : ""}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-navy">
                    <UserRound size={16} className="text-gray-400" />
                    {vendedor.nombre}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {vendedor.email || vendedor.telefono ? (
                    <div className="space-y-0.5">
                      {vendedor.email && <p>{vendedor.email}</p>}
                      {vendedor.telefono && <p>{vendedor.telefono}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-400">Sin datos de contacto</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    vendedor.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {vendedor.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => openEdit(vendedor)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => handleToggle(vendedor)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                      {vendedor.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal title={editing ? "Editar vendedor" : "Nuevo vendedor"} onClose={closeModal} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}

            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email <span className="font-normal text-gray-400">(opcional)</span></label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Teléfono <span className="font-normal text-gray-400">(opcional)</span></label>
              <input className="input" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
                Activo
              </label>
            )}

            <div className="grid grid-cols-1 gap-2 border-t border-surface-border pt-4 sm:flex sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary justify-center">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary justify-center">
                {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear vendedor"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
