"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import ThOrdenable from "@/components/ui/ThOrdenable";
import {
  ordenarPorTramos, propsOrdenables, siguienteOrden, type OrdenTabla,
} from "@/lib/tabla-orden";
import { EXTRACTORES_USUARIO, type CampoUsuario } from "@/lib/configuracion-orden";
import { ROLE_LABEL, type UserRole } from "@/lib/session";
import type { Usuario } from "@/types/configuracion";
import { TH_CONFIG } from "./estilos-tabla";
import { mensajeDeError } from "@/lib/errores-formulario";

interface TabUsuariosProps {
  initialUsuarios: Usuario[];
  vendedores: { id: string; nombre: string }[];
}

// El rol usa el tipo canónico (lib/session), y las opciones del selector salen de
// ROLE_LABEL: es el mismo mapa que ya usan el sidebar y la vista de perfil. Acá vivía
// una copia — misma lista, labels tipeados de nuevo —, así que agregar un rol obligaba
// a acordarse de este archivo; olvidarlo no rompía nada visible: el selector
// simplemente no lo ofrecía. ADMINISTRATIVO conserva el matiz "(consulta)", que es
// propio de este selector y no del label general.
type RolUsuario = UserRole;

const ROLES: { value: RolUsuario; label: string }[] = (Object.keys(ROLE_LABEL) as UserRole[]).map(
  (value) => ({
    value,
    label: value === "ADMINISTRATIVO" ? `${ROLE_LABEL[value]} (consulta)` : ROLE_LABEL[value],
  })
);

interface FormState {
  nombre: string;
  email: string;
  password: string;
  passwordConfirm: string;
  activo: boolean;
  rol: RolUsuario;
  vendedor_id: string;
}

const emptyForm: FormState = {
  nombre: "",
  email: "",
  password: "",
  passwordConfirm: "",
  activo: true,
  rol: "VENDEDOR",
  vendedor_id: "",
};

export default function TabUsuarios({ initialUsuarios, vendedores }: TabUsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialUsuarios);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  // Orden por encabezado (cimiento compartido: lib/tabla-orden). `campo: null` = el orden que
  // ya trae la lista. Estado local: es una ayuda de lectura, no una vista que se comparta.
  const [orden, setOrden] = useState<OrdenTabla<CampoUsuario>>({ campo: null, sentido: "asc" });
  const th = propsOrdenables(orden, (campo) => setOrden((o) => siguienteOrden(o, campo)));

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
      vendedor_id: usuario.vendedor_id ?? "",
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
          vendedor_id: body.rol === "VENDEDOR" && body.vendedor_id ? body.vendedor_id : null,
          ...(body.password.trim() && { password: body.password.trim() }),
          ...(target && { activo: body.activo }),
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(mensajeDeError(data, "Error al guardar"));
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
    if (form.rol === "VENDEDOR" && !form.vendedor_id) {
      setFormError("Seleccioná la ficha de vendedor para un usuario VENDEDOR");
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
          vendedor_id: usuario.vendedor_id ?? "",
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

  // Activos primero, inactivos después: esa partición es un límite estructural aunque no haya
  // fila separadora (los inactivos se pintan apagados al final). Por eso el orden se aplica
  // DENTRO de cada tramo — sobre la lista plana, un inactivo se treparía arriba de los activos.
  // La tabla y las tarjetas mobile consumen esta misma lista.
  const ordered = useMemo(() => {
    const activos = usuarios.filter((u) => u.activo);
    const inactivos = usuarios.filter((u) => !u.activo);
    return ordenarPorTramos([activos, inactivos], orden, EXTRACTORES_USUARIO).flat();
  }, [usuarios, orden]);

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
              <ThOrdenable {...th("usuario")} className={TH_CONFIG}>Usuario</ThOrdenable>
              <th className={`${TH_CONFIG} text-center w-24`}>Estado</th>
              <th className={`${TH_CONFIG} text-right w-32`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {ordered.map((usuario) => (
              <tr key={usuario.id} className={!usuario.activo ? "bg-gray-50/60 opacity-70" : ""}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-navy">
                    <UserRound size={16} className="text-gray-500" />
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
                    <button type="button" onClick={() => openEdit(usuario)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-navy" title="Editar">
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
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
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
          {/* autoComplete off + new-password: evita que el gestor del navegador
              autocomplete/pise la contraseña con credenciales guardadas del admin
              (se guardaba una password distinta a la tipeada → el usuario no entraba). */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
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
              <input type="email" autoComplete="off" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Rol *</label>
              <select className="input" value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUsuario }))}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {form.rol === "VENDEDOR" && (
                <div className="mt-3">
                  <label className="label">Ficha de vendedor *</label>
                  <select
                    className="input"
                    value={form.vendedor_id}
                    onChange={(e) => setForm((p) => ({ ...p, vendedor_id: e.target.value }))}
                  >
                    <option value="">— Seleccionar —</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nombre}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Vincula el usuario a su ficha para que solo vea sus propios deals y órdenes.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="label">
                Contraseña {editing && <span className="font-normal text-gray-500">(dejar vacía para no cambiar)</span>}
              </label>
              <input type="password" autoComplete="new-password" className="input" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" autoComplete="new-password" className="input" value={form.passwordConfirm} onChange={(e) => setForm((p) => ({ ...p, passwordConfirm: e.target.value }))} />
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
