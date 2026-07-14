"use client";

import { useState, useMemo, useCallback } from "react";
import { Save, Plus, Trash2, Calculator } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { formatMoneda, formatMXN } from "@/lib/utils";
import type { OrdenDetalle } from "@/types/ordenes";

// ── Tipos locales ─────────────────────────────────────────────

interface ClienteOpcion {
  id: string;
  nombre: string;
  rfc: string | null;
  condicion_pago_id: string;
}

interface CatalogItem {
  id: string;
  nombre: string;
}

interface PartidaLocal {
  _key: string; // key temporal para React
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
}

interface OrdenFormProps {
  /** Si se pasa, es edición; si no, es creación */
  orden?: OrdenDetalle;
  clientes: ClienteOpcion[];
  tipos: CatalogItem[];
  condiciones: CatalogItem[];
  vendedores: CatalogItem[];
  /** Tasa IVA de la empresa (default) */
  tasaIvaDefault: number;
  /** Configuración default de empresa para nuevas órdenes */
  aplicarIvaDefault?: boolean;
  vigenciaDiasDefault?: number;
  /** Precarga (hand-off desde un deal GANADO): valores iniciales solo en modo creación */
  precarga?: { cliente_id?: string; vendedor_id?: string; descripcion?: string; valor?: number; deal_id?: string };
  onSuccess: (orden: OrdenDetalle) => void;
  onCancel?: () => void;
}

type FormErrors = Partial<Record<string, string>>;

function createTempKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `partida-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Cálculo client-side para el preview ──────────────────────

function calcularPreview(params: {
  partidas: PartidaLocal[];
  descuento: string;
  apIva: boolean;
  tasaIva: string;
  moneda: "MXN" | "USD";
  tipoCambio: string;
}) {
  const { partidas, descuento, apIva, tasaIva, moneda, tipoCambio } = params;

  const subtotal = partidas.reduce((acc, p) => {
    const cant = parseFloat(p.cantidad) || 0;
    const precio = parseFloat(p.precio_unitario) || 0;
    return acc + cant * precio;
  }, 0);

  const pct = parseFloat(descuento) || 0;
  const montoDesc = Math.round(subtotal * pct) / 100;
  const subtotalConDesc = subtotal - montoDesc;

  const tasa = apIva ? parseFloat(tasaIva) || 0 : 0;
  const montoIva = Math.round(subtotalConDesc * tasa) / 100;

  const total = subtotalConDesc + montoIva;

  const tc = parseFloat(tipoCambio) || 1;
  const totalMxn = moneda === "USD" ? total * tc : total;

  return { subtotal, montoDesc, subtotalConDesc, montoIva, total, totalMxn };
}

function newPartida(): PartidaLocal {
  return {
    _key: createTempKey(),
    descripcion: "",
    cantidad: "1",
    precio_unitario: "",
  };
}

function dateForInput(value: string | null | undefined) {
  if (!value) return "";
  return value.split("T")[0];
}

function addDaysForInput(days: number | null | undefined) {
  if (!days || days < 1) return "";
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateForInput(date);
}

function localDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Componente principal ──────────────────────────────────────

export default function OrdenForm({
  orden,
  clientes,
  tipos,
  condiciones,
  vendedores,
  precarga,
  tasaIvaDefault,
  aplicarIvaDefault = true,
  vigenciaDiasDefault,
  onSuccess,
  onCancel,
}: OrdenFormProps) {
  const isEditing = !!orden;

  // ── Estado del formulario ──
  const [clienteId, setClienteId] = useState(orden?.cliente_id ?? precarga?.cliente_id ?? "");
  const [tipoId, setTipoId] = useState(orden?.tipo_cotizacion_id ?? tipos[0]?.id ?? "");
  const [condicionId, setCondicionId] = useState(orden?.condicion_pago_id ?? condiciones[0]?.id ?? "");
  const [vendedorId, setVendedorId] = useState(orden?.vendedor_id ?? precarga?.vendedor_id ?? (vendedores.length === 1 ? vendedores[0].id : ""));
  const [descripcion, setDescripcion] = useState(orden?.descripcion ?? precarga?.descripcion ?? "");
  const [estatus, setEstatus] = useState<"BORRADOR" | "COTIZADO" | "VENTA">(
    orden?.estatus ?? "BORRADOR"
  );
  const [moneda, setMoneda] = useState<"MXN" | "USD">(orden?.moneda ?? "MXN");
  const [tipoCambio, setTipoCambio] = useState(
    orden?.tipo_cambio ? String(orden.tipo_cambio) : ""
  );
  const vigenciaCalculada = addDaysForInput(vigenciaDiasDefault);
  const [vigencia, setVigencia] = useState(orden ? dateForInput(orden.vigencia) : "");
  const [fechaVenta, setFechaVenta] = useState(
    dateForInput(orden?.fecha_venta)
  );
  const [apIva, setApIva] = useState(orden?.aplica_iva ?? aplicarIvaDefault);
  const [tasaIva, setTasaIva] = useState(
    orden?.tasa_iva ? String(orden.tasa_iva) : String(tasaIvaDefault)
  );
  const [descuento, setDescuento] = useState(
    orden?.descuento_porcentaje ? String(orden.descuento_porcentaje) : ""
  );
  const [descuentoDesc, setDescuentoDesc] = useState(
    orden?.descuento_descripcion ?? ""
  );
  const [notas, setNotas] = useState(orden?.notas ?? "");

  const [partidas, setPartidas] = useState<PartidaLocal[]>(() => {
    if (orden?.partidas?.length) {
      return orden.partidas.map((p) => ({
        _key: p.id,
        descripcion: p.descripcion,
        cantidad: String(p.cantidad),
        precio_unitario: String(p.precio_unitario),
      }));
    }
    // Hand-off desde un deal GANADO: primera partida con el valor estimado del deal.
    if (precarga?.valor && precarga.valor > 0) {
      return [{ _key: createTempKey(), descripcion: precarga.descripcion ?? "", cantidad: "1", precio_unitario: String(precarga.valor) }];
    }
    return [newPartida()];
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // ── Auto-completar condición al elegir cliente ──
  const handleClienteChange = useCallback(
    (id: string) => {
      setClienteId(id);
      if (id && !isEditing) {
        const cliente = clientes.find((c) => c.id === id);
        if (cliente?.condicion_pago_id) {
          setCondicionId(cliente.condicion_pago_id);
        }
      }
      if (errors.cliente_id) setErrors((p) => ({ ...p, cliente_id: "" }));
    },
    [clientes, isEditing, errors.cliente_id]
  );

  // ── Partidas ──────────────────────────────────────────────
  const addPartida = () => setPartidas((p) => [...p, newPartida()]);

  const removePartida = (key: string) =>
    setPartidas((p) => p.filter((x) => x._key !== key));

  const updatePartida = (key: string, field: keyof Omit<PartidaLocal, "_key">, value: string) =>
    setPartidas((p) =>
      p.map((x) => (x._key === key ? { ...x, [field]: value } : x))
    );

  // ── Cálculo en tiempo real ────────────────────────────────
  const preview = useMemo(
    () => calcularPreview({ partidas, descuento, apIva, tasaIva, moneda, tipoCambio }),
    [partidas, descuento, apIva, tasaIva, moneda, tipoCambio]
  );

  // ── Validación ────────────────────────────────────────────
  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!clienteId) errs.cliente_id = "Selecciona un cliente";
    if (!tipoId) errs.tipo_cotizacion_id = "Selecciona un tipo";
    if (!condicionId) errs.condicion_pago_id = "Selecciona una condición";
    if (!vendedorId) errs.vendedor_id = "Selecciona un vendedor";
    if (!descripcion.trim()) errs.descripcion = "La descripción es requerida";
    if (estatus === "VENTA" && !fechaVenta) errs.fecha_venta = "La fecha de venta es requerida";
    if (moneda === "USD" && (!tipoCambio || parseFloat(tipoCambio) <= 0))
      errs.tipo_cambio = "Ingresa el tipo de cambio";
    if (apIva && (!tasaIva || parseFloat(tasaIva) <= 0))
      errs.tasa_iva = "Ingresa la tasa de IVA";

    const pErrs: Record<string, string> = {};
    partidas.forEach((p, i) => {
      if (!p.descripcion.trim()) pErrs[`p_desc_${i}`] = "Requerido";
      if (!p.cantidad || parseFloat(p.cantidad) <= 0) pErrs[`p_cant_${i}`] = "Inválido";
      if (p.precio_unitario === "" || parseFloat(p.precio_unitario) < 0)
        pErrs[`p_precio_${i}`] = "Inválido";
    });

    if (partidas.length === 0) errs.partidas = "Agrega al menos una partida";

    return { ...errs, ...pErrs };
  };

  // ── Submit ────────────────────────────────────────────────
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
      const url = isEditing ? `/api/ordenes/${orden.id}` : "/api/ordenes";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        cliente_id: clienteId,
        tipo_cotizacion_id: tipoId,
        condicion_pago_id: condicionId,
        vendedor_id: vendedorId,
        descripcion: descripcion.trim(),
        estatus,
        moneda,
        tipo_cambio: tipoCambio ? parseFloat(tipoCambio) : null,
        fecha_venta: fechaVenta || null,
        vigencia: isEditing ? vigencia.trim() || null : null,
        aplica_iva: apIva,
        tasa_iva: apIva && tasaIva ? parseFloat(tasaIva) : null,
        descuento_porcentaje: descuento ? parseFloat(descuento) : null,
        descuento_descripcion: descuentoDesc.trim() || null,
        notas: notas.trim() || null,
        // Vínculo al deal ganado (Bloque T): solo al crear desde el hand-off.
        ...(!isEditing && precarga?.deal_id ? { deal_id: precarga.deal_id } : {}),
        partidas: partidas.map((p, i) => ({
          descripcion: p.descripcion.trim(),
          cantidad: parseFloat(p.cantidad),
          precio_unitario: parseFloat(p.precio_unitario),
          orden_display: i + 1,
        })),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const fieldErrors: FormErrors = {};
          data.details.forEach((d: { campo: string; mensaje: string }) => {
            fieldErrors[d.campo] = d.mensaje;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.error || "Error al guardar" });
        }
        return;
      }

      onSuccess(data as OrdenDetalle);
    } catch {
      setErrors({ general: "Error de conexión. Intenta de nuevo." });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Opciones para selects ─────────────────────────────────
  const clienteOpciones = clientes.map((c) => ({
    id: c.id,
    label: c.nombre,
    sublabel: c.rfc || "RFC no registrado",
  }));
  const vendedorOpciones = vendedores.map((v) => ({
    id: v.id,
    label: v.nombre,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Error general ── */}
      {errors.general && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.general}
        </div>
      )}

      {/* ══ SECCIÓN 1: Cliente + Tipo + Condición ══════════════════ */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Datos generales
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Cliente */}
          <div className="sm:col-span-2">
            <label className="label">Cliente *</label>
            <SearchableSelect
              options={clienteOpciones}
              value={clienteId}
              onChange={handleClienteChange}
              placeholder="Buscar cliente..."
              searchPlaceholder="Nombre o RFC..."
              error={!!errors.cliente_id}
            />
            {errors.cliente_id && (
              <p className="mt-1 text-xs text-red-500">{errors.cliente_id}</p>
            )}
          </div>

          {/* Tipo de cotización */}
          <div>
            <label className="label">Tipo de cotización *</label>
            <select
              className={`input ${errors.tipo_cotizacion_id ? "border-red-400" : ""}`}
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
            >
              <option value="" disabled>Selecciona...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
            {errors.tipo_cotizacion_id && (
              <p className="mt-1 text-xs text-red-500">{errors.tipo_cotizacion_id}</p>
            )}
          </div>

          {/* Condición de pago */}
          <div>
            <label className="label">Condición de pago *</label>
            <select
              className={`input ${errors.condicion_pago_id ? "border-red-400" : ""}`}
              value={condicionId}
              onChange={(e) => setCondicionId(e.target.value)}
            >
              <option value="" disabled>Selecciona...</option>
              {condiciones.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            {errors.condicion_pago_id && (
              <p className="mt-1 text-xs text-red-500">{errors.condicion_pago_id}</p>
            )}
          </div>

          {/* Vendedor */}
          <div>
            <label className="label">Vendedor *</label>
            <SearchableSelect
              options={vendedorOpciones}
              value={vendedorId}
              onChange={(id) => {
                setVendedorId(id);
                if (errors.vendedor_id) setErrors((p) => ({ ...p, vendedor_id: "" }));
              }}
              placeholder="Buscar vendedor..."
              searchPlaceholder="Nombre del vendedor..."
              error={!!errors.vendedor_id}
            />
            {errors.vendedor_id && (
              <p className="mt-1 text-xs text-red-500">{errors.vendedor_id}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="sm:col-span-2">
            <label className="label">Descripción / Proyecto *</label>
            <input
              className={`input ${errors.descripcion ? "border-red-400" : ""}`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del proyecto o cotización"
            />
            {errors.descripcion && (
              <p className="mt-1 text-xs text-red-500">{errors.descripcion}</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ SECCIÓN 2: Moneda + Estatus ══════════════════════════════ */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Moneda y estatus
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Moneda */}
          <div>
            <label className="label">Moneda *</label>
            <select
              className="input"
              value={moneda}
              onChange={(e) => {
                setMoneda(e.target.value as "MXN" | "USD");
                if (e.target.value === "MXN") setTipoCambio("");
              }}
            >
              <option value="MXN">MXN — Pesos mexicanos</option>
              <option value="USD">USD — Dólares americanos</option>
            </select>
          </div>

          {/* Tipo de cambio (solo USD) */}
          {moneda === "USD" && (
            <div>
              <label className="label">Tipo de cambio (MXN/USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`input ${errors.tipo_cambio ? "border-red-400" : ""}`}
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
                placeholder="18.50"
              />
              {errors.tipo_cambio && (
                <p className="mt-1 text-xs text-red-500">{errors.tipo_cambio}</p>
              )}
            </div>
          )}

          {/* Estatus */}
          <div>
            <label className="label">Estatus</label>
            <select
              className="input"
              value={estatus}
              onChange={(e) => {
                const next = e.target.value as typeof estatus;
                setEstatus(next);
                if (next === "VENTA" && !fechaVenta) {
                  setFechaVenta(localDateForInput(new Date()));
                }
                if (errors.fecha_venta) setErrors((p) => ({ ...p, fecha_venta: "" }));
              }}
            >
              <option value="BORRADOR">Borrador</option>
              <option value="COTIZADO">Cotizado</option>
              <option value="VENTA">Venta</option>
            </select>
          </div>

          {/* Vigencia */}
          <div>
            <label className="label">
              Vigencia <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            {isEditing ? (
              <input
                type="date"
                className="input"
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
              />
            ) : (
              <>
                <input type="date" className="input bg-gray-50" value={vigenciaCalculada} disabled />
                <p className="mt-1 text-xs text-gray-400">
                  Se calcula automáticamente con la configuración de empresa.
                </p>
              </>
            )}
          </div>

          {/* Fecha de venta */}
          <div>
            <label className="label">
              Fecha de venta{estatus === "VENTA" ? " *" : " (opcional)"}
            </label>
            <input
              type="date"
              className={`input ${errors.fecha_venta ? "border-red-400" : ""}`}
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
            />
            {errors.fecha_venta && (
              <p className="mt-1 text-xs text-red-500">{errors.fecha_venta}</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ SECCIÓN 3: Partidas ══════════════════════════════════════ */}
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Partidas *
          </h3>
          <button
            type="button"
            onClick={addPartida}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy/20 bg-white px-3 py-1.5 text-xs text-navy transition-colors hover:bg-navy hover:text-white sm:w-auto"
          >
            <Plus size={13} />
            Agregar partida
          </button>
        </div>

        {errors.partidas && (
          <p className="text-xs text-red-500 mb-2">{errors.partidas}</p>
        )}

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_100px_130px_104px] gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <span>Descripción</span>
            <span className="text-right">Cantidad</span>
            <span className="text-right">Precio unit.</span>
            <span className="text-right">Total</span>
          </div>
          {partidas.map((p, i) => (
            <div
              key={p._key}
              className="grid grid-cols-1 gap-2 rounded-lg border border-surface-border bg-gray-50 p-3 sm:grid-cols-[1fr_100px_130px_auto] sm:items-start"
            >
              {/* Descripción */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-400 sm:hidden">
                  Descripción
                </label>
                <input
                  className={`input text-sm py-1.5 ${errors[`p_desc_${i}`] ? "border-red-400" : ""}`}
                  value={p.descripcion}
                  onChange={(e) => updatePartida(p._key, "descripcion", e.target.value)}
                  placeholder="Descripción del producto o servicio"
                />
                {errors[`p_desc_${i}`] && (
                  <p className="mt-0.5 text-xs text-red-500">{errors[`p_desc_${i}`]}</p>
                )}
              </div>

              {/* Cantidad */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-400 sm:hidden">
                  Cantidad
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={`input text-sm py-1.5 text-right ${errors[`p_cant_${i}`] ? "border-red-400" : ""}`}
                  value={p.cantidad}
                  onChange={(e) => updatePartida(p._key, "cantidad", e.target.value)}
                  placeholder="Cant."
                />
              </div>

              {/* Precio unitario */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-400 sm:hidden">
                  Precio unit.
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`input text-sm py-1.5 text-right ${errors[`p_precio_${i}`] ? "border-red-400" : ""}`}
                  value={p.precio_unitario}
                  onChange={(e) => updatePartida(p._key, "precio_unitario", e.target.value)}
                  placeholder="Precio unit."
                />
              </div>

              {/* Total partida + botón eliminar */}
              <div className="flex items-center justify-end gap-2 sm:pt-1.5">
                <span className="text-xs font-medium text-gray-600 sm:min-w-[80px] sm:text-right">
                  {formatMoneda(
                    (parseFloat(p.cantidad) || 0) * (parseFloat(p.precio_unitario) || 0),
                    moneda
                  )}
                </span>
                {partidas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePartida(p._key)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SECCIÓN 4: Descuento + IVA ══════════════════════════════ */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Descuento e IVA
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Descuento */}
          <div>
            <label className="label">
              Descuento % <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">
              Descripción del descuento{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              className="input"
              value={descuentoDesc}
              onChange={(e) => setDescuentoDesc(e.target.value)}
              placeholder="Promo Q2, descuento especial..."
            />
          </div>

          {/* IVA */}
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy/30"
                checked={apIva}
                onChange={(e) => setApIva(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Aplicar IVA</span>
            </label>

            {apIva && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className={`input w-24 ${errors.tasa_iva ? "border-red-400" : ""}`}
                  value={tasaIva}
                  onChange={(e) => setTasaIva(e.target.value)}
                  placeholder="16.00"
                />
                <span className="text-sm text-gray-500">%</span>
                {errors.tasa_iva && (
                  <p className="text-xs text-red-500">{errors.tasa_iva}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ SECCIÓN 5: Preview de totales ═══════════════════════════ */}
      <div className="bg-gray-50 rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator size={14} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Resumen
          </h3>
        </div>

        <div className="space-y-1.5 text-sm">
          <PreviewRow label="Subtotal" value={formatMoneda(preview.subtotal, moneda)} moneda={moneda} />
          {preview.montoDesc > 0 && (
            <PreviewRow
              label={`Descuento (${descuento}%)`}
              value={`−${formatMoneda(preview.montoDesc, moneda)}`}
              moneda={moneda}
              variant="discount"
            />
          )}
          {(preview.montoDesc > 0 || apIva) && (
            <PreviewRow
              label="Subtotal con descuento"
              value={formatMoneda(preview.subtotalConDesc, moneda)}
              moneda={moneda}
            />
          )}
          {apIva && (
            <PreviewRow
              label={`IVA (${tasaIva}%)`}
              value={formatMoneda(preview.montoIva, moneda)}
              moneda={moneda}
            />
          )}
          <div className="border-t border-surface-border pt-2 mt-2">
            <PreviewRow
              label="Total"
              value={formatMoneda(preview.total, moneda)}
              moneda={moneda}
              variant="total"
            />
            {moneda === "USD" && tipoCambio && (
              <PreviewRow
                label="Equivalente MXN"
                value={`≈ ${formatMXN(preview.totalMxn)}`}
                moneda="MXN"
                variant="mxn"
              />
            )}
          </div>
        </div>
      </div>

      {/* ══ SECCIÓN 6: Notas ════════════════════════════════════════ */}
      <div>
        <label className="label">
          Notas internas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Observaciones, acuerdos especiales..."
        />
      </div>

      {/* ── Acciones ── */}
      <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-2 sm:flex sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary justify-center">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={isSaving} className="btn-primary justify-center">
          <Save size={15} />
          {isSaving
            ? "Guardando..."
            : isEditing
            ? "Guardar cambios"
            : "Crear orden"}
        </button>
      </div>
    </form>
  );
}

// ── Sub-componente: fila del resumen ──────────────────────────
function PreviewRow({
  label,
  value,
  variant = "normal",
}: {
  label: string;
  value: string;
  moneda: "MXN" | "USD";
  variant?: "normal" | "discount" | "total" | "mxn";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`text-sm ${
          variant === "total"
            ? "font-semibold text-gray-800"
            : variant === "discount"
            ? "text-gray-500"
            : variant === "mxn"
            ? "text-gray-400 text-xs"
            : "text-gray-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-medium ${
          variant === "total"
            ? "text-navy font-bold text-base"
            : variant === "discount"
            ? "text-red-500 text-sm"
            : variant === "mxn"
            ? "text-gray-400 text-xs"
            : "text-gray-800 text-sm"
        }`}
      >
        <span className="break-words text-right">{value}</span>
      </span>
    </div>
  );
}
