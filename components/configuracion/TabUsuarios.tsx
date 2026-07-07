"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import type { Usuario } from "@/types/configuracion";

interface TabUsuariosProps {
  initialUsuarios: Usuario[];
}

type RolUsuario = "ADMIN" | "GERENTE_COMERCIAL" | "VENDEDOR" | "ADMINISTRATIVO";

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "GERENTE_COMERCIAL", label: "Gerente comercial" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "ADMINISTRATIVO", label: "Administrativo (consulta)" },
];

interface FormState {
  nombre: string;
  email: string;
  password: string;
  passwordConfirm: string;
  activo: boolean;
  rol: RolUsuario;
}

const emptyForm: FormState = {
  nombre: "",
  email: "",
  password: "",
  passwordConfirm: "",
  activo: true,
  rol: "VENDEDOR",
};

export default function TabUsuarios({ initialUsuarios }: TabUsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialUsuarios);
  const [editing, setEditing] = useState<Usuario | null>(null);
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

  const openEdit = (usuario: Usuario) => {
    setEditing(usuario);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      passwordConfirm: "",
      activo: usuario.activo,
      rol: usuario.rol,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const saveUsuario = async (body: FormState, target?: Usuario) => {
    const res = await fetch(
      target ? `/api/configuracion/usuarios/${target.id}` : "/api/configuracion/usuarios",
      {
        method: target ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: body.nombre.trim(),
          email: body.email.trim(),
          rol: body.rol,
          ...(body.password.trim() && { password: body.password.trim() }),
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
    return data as Usuario;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.email.trim()) {
      setFormError("Nombre y email son requeridos");
      return;
    }
    if (!editing && form.password.trim().length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (form.password.trim() && form.password.trim() !== form.passwordConfirm.trim()) {
      setFormError("La confirmación de contraseña no coincide");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const updated = await saveUsuario(form, editing ?? undefined);
      if (editing) {
        setUsuarios((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setToast({ type: "success", message: "Usuario actualizado correctamente" });
      } else {
        setUsuarios((prev) => [...prev, updated]);
        setToast({ type: "success", message: "Usuario creado correctamente" });
      }
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Error de conexión");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (usuario: Usuario) => {
    try {
      const updated = await saveUsuario(
        {
          nombre: usuario.nombre,
          email: usuario.email,
          password: "",
          passwordConfirm: "",
          activo: !usuario.activo,
          rol: usuario.rol,
        },
        usuario
      );
      setUsuarios((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setToast({
        type: "success",
        message: updated.activo ? `"${updated.nombre}" activado` : `"${updated.nombre}" desactivado`,
      });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Error al actualizar" });
    }
  };

  const ordered = [...usuarios.filter((u) => u.activo), ...usuarios.filter((u) => !u.activo)];

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Administra usuarios del sistema y su rol de acceso.
        </p>
        <button type="button" onClick={openCreate} className="btn-primary w-full justify-center sm:w-auto">
          <Plus size={16} />
          Agregar usuario
        </button>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-surface-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Usuario</th>
              <th className="w-24 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
              <th className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {ordered.map((usuario) => (
              <tr key={usuario.id} className={!usuario.activo ? "bg-gray-50/60 opacity-70" : ""}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-navy">
                    <UserRound size={16} className="text-gray-400" />
                    <div>
                      <p>{usuario.nombre}</p>
                      <p className="text-xs font-normal text-gray-500">{usuario.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    usuario.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {usuario.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => openEdit(usuario)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => handleToggle(usuario)} className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                      {usuario.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ordered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {ordered.map((usuario) => (
          <div key={usuario.id} className={`rounded-xl border border-surface-border bg-white p-4 ${!usuario.activo ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy">{usuario.nombre}</p>
                <p className="truncate text-xs text-gray-500">{usuario.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                usuario.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {usuario.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => openEdit(usuario)} className="btn-secondary justify-center text-xs">
                <Pencil size={14} />
                Editar
              </button>
              <button type="button" onClick={() => handleToggle(usuario)} className="btn-secondary justify-center text-xs">
                {usuario.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <Modal title={editing ? "Editar usuario" : "Nuevo usuario"} onClose={closeModal} size="md">
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
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rol *</label>
              <select className="input" value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUsuario }))}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {form.rol === "VENDEDOR" && (
                <p className="mt-1 text-xs text-gray-400">
                  Un usuario VENDEDOR solo verá sus propios deals/órdenes. La vinculación a su ficha de vendedor se asigna aparte.
                </p>
              )}
            </div>
            <div>
              <label className="label">
                Contraseña {editing && <span className="font-normal text-gray-400">(dejar vacía para no cambiar)</span>}
              </label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" className="input" value={form.passwordConfirm} onChange={(e) => setForm((p) => ({ ...p, passwordConfirm: e.target.value }))} />
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
                {isSaving ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
