"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { ClienteConStats, ClienteInput, CondicionResumen } from "@/types/clientes";

interface ClienteFormProps {
  /** Si se pasa, es edición; si no, es creación */
  cliente?: ClienteConStats;
  condiciones: CondicionResumen[];
  onSuccess: (cliente: ClienteConStats) => void;
  onCancel: () => void;
  /** Modo conversión Prospecto → Cliente (REQ-02): postea al endpoint de conversión */
  convertir?: boolean;
}

type FormErrors = Partial<Record<keyof ClienteInput | "general", string>>;

export default function ClienteForm({
  cliente,
  condiciones,
  onSuccess,
  onCancel,
  convertir = false,
}: ClienteFormProps) {
  const isEditing = !!cliente;

  const [form, setForm] = useState<ClienteInput>({
    nombre: cliente?.nombre ?? "",
    rfc: cliente?.rfc ?? "",
    contacto: cliente?.contacto ?? "",
    ciudad: cliente?.ciudad ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    condicion_pago_id: cliente?.condicion_pago_id ?? condiciones[0]?.id ?? "",
    notas: cliente?.notas ?? "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: keyof ClienteInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // Validación básica en cliente
  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.nombre.trim()) errs.nombre = "Nombre requerido";
    if (form.rfc?.trim() && form.rfc.trim().length < 12)
      errs.rfc = "RFC inválido (mínimo 12 caracteres)";
    if (!form.contacto.trim()) errs.contacto = "Contacto requerido";
    if (!form.ciudad.trim()) errs.ciudad = "Ciudad requerida";
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Email inválido";
    if (!form.condicion_pago_id) errs.condicion_pago_id = "Selecciona una condición";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const url = convertir && cliente
        ? `/api/clientes/${cliente.id}/convertir`
        : isEditing
        ? `/api/clientes/${cliente.id}`
        : "/api/clientes";
      const method = convertir ? "POST" : isEditing ? "PUT" : "POST";

      const payload: ClienteInput = {
        nombre: form.nombre.trim(),
        rfc: form.rfc?.trim().toUpperCase() || null,
        contacto: form.contacto.trim(),
        ciudad: form.ciudad.trim(),
        email: form.email?.trim().toLowerCase() || null,
        telefono: form.telefono?.trim() || null,
        condicion_pago_id: form.condicion_pago_id,
        notas: form.notas?.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Error con campo específico (ej: RFC duplicado)
        if (data.campo) {
          setErrors({ [data.campo]: data.error });
        } else if (data.details) {
          const fieldErrors: FormErrors = {};
          data.details.forEach((d: { campo: string; mensaje: string }) => {
            fieldErrors[d.campo as keyof ClienteInput] = d.mensaje;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error || "Error al guardar" });
        }
        return;
      }

      onSuccess(data as ClienteConStats);
    } catch {
      setErrors({ general: "Error de conexión. Intenta de nuevo." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Error general ── */}
      {errors.general && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.general}
        </div>
      )}

      {/* ── Nombre y RFC ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Razón social / Nombre *</label>
          <input
            autoFocus
            className={`input ${errors.nombre ? "border-red-400 focus:ring-red-400" : ""}`}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="TechCorp México S.A. de C.V."
          />
          {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
        </div>

        <div>
          <label className="label">
            RFC <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            className={`input uppercase font-mono tracking-wider ${errors.rfc ? "border-red-400 focus:ring-red-400" : ""}`}
            value={form.rfc ?? ""}
            onChange={(e) => set("rfc", e.target.value.toUpperCase())}
            placeholder="TCM210501AB3"
            maxLength={13}
          />
          {errors.rfc && <p className="mt-1 text-xs text-red-500">{errors.rfc}</p>}
        </div>

        <div>
          <label className="label">Ciudad *</label>
          <input
            className={`input ${errors.ciudad ? "border-red-400 focus:ring-red-400" : ""}`}
            value={form.ciudad}
            onChange={(e) => set("ciudad", e.target.value)}
            placeholder="Ciudad de México"
          />
          {errors.ciudad && <p className="mt-1 text-xs text-red-500">{errors.ciudad}</p>}
        </div>
      </div>

      {/* ── Contacto ── */}
      <div>
        <label className="label">Nombre de contacto *</label>
        <input
          className={`input ${errors.contacto ? "border-red-400 focus:ring-red-400" : ""}`}
          value={form.contacto}
          onChange={(e) => set("contacto", e.target.value)}
          placeholder="Carlos Mendoza"
        />
        {errors.contacto && <p className="mt-1 text-xs text-red-500">{errors.contacto}</p>}
      </div>

      {/* ── Email y Teléfono ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">
            Email <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="email"
            className={`input ${errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
            placeholder="contacto@empresa.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        <div>
          <label className="label">
            Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="tel"
            className="input"
            value={form.telefono ?? ""}
            onChange={(e) => set("telefono", e.target.value)}
            placeholder="+52 55 1234 5678"
          />
        </div>
      </div>

      {/* ── Condición de pago ── */}
      <div>
        <label className="label">Condición de pago por defecto *</label>
        <select
          className={`input ${errors.condicion_pago_id ? "border-red-400 focus:ring-red-400" : ""}`}
          value={form.condicion_pago_id}
          onChange={(e) => set("condicion_pago_id", e.target.value)}
        >
          <option value="" disabled>
            Selecciona una condición...
          </option>
          {condiciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {errors.condicion_pago_id && (
          <p className="mt-1 text-xs text-red-500">{errors.condicion_pago_id}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Se aplica por defecto a las órdenes de este cliente (se puede cambiar por orden).
        </p>
      </div>

      {/* ── Notas internas ── */}
      <div>
        <label className="label">
          Notas internas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.notas ?? ""}
          onChange={(e) => set("notas", e.target.value)}
          placeholder="Información relevante del cliente: preferencias, contactos adicionales, etc."
        />
      </div>

      {/* ── Acciones ── */}
      <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary justify-center">
          Cancelar
        </button>
        <button type="submit" disabled={isSaving} className="btn-primary justify-center">
          <Save size={15} />
          {isSaving
            ? "Guardando..."
            : isEditing
            ? "Guardar cambios"
            : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
