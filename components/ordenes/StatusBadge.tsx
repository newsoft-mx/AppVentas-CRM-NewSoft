"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { TRANSICIONES_PERMITIDAS } from "@/lib/utils";
import { mensajeDeError } from "@/lib/errores-formulario";
import { ESTATUS_ORDEN_META, type EstatusOrden } from "@/types/ordenes";

interface StatusBadgeProps {
  ordenId: string;
  estatus: EstatusOrden;
  onChanged: (nuevoEstatus: EstatusOrden, fechaVenta?: string) => void;
  readOnly?: boolean;
}

function todayForInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StatusBadge({ ordenId, estatus, onChanged, readOnly = false }: StatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFechaVenta, setShowFechaVenta] = useState(false);
  // El rechazo del server se muestra al lado de la pastilla, donde el usuario está mirando.
  const [error, setError] = useState<string | null>(null);
  const [fechaVenta, setFechaVenta] = useState(todayForInput);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const transiciones = readOnly ? [] : TRANSICIONES_PERMITIDAS[estatus] ?? [];

  useEffect(() => {
    if (!isOpen && !showFechaVenta) return;
    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, showFechaVenta]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inButton && !inDropdown) {
        setIsOpen(false);
        setShowFechaVenta(false);
      }
    };
    if (isOpen || showFechaVenta) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, showFechaVenta]);

  const handleTransition = async (nuevoEstatus: EstatusOrden, fecha?: string) => {
    setIsLoading(true);
    setIsOpen(false);
    setShowFechaVenta(false);

    try {
      const res = await fetch(`/api/ordenes/${ordenId}/estatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus: nuevoEstatus, fecha_venta: fecha ?? null }),
      });

      if (res.ok) {
        setError(null);
        onChanged(nuevoEstatus, fecha);
      } else {
        // Antes acá no había `else`: si el server rechazaba el cambio —falta la fecha de venta
        // (422), transición ilegal (409), sin permisos (403)— la pastilla volvía a su estado
        // normal y NO pasaba nada visible. El usuario creía que había marcado la venta.
        const data = await res.json().catch(() => ({}));
        setError(mensajeDeError(data, "No se pudo cambiar el estatus."));
      }
    } catch {
      setError("No se pudo conectar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = (siguiente: EstatusOrden) => {
    if (siguiente === "VENTA") {
      setShowFechaVenta(true);
      setIsOpen(false);
    } else {
      handleTransition(siguiente);
    }
  };

  if (isLoading) {
    return (
      <span className={`badge text-xs font-medium flex items-center gap-1 ${ESTATUS_ORDEN_META[estatus].chip}`}>
        <Loader2 size={11} className="animate-spin" />
        {ESTATUS_ORDEN_META[estatus].label}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* ── Badge con dropdown ── */}
      <button
        type="button"
        onClick={() => transiciones.length > 0 && setIsOpen((o) => !o)}
        className={`badge text-xs font-medium flex items-center gap-1 transition-opacity
          ${ESTATUS_ORDEN_META[estatus].chip}
          ${transiciones.length > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
      >
        {ESTATUS_ORDEN_META[estatus].label}
        {transiciones.length > 0 && (
          <ChevronDown size={11} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {typeof document !== "undefined" &&
        isOpen &&
        transiciones.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            style={menuStyle}
            className="min-w-[140px] overflow-hidden rounded-xl border border-surface-border bg-white py-1 shadow-lg"
          >
            {transiciones.map((sig) => (
              <button
                key={sig}
                type="button"
                onClick={() => handleOptionClick(sig as EstatusOrden)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                <span className={`badge text-xs font-medium ${ESTATUS_ORDEN_META[sig].chip}`}>
                  {ESTATUS_ORDEN_META[sig].label}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}

      {typeof document !== "undefined" &&
        showFechaVenta &&
        createPortal(
          <div
            ref={dropdownRef}
            style={menuStyle}
            className="w-64 rounded-xl border border-surface-border bg-white p-3 shadow-lg"
          >
            <p className="mb-2 text-xs font-medium text-gray-700">Fecha de venta</p>
            <input
              type="date"
              className="input w-full py-1.5 text-sm"
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
            />
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowFechaVenta(false)}
                className="btn-secondary flex-1 px-3 py-1 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleTransition("VENTA", fechaVenta)}
                className="btn-primary flex-1 px-3 py-1 text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* El motivo del rechazo, al lado de la pastilla que se intentó cambiar. `role="alert"`
          para que un lector de pantalla lo anuncie: quien no ve el color tampoco se entera. */}
      {error && (
        <span
          role="alert"
          className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-medium text-red-600"
        >
          <AlertCircle size={11} className="shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Descartar el aviso"
            className="rounded px-1 text-red-700 hover:bg-red-50"
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
