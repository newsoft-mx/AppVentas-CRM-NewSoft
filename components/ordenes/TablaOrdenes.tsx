"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Copy, Eye, FileDown, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "./StatusBadge";
import { formatFecha, formatMoneda, formatMXN } from "@/lib/utils";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";
import { fechaFiltroOrden } from "@/lib/filter-utils";
import type { EstatusOrden, OrdenResumen } from "@/types/ordenes";

type SortKey = "folio" | "descripcion" | "tipo" | "condicion" | "total" | "estatus" | "fecha";
type SortDir = "asc" | "desc";

interface TablaOrdenesProps {
  ordenes: OrdenResumen[];
  defaultCollapsed?: boolean;
  canWrite?: boolean;
  onEstatusChanged: (id: string, estatus: EstatusOrden, fechaVenta?: string) => void;
  onDeleteRequest: (orden: OrdenResumen) => void;
  onDuplicated: (nuevaOrden: OrdenResumen) => void;
  onDescripcionChanged: (id: string, descripcion: string) => void;
  onError?: (mensaje: string) => void;
}

// Descripción editable inline (SOL-12b): doble clic → textarea; Enter/blur
// guarda vía PATCH; Escape cancela. Optimista: notifica al padre al guardar.
function DescripcionEditable({
  id,
  valor,
  canWrite,
  className,
  onSaved,
  onError,
}: {
  id: string;
  valor: string;
  canWrite: boolean;
  className: string;
  onSaved: (id: string, nueva: string) => void;
  onError?: (mensaje: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  // Re-sincronizar el texto si el prop cambia. Se ajusta durante el render (patrón de React
  // para "estado derivado de una prop") en vez de en un efecto.
  const [valorPrev, setValorPrev] = useState(valor);
  if (valorPrev !== valor) {
    setValorPrev(valor);
    setTexto(valor);
  }

  if (!editando) {
    return (
      <span
        className={`${className}${canWrite ? " cursor-text rounded hover:bg-navy/5" : ""}`}
        title={canWrite ? "Doble clic para editar" : undefined}
        onDoubleClick={canWrite ? () => setEditando(true) : undefined}
      >
        {valor}
      </span>
    );
  }

  const guardar = async () => {
    const nueva = texto.trim();
    if (!nueva || nueva === valor) {
      setTexto(valor);
      setEditando(false);
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/ordenes/${id}/descripcion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: nueva }),
      });
      if (!res.ok) throw new Error();
      onSaved(id, nueva);
      setEditando(false);
    } catch {
      setTexto(valor);
      setEditando(false);
      onError?.("No se pudo guardar la descripción. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <textarea
      autoFocus
      value={texto}
      disabled={guardando}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          guardar();
        }
        if (e.key === "Escape") {
          setTexto(valor);
          setEditando(false);
        }
      }}
      rows={2}
      className="w-full resize-none rounded border border-orange bg-white px-2 py-1 text-xs text-navy outline-none"
    />
  );
}

function groupByCliente(ordenes: OrdenResumen[]) {
  const map = new Map<string, { nombre: string; ordenes: OrdenResumen[] }>();
  for (const orden of ordenes) {
    const key = orden.cliente.id;
    if (!map.has(key)) map.set(key, { nombre: orden.cliente.nombre, ordenes: [] });
    map.get(key)!.ordenes.push(orden);
  }
  return Array.from(map.entries()).map(([clienteId, data]) => ({ clienteId, ...data }));
}

function valueForSort(orden: OrdenResumen, key: SortKey) {
  switch (key) {
    case "folio":
      return orden.folio;
    case "descripcion":
      return orden.descripcion;
    case "tipo":
      return orden.tipo_cotizacion.nombre;
    case "condicion":
      return orden.condicion_pago.nombre;
    case "total":
      return netAmountMxn(orden);
    case "estatus":
      return orden.estatus;
    case "fecha":
      return new Date(fechaFiltroOrden(orden)).getTime();
  }
}

function sortOrdenes(ordenes: OrdenResumen[], key: SortKey | null, dir: SortDir) {
  if (!key) return ordenes;
  return [...ordenes].sort((a, b) => {
    const av = valueForSort(a, key);
    const bv = valueForSort(b, key);
    const result = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "es", { numeric: true });
    return dir === "asc" ? result : -result;
  });
}

