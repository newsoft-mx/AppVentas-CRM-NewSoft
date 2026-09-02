"use client";

import { useState, useMemo, useCallback } from "react";
import { BarChart3, Plus, AlertTriangle, Search, Download } from "lucide-react";
import Link from "next/link";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import FiltrosBar from "./FiltrosBar";
import TablaOrdenes from "./TablaOrdenes";
import Toast, { ToastData } from "@/components/ui/Toast";
import { ESTATUS_ORDEN_META, type OrdenResumen, type FiltroOrdenes, type EstatusOrden } from "@/types/ordenes";
import { calcularKpis } from "@/lib/kpis";
import { aCsv, filasDeOrdenes, nombreDeArchivo } from "@/lib/exportar-ordenes";
import { fechaFiltroOrden, matchPeriod } from "@/lib/filter-utils";
import { ORDENES_FILTROS, hayFiltrosDeOrdenes, limpiarFiltrosDeOrdenes } from "@/lib/ordenes-filtros";
import { formatMXN } from "@/lib/utils";
import { sumaNetaMxn } from "@/lib/net-amounts";
import { agruparPorCliente } from "@/lib/ranking-clientes";
import { MODOS_VISTA } from "@/lib/ventas-vista";

interface VentasClientProps {
  initialOrdenes: OrdenResumen[];
  initialFiltros: FiltroOrdenes;
  tipos: Array<{ id: string; label: string }>;
  vendedores: Array<{ id: string; label: string }>;
  canWrite?: boolean;
}

// ── Filtrado client-side (AND combinable) ─────────────────────
/**
 * Buscar por texto libre. Sobre folio, cliente y descripción: es lo que alguien tiene a mano
 * cuando le preguntan por una cotización. El folio se podía ORDENAR pero no ENCONTRAR — para
 * dar con NS00042 había que recorrer la tabla con el ojo.
 */
function buscarEnOrdenes(ordenes: OrdenResumen[], texto: string): OrdenResumen[] {
  const q = texto.trim().toLowerCase();
  if (!q) return ordenes;
  return ordenes.filter(
    (o) =>
      o.folio.toLowerCase().includes(q) ||
      o.cliente.nombre.toLowerCase().includes(q) ||
      o.descripcion.toLowerCase().includes(q)
  );
}

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

