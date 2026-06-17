"use client";

import { useState, useCallback } from "react";
import { Save, Building2, Hash, Calendar, Percent, FileText } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";
import type { Empresa } from "@/types/configuracion";

interface TabEmpresaProps {
  empresa: Empresa;
}

export default function TabEmpresa({ empresa }: TabEmpresaProps) {
  const [form, setForm] = useState<Omit<Empresa, "id" | "created_at" | "updated_at">>({
    nombre: empresa.nombre,
    nombre_comercial: empresa.nombre_comercial ?? "Newsoft",
    rfc: empresa.rfc,
    direccion: empresa.direccion,
    email: empresa.email,
    telefono: empresa.telefono,
    prefijo_folio: empresa.prefijo_folio,
    siguiente_folio: empresa.siguiente_folio,
    vigencia_cotizacion_dias: empresa.vigencia_cotizacion_dias,
    aplicar_iva: empresa.aplicar_iva,
    tasa_iva: empresa.tasa_iva,
    notas_documentos: empresa.notas_documentos,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const set = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo al editar
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = "Nombre requerido";
    if (!form.nombre_comercial?.trim()) errs.nombre_comercial = "Nombre comercial requerido";
    if (!form.rfc.trim()) errs.rfc = "RFC requerido";
    if (!form.direccion.trim()) errs.direccion = "Dirección requerida";
    if (!form.email.trim()) errs.email = "Email requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Email inválido";
    if (!form.telefono.trim()) errs.telefono = "Teléfono requerido";
    if (!form.prefijo_folio.trim()) errs.prefijo_folio = "Prefijo requerido";
    if (form.vigencia_cotizacion_dias < 1)
      errs.vigencia_cotizacion_dias = "Mínimo 1 día";
    if (form.aplicar_iva && (form.tasa_iva < 0 || form.tasa_iva > 100))
      errs.tasa_iva = "Tasa entre 0 y 100";
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
    try {
      const res = await fetch("/api/configuracion/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "Error al guardar" });
        return;
      }

      setToast({ type: "success", message: "Configuración guardada correctamente" });
    } catch {
      setToast({ type: "error", message: "Error de conexión. Intenta de nuevo." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">

        {/* ── Datos de la empresa ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-orange" />
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">
              Datos de la empresa
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nombre comercial *</label>
              <input
                className={`input ${errors.nombre_comercial ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.nombre_comercial ?? ""}
                onChange={(e) => set("nombre_comercial", e.target.value)}
                placeholder="Newsoft"
              />
              <p className="mt-1 text-xs text-gray-400">
                Nombre visible en cotizaciones y encabezados comerciales.
              </p>
              {errors.nombre_comercial && (
                <p className="mt-1 text-xs text-red-500">{errors.nombre_comercial}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Razón social *</label>
              <input
                className={`input ${errors.nombre ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Newsoft Technologies S.A. de C.V."
              />
              {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
            </div>

            <div>
              <label className="label">RFC *</label>
              <input
                className={`input uppercase ${errors.rfc ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.rfc}
                onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                placeholder="NTE150615GH7"
                maxLength={13}
              />
              {errors.rfc && <p className="mt-1 text-xs text-red-500">{errors.rfc}</p>}
            </div>

            <div>
              <label className="label">Teléfono *</label>
              <input
                className={`input ${errors.telefono ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="+52 55 1234 5678"
              />
              {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="label">Dirección fiscal *</label>
              <textarea
                className={`input resize-none ${errors.direccion ? "border-red-400 focus:ring-red-400" : ""}`}
                rows={2}
                value={form.direccion}
                onChange={(e) => set("direccion", e.target.value)}
                placeholder="Av. Insurgentes Sur 1234, Piso 8, CDMX"
              />
              {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="label">Email de ventas *</label>
              <input
                className={`input ${errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="ventas@newsoft.mx"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
          </div>
        </section>

        <hr className="border-surface-border" />

        {/* ── Configuración de folios ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Hash size={16} className="text-orange" />
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">
              Configuración de folios
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Prefijo *</label>
              <input
                className={`input uppercase font-mono ${errors.prefijo_folio ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.prefijo_folio}
                onChange={(e) => set("prefijo_folio", e.target.value.toUpperCase())}
                placeholder="NS"
                maxLength={10}
              />
              {errors.prefijo_folio && (
                <p className="mt-1 text-xs text-red-500">{errors.prefijo_folio}</p>
              )}
            </div>

            <div>
              <label className="label">Siguiente folio</label>
              <div className="relative">
                <input
                  className="input bg-gray-50 text-gray-500 font-mono cursor-not-allowed"
                  value={`${form.prefijo_folio}${String(form.siguiente_folio).padStart(5, "0")}`}
                  disabled
                  readOnly
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Gestionado automáticamente</p>
            </div>

            <div>
              <label className="label flex items-center gap-1">
                <Calendar size={13} />
                Vigencia cotización (días) *
              </label>
              <input
                className={`input ${errors.vigencia_cotizacion_dias ? "border-red-400 focus:ring-red-400" : ""}`}
                type="number"
                min={1}
                max={365}
                value={form.vigencia_cotizacion_dias}
                onChange={(e) => set("vigencia_cotizacion_dias", parseInt(e.target.value) || 1)}
              />
              {errors.vigencia_cotizacion_dias && (
                <p className="mt-1 text-xs text-red-500">{errors.vigencia_cotizacion_dias}</p>
              )}
            </div>
          </div>
        </section>

        <hr className="border-surface-border" />

        {/* ── Configuración de IVA ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Percent size={16} className="text-orange" />
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">
              Configuración de IVA
            </h3>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Toggle aplicar IVA */}
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <button
                type="button"
                role="switch"
                aria-checked={form.aplicar_iva}
                onClick={() => set("aplicar_iva", !form.aplicar_iva)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${form.aplicar_iva ? "bg-navy" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                    ${form.aplicar_iva ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                Aplicar IVA por defecto
              </span>
            </label>

            {/* Tasa IVA (solo si aplica) */}
            {form.aplicar_iva && (
              <div className="animate-fade-in">
                <label className="label">Tasa IVA (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    className={`input w-28 ${errors.tasa_iva ? "border-red-400 focus:ring-red-400" : ""}`}
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={form.tasa_iva}
                    onChange={(e) => set("tasa_iva", parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                {errors.tasa_iva && (
                  <p className="mt-1 text-xs text-red-500">{errors.tasa_iva}</p>
                )}
              </div>
            )}
          </div>
        </section>

        <hr className="border-surface-border" />

        {/* ── Notas de documentos ── */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-orange" />
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">
              Notas para documentos (PDF)
            </h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Aparece en el pie de cada PDF. Usa{" "}
            <code className="bg-gray-100 px-1 rounded text-xs font-mono text-orange">
              {"{vigencia}"}
            </code>{" "}
            para insertar la fecha de vigencia automáticamente.
          </p>
          <textarea
            className="input resize-none"
            rows={4}
            value={form.notas_documentos ?? ""}
            onChange={(e) => set("notas_documentos", e.target.value || null)}
            placeholder="Esta propuesta tiene una vigencia de {vigencia}. Los precios incluyen IVA..."
          />
        </section>

        {/* ── Acción ── */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary w-full justify-center sm:w-auto"
          >
            <Save size={16} />
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </>
  );
}