function nextSort(current: { key: SortKey | null; dir: SortDir }, key: SortKey) {
  if (current.key !== key) return { key, dir: "asc" as SortDir };
  if (current.dir === "asc") return { key, dir: "desc" as SortDir };
  return { key: null, dir: "asc" as SortDir };
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey | null; dir: SortDir };
  onSort: (column: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  return (
    <th className={`${align === "right" ? "text-right" : "text-left"} px-3 py-2.5 font-medium`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-navy/5 hover:text-navy ${
          active ? "text-navy" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

export default function TablaOrdenes({
  ordenes,
  defaultCollapsed = false,
  canWrite = true,
  onEstatusChanged,
  onDeleteRequest,
  onDuplicated,
  onDescripcionChanged,
  onError,
}: TablaOrdenesProps) {
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: "asc" });
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem("ventas.collapsedGroups");
      if (saved) return new Set(JSON.parse(saved) as string[]);
    }
    if (defaultCollapsed) return new Set(groupByCliente(ordenes).map((grupo) => grupo.clienteId));
    return new Set();
  });

  const gruposBase = useMemo(() => groupByCliente(ordenes), [ordenes]);

  useEffect(() => {
    sessionStorage.setItem("ventas.collapsedGroups", JSON.stringify(Array.from(collapsed)));
  }, [collapsed]);

  const grupos = useMemo(
    () =>
      gruposBase.map((grupo) => ({
        ...grupo,
        ordenes: sortOrdenes(grupo.ordenes, sort.key, sort.dir),
      })),
    [gruposBase, sort]
  );

  const handleDuplicar = async (orden: OrdenResumen) => {
    setDuplicatingIds((prev) => new Set(prev).add(orden.id));
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/duplicar`, { method: "POST" });
      if (res.ok) onDuplicated(await res.json());
    } finally {
      setDuplicatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orden.id);
        return next;
      });
    }
  };

  const toggleGroup = (clienteId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(clienteId)) next.delete(clienteId);
      else next.add(clienteId);
      return next;
    });
  };

  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-12 text-center">
        <p className="text-base font-medium text-gray-600">Sin órdenes</p>
        <p className="mt-1 text-sm text-gray-400">No hay órdenes que coincidan con los filtros seleccionados.</p>
      </div>
    );
  }

  const grandTotal = ordenes.reduce((s, o) => s + netAmountMxn(o), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-gray-500">
          Click en encabezados para ordenar. Subtotales netos sin IVA.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            className="btn-secondary py-1.5 text-xs"
            onClick={() => setCollapsed(new Set(gruposBase.map((grupo) => grupo.clienteId)))}
          >
            Colapsar todos
          </button>
          <button
            type="button"
            className="btn-secondary py-1.5 text-xs"
            onClick={() => setCollapsed(new Set())}
          >
            Expandir todos
          </button>
        </div>
      </div>

      {grupos.map(({ clienteId, nombre, ordenes: ordenesCliente }) => {
        const subtotalCliente = ordenesCliente.reduce((s, o) => s + netAmountMxn(o), 0);
        const isCollapsed = collapsed.has(clienteId);

        return (
          <div key={clienteId} className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggleGroup(clienteId)}
              className="flex w-full flex-col items-start justify-between gap-2 border-b border-surface-border bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-2">
                {isCollapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                <span className="truncate text-sm font-semibold text-navy">{nombre}</span>
              </span>
              <span className="text-xs text-gray-500 sm:shrink-0">
                {ordenesCliente.length} orden{ordenesCliente.length === 1 ? "" : "es"} · Subtotal:{" "}
                <span className="font-medium text-gray-700">{formatMXN(subtotalCliente)} MXN</span>
              </span>
            </button>

            {!isCollapsed && (
              <>
              <div className="divide-y divide-surface-border md:hidden">
                {ordenesCliente.map((orden) => {
                  const isDuplicating = duplicatingIds.has(orden.id);
                  return (
                    <article key={orden.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="rounded bg-navy/5 px-2 py-0.5 font-mono text-xs font-semibold text-navy">
                            {orden.folio}
                          </span>
                          <DescripcionEditable
                            id={orden.id}
                            valor={orden.descripcion}
                            canWrite={canWrite}
                            className="mt-2 block line-clamp-2 text-sm font-medium text-gray-800"
                            onSaved={onDescripcionChanged}
                            onError={onError}
                          />
                        </div>
                        <StatusBadge
                          ordenId={orden.id}
                          estatus={orden.estatus}
                          readOnly={!canWrite}
                          onChanged={(nuevoEstatus, fechaVenta) => onEstatusChanged(orden.id, nuevoEstatus, fechaVenta)}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                        <div>
                          <p className="font-medium uppercase tracking-wide text-gray-400">Tipo</p>
                          <p className="mt-0.5 text-gray-700">{orden.tipo_cotizacion.nombre}</p>
                        </div>
                        <div>
                          <p className="font-medium uppercase tracking-wide text-gray-400">Condición</p>
                          <p className="mt-0.5 text-gray-700">{orden.condicion_pago.nombre}</p>
                        </div>
                        <div>
                          <p className="font-medium uppercase tracking-wide text-gray-400">Fecha</p>
                          <p className="mt-0.5 text-gray-700">{formatFecha(orden.fecha_venta ?? orden.created_at)}</p>
                        </div>
                        <div>
                          <p className="font-medium uppercase tracking-wide text-gray-400">Total</p>
                          <p className="mt-0.5 font-semibold text-gray-900">
                            {formatMoneda(netAmount(orden), orden.moneda)}{" "}
                            <span className="font-normal text-gray-400">{orden.moneda}</span>
                          </p>
                          {orden.moneda === "USD" && (
                            <p className="mt-0.5 text-gray-400">≈ {formatMXN(netAmountMxn(orden))}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1.5">
                        <Link href={`/ventas/${orden.id}`} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-navy/5 hover:text-navy" title="Ver detalle">
                          <Eye size={16} />
                        </Link>
                        <a href={`/api/pdf/${orden.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600" title="Descargar PDF">
                          <FileDown size={16} />
                        </a>
                        {canWrite && (
                          <>
                            <button type="button" onClick={() => handleDuplicar(orden)} disabled={isDuplicating} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-orange/5 hover:text-orange disabled:opacity-50" title="Duplicar orden">
                              {isDuplicating ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                            </button>
                            <button type="button" onClick={() => onDeleteRequest(orden)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Eliminar orden">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-gray-500">
                      <SortHeader label="Folio" column="folio" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <SortHeader label="Descripción" column="descripcion" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <SortHeader label="Tipo" column="tipo" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <SortHeader label="Condición" column="condicion" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <SortHeader label="Total" column="total" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} align="right" />
                      <SortHeader label="Estatus" column="estatus" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <SortHeader label="Fecha" column="fecha" sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />
                      <th className="px-5 py-2.5 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {ordenesCliente.map((orden) => {
                      const isDuplicating = duplicatingIds.has(orden.id);
                      return (
                        <tr key={orden.id} className="transition-colors hover:bg-gray-50/50">
                          <td className="px-5 py-3">
                            <span className="rounded bg-navy/5 px-2 py-0.5 font-mono text-xs font-semibold text-navy">
                              {orden.folio}
                            </span>
                          </td>
                          <td className="max-w-[200px] px-3 py-3 text-gray-700">
                            <DescripcionEditable
                              id={orden.id}
                              valor={orden.descripcion}
                              canWrite={canWrite}
                              className="line-clamp-2 block text-xs"
                              onSaved={onDescripcionChanged}
                              onError={onError}
                            />
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{orden.tipo_cotizacion.nombre}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{orden.condicion_pago.nombre}</td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-xs font-medium text-gray-800">
                              {formatMoneda(netAmount(orden), orden.moneda)}{" "}
                              <span className="font-normal text-gray-400">{orden.moneda}</span>
                            </span>
                            {orden.moneda === "USD" && (
                              <p className="mt-0.5 text-xs text-gray-400">≈ {formatMXN(netAmountMxn(orden))}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              ordenId={orden.id}
                              estatus={orden.estatus}
                              readOnly={!canWrite}
                              onChanged={(nuevoEstatus, fechaVenta) => onEstatusChanged(orden.id, nuevoEstatus, fechaVenta)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                            {formatFecha(orden.fecha_venta ?? orden.created_at)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link href={`/ventas/${orden.id}`} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-navy/5 hover:text-navy" title="Ver detalle">
                                <Eye size={14} />
                              </Link>
                              <a href={`/api/pdf/${orden.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600" title="Descargar PDF">
                                <FileDown size={14} />
                              </a>
                              {canWrite && (
                                <>
                                  <button type="button" onClick={() => handleDuplicar(orden)} disabled={isDuplicating} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-orange/5 hover:text-orange disabled:opacity-50" title="Duplicar orden">
                                    {isDuplicating ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                                  </button>
                                  <button type="button" onClick={() => onDeleteRequest(orden)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Eliminar orden">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        );
      })}

      <div className="flex justify-end rounded-xl border border-navy/10 bg-navy/5 px-5 py-3">
        <p className="text-sm font-semibold text-navy">
          Total general (MXN): <span className="text-orange">{formatMXN(grandTotal)}</span>
        </p>
      </div>
    </div>
  );
}
