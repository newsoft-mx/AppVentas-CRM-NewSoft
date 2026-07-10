"use client";

import { useState, useMemo, useCallback, useEffect, useTransition } from "react";
import { BarChart3, Plus, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import FiltrosBar from "./FiltrosBar";
import TablaOrdenes from "./TablaOrdenes";
import Toast, { ToastData } from "@/components/ui/Toast";
import type { OrdenResumen, FiltroOrdenes, EstatusOrden } from "@/types/ordenes";
import { calcularKpis } from "@/lib/kpis";
import { appendArrayParams, fechaFiltroOrden, matchPeriod } from "@/lib/filter-utils";
import { formatMXN } from "@/lib/utils";
import { netAmountMxn } from "@/lib/net-amounts";

interface VentasClientProps {
  initialOrdenes: OrdenResumen[];
  initialFiltros: FiltroOrdenes;
  tipos: Array<{ id: string; label: string }>;
  vendedores: Array<{ id: string; label: string }>;
  canWrite?: boolean;
}

// ── Filtrado client-side (AND combinable) ─────────────────────
function filtrarOrdenes(ordenes: OrdenResumen[], filtros: FiltroOrdenes): OrdenResumen[] {
  return ordenes.filter((o) => {
    if (filtros.estatus.length && !filtros.estatus.includes(o.estatus)) return false;
    if (filtros.cliente_id.length && !filtros.cliente_id.includes(o.cliente.id)) return false;
    if (filtros.tipo_cotizacion_id.length && !filtros.tipo_cotizacion_id.includes(o.tipo_cotizacion.id)) {
      return false;
    }
    if (filtros.vendedor_id.length && !filtros.vendedor_id.includes(o.vendedor?.id ?? "")) return false;

    if (!matchPeriod(fechaFiltroOrden(o), filtros)) return false;

    return true;
  });
}

// ── Construir query string a partir de filtros ────────────────
function filtrosToQueryString(filtros: FiltroOrdenes): string {
  const params = new URLSearchParams();
  appendArrayParams(params, "ano", filtros.ano);
  appendArrayParams(params, "q", filtros.q);
  appendArrayParams(params, "mes", filtros.mes);
  appendArrayParams(params, "estatus", filtros.estatus);
  appendArrayParams(params, "cliente_id", filtros.cliente_id);
  appendArrayParams(params, "tipo_cotizacion_id", filtros.tipo_cotizacion_id);
  appendArrayParams(params, "vendedor_id", filtros.vendedor_id);
  return params.toString();
}

export default function VentasClient({
  initialOrdenes,
  initialFiltros,
  tipos,
  vendedores,
  canWrite = true,
}: VentasClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [ordenes, setOrdenes] = useState<OrdenResumen[]>(initialOrdenes);
  const [filtros, setFiltros] = useState<FiltroOrdenes>(initialFiltros);
  const [confirmDelete, setConfirmDelete] = useState<OrdenResumen | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const clientesOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const orden of ordenes) map.set(orden.cliente.id, orden.cliente.nombre);
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [ordenes]);

  // ── Sincronizar filtros con URL ───────────────────────────────
  // Cuando los filtros cambian, actualizar la URL sin reload
  useEffect(() => {
    const qs = filtrosToQueryString(filtros);
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      router.replace(newUrl, { scroll: false });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  // ── Filtrado client-side ──────────────────────────────────────
  const ordenesFiltradas = useMemo(
    () => filtrarOrdenes(ordenes, filtros),
    [ordenes, filtros]
  );

  // ── KPIs calculados siempre del estado actual filtrado ───────
  const kpis = useMemo(() => calcularKpis(ordenesFiltradas), [ordenesFiltradas]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleFiltrosChange = useCallback((nuevos: FiltroOrdenes) => {
    setFiltros(nuevos);
  }, []);

  const handleEstatusChanged = useCallback(
    (id: string, nuevoEstatus: EstatusOrden, fechaVenta?: string) => {
      setOrdenes((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                estatus: nuevoEstatus,
                fecha_venta: fechaVenta ?? o.fecha_venta,
              }
            : o
        )
      );
    },
    []
  );

  // Descripción editada inline desde la tabla (SOL-12b) — actualizar en el estado
  const handleDescripcionChanged = useCallback((id: string, descripcion: string) => {
    setOrdenes((prev) => prev.map((o) => (o.id === id ? { ...o, descripcion } : o)));
    setToast({ type: "success", message: "Descripción actualizada." });
  }, []);

  // Orden duplicada desde la tabla — agregar al inicio y mostrar toast
  const handleDuplicated = useCallback((nuevaOrden: OrdenResumen) => {
    setOrdenes((prev) => [nuevaOrden, ...prev]);
    setToast({
      type: "success",
      message: `Orden duplicada: ${nuevaOrden.folio} (Borrador)`,
    });
  }, []);

  // Eliminar orden o cotización
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/ordenes/${confirmDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "Error al eliminar" });
        return;
      }

      setOrdenes((prev) => prev.filter((o) => o.id !== confirmDelete.id));
      setToast({
        type: "success",
        message: `Orden ${confirmDelete.folio} eliminada`,
      });
    } catch {
      setToast({ type: "error", message: "Error de conexión" });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  };

  const totalOrdenesMxn = ordenesFiltradas.reduce((sum, orden) => sum + netAmountMxn(orden), 0);

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      {/* ── Encabezado ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ordenesFiltradas.length}{" "}
            {ordenesFiltradas.length === 1 ? "orden" : "órdenes"}
            {ordenes.length !== ordenesFiltradas.length && (
              <span className="text-gray-400"> de {ordenes.length} totales</span>
            )}
          </p>
        </div>
        {canWrite && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/ventas/nueva" className="btn-primary w-full justify-center sm:w-auto">
              <Plus size={16} />
              Nueva orden
            </Link>
          </div>
        )}
      </div>

      {/* ── Resumen ── */}
      <div className="mb-6 rounded-xl border border-surface-border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <BarChart3 size={24} />
            </div>
            <div className="min-w-0">
              <p className="break-words text-xl font-bold leading-tight text-green-600 sm:text-2xl">
                {formatMXN(totalOrdenesMxn)} MXN
              </p>
              <p className="mt-0.5 text-sm text-navy">Total órdenes · sin IVA</p>
            </div>
          </div>

          <div className="hidden h-12 w-px bg-surface-border md:block" />

          <div className="grid grid-cols-3 gap-3 text-center sm:gap-6 md:text-left">
            <div>
              <p className="text-lg font-bold text-navy">{kpis.total_ordenes}</p>
              <p className="text-xs text-gray-500 sm:text-sm">Órdenes</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{kpis.ventas}</p>
              <p className="text-xs text-gray-500 sm:text-sm">Venta</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{kpis.cotizadas}</p>
              <p className="text-xs text-gray-500 sm:text-sm">Cotización</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="mb-4">
        <FiltrosBar
          filtros={filtros}
          clientes={clientesOptions}
          tipos={tipos}
          vendedores={vendedores}
          onChange={handleFiltrosChange}
        />
      </div>

      {/* ── Tabla agrupada ── */}
      <TablaOrdenes
        ordenes={ordenesFiltradas}
        defaultCollapsed={clientesOptions.length > 10}
        canWrite={canWrite}
        onEstatusChanged={handleEstatusChanged}
        onDeleteRequest={setConfirmDelete}
        onDuplicated={handleDuplicated}
        onDescripcionChanged={handleDescripcionChanged}
        onError={(mensaje) => setToast({ type: "error", message: mensaje })}
      />

      {/* ── Modal: confirmar eliminar ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in z-10">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-navy text-base">Eliminar orden</h3>
                <p className="text-sm text-gray-600 mt-1">
                  ¿Eliminar la orden{" "}
                  <strong className="font-mono text-gray-900">
                    {confirmDelete.folio}
                  </strong>
                  ?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {confirmDelete.descripcion}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="btn-secondary justify-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn-danger justify-center"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