export default function VentasClient({
  initialOrdenes,
  initialFiltros,
  tipos,
  vendedores,
  canWrite = true,
}: VentasClientProps) {
  const [ordenes, setOrdenes] = useState<OrdenResumen[]>(initialOrdenes);
  /**
   * Volver a leer la lista cuando el server manda otra.
   *
   * La página pre-filtra en el servidor por período, así que al AMPLIAR un filtro el server
   * devuelve más órdenes… y este estado se quedaba con la foto vieja para siempre: no había
   * efecto, ni `key`, ni refetch que lo volviera a leer. Medido: entrando con ?mes=3 se ve 1
   * orden, se aprieta "Limpiar todo" y se siguen viendo 1 —y el encabezado dice "1 orden",
   * como si ese fuera el total— hasta que alguien recarga con F5 y aparecen las 4.
   *
   * Los KPIs y el ranking salen de esta misma lista, así que también quedaban calculados sobre
   * un universo incompleto. Y el buscador, sobre una lista recortada, contesta "no existe"
   * cuando la orden sí existe.
   *
   * Se ajusta DURANTE el render —el patrón de React para estado derivado de una prop, el mismo
   * que usa `AccionesInbox`— y no en un efecto, que agregaría un render extra con la lista
   * desactualizada.
   */
  const [ordenesPrev, setOrdenesPrev] = useState(initialOrdenes);
  if (initialOrdenes !== ordenesPrev) {
    setOrdenesPrev(initialOrdenes);
    setOrdenes(initialOrdenes);
  }
  // Filtros persistentes en la URL (mecanismo compartido — pilar 3)
  const [filtros, setFiltros] = useUrlFilters(initialFiltros, ORDENES_FILTROS);
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

  /**
   * Búsqueda por texto. Estado local, igual que en Clientes.
   *
   * NO viaja en la URL ni se recuerda entre visitas: es texto transitorio, y un buscador que
   * se recuerda se convierte en un filtro invisible que sigue al usuario sin que se dé cuenta
   * de por qué le faltan filas. Es el mismo criterio con el que el Pipeline excluye su `q` de
   * la memoria (`lib/pipeline-filtros.ts`).
   */
  const [busqueda, setBusqueda] = useState("");

  // ── Filtrado client-side ──────────────────────────────────────
  const ordenesFiltradas = useMemo(
    () => buscarEnOrdenes(filtrarOrdenes(ordenes, filtros), busqueda),
    [ordenes, filtros, busqueda]
  );

  /**
   * Exportar lo que está en pantalla.
   *
   * Se arma en el navegador a partir de `ordenesFiltradas`, y eso es una garantía, no un
   * atajo: el archivo NO PUEDE discrepar de la tabla, porque son la misma lista. Un endpoint
   * aparte tendría que reconstruir los mismos filtros y podría desincronizarse.
   *
   * Tampoco filtra nada de más: el server ya mandó solo lo que esta sesión puede ver
   * (`scopeOrdenWhere` en la página), así que acá no hay a qué escaparse.
   */
  const exportar = () => {
    const csv = aCsv(filasDeOrdenes(ordenesFiltradas));
    // El BOM es lo que hace que Excel abra los acentos bien en Windows.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreDeArchivo(new Date().toISOString());
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── KPIs calculados siempre del estado actual filtrado ───────
  const kpis = useMemo(() => calcularKpis(ordenesFiltradas), [ordenesFiltradas]);

  // El ranking sale del MISMO helper que "Top clientes" de Reportes. `incluirSinVenta: true`
  // porque acá la tabla muestra todas las órdenes: esconder al cliente que solo tiene
  // cotizaciones haría desaparecer filas que el usuario está viendo.
  const gruposBase = useMemo(
    () => agruparPorCliente(ordenesFiltradas, { incluirSinVenta: true }),
    [ordenesFiltradas]
  );

  // ── Handlers ─────────────────────────────────────────────────

  // setFiltros es el setter de useState (estable), pero el linter pide declararlo.
  const handleFiltrosChange = useCallback((nuevos: FiltroOrdenes) => {
    setFiltros(nuevos);
  }, [setFiltros]);

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
      // La cuarta copia de la etiqueta vivía acá, escrita a mano. Y de paso: el estatus lo
      // dice el server, no lo adivina el cliente.
      message: `Orden duplicada: ${nuevaOrden.folio} (${ESTATUS_ORDEN_META[nuevaOrden.estatus].label})`,
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

  const totalOrdenesMxn = sumaNetaMxn(ordenesFiltradas).mxn;

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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar folio, cliente o descripción…"
              aria-label="Buscar órdenes"
              className="input w-full pl-9"
            />
          </div>
          <button
            type="button"
            onClick={exportar}
            disabled={ordenesFiltradas.length === 0}
            className="btn-secondary justify-center disabled:cursor-not-allowed disabled:opacity-50"
            title="Descarga las órdenes que estás viendo"
          >
            <Download size={15} />
            Exportar
          </button>
          {/* Agrupar/desagrupar. Vive en los filtros, así que viaja en la URL (se comparte) y
              la cookie de memoria lo recuerda para la próxima visita. */}
          <div
            role="group"
            aria-label="Vista de la lista"
            className="inline-flex overflow-hidden rounded-lg border border-surface-border"
          >
            {MODOS_VISTA.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={filtros.vista === m}
                onClick={() => setFiltros({ ...filtros, vista: m })}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filtros.vista === m
                    ? "bg-navy text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-navy"
                }`}
              >
                {m === "agrupado" ? "Por cliente" : "Lista"}
              </button>
            ))}
          </div>
          {canWrite && (
            <Link href="/ventas/nueva" className="btn-primary w-full justify-center sm:w-auto">
              <Plus size={16} />
              Nueva orden
            </Link>
          )}
        </div>
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

      {/* ── Tabla: agrupada por cliente o lista plana ── */}
      {/* `hayFiltros` exige que además HAYA datos: con la lista vacía de verdad, culpar al
          filtro sería igual de falso que el texto que este PR viene a sacar. */}
      <TablaOrdenes
        ordenes={ordenesFiltradas}
        gruposBase={gruposBase}
        modo={filtros.vista}
        defaultCollapsed={clientesOptions.length > 10}
        canWrite={canWrite}
        onEstatusChanged={handleEstatusChanged}
        onDeleteRequest={setConfirmDelete}
        onDuplicated={handleDuplicated}
        onDescripcionChanged={handleDescripcionChanged}
        onError={(mensaje) => setToast({ type: "error", message: mensaje })}
        hayFiltros={hayFiltrosDeOrdenes(filtros) && ordenes.length > 0}
        onLimpiarFiltros={() => setFiltros(limpiarFiltrosDeOrdenes(filtros))}
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
