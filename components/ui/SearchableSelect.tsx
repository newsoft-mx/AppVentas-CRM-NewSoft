"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  error = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Cuál opción se elige con Enter. Vuelve a la primera cada vez que cambia la búsqueda.
  const [resaltado, setResaltado] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 10);
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    close();
  };

  /**
   * Qué hace Enter dentro del buscador.
   *
   * Antes: nada propio. Y como este input vive dentro del `<form>` de la orden, Enter
   * disparaba el envío implícito del formulario ENTERO — con el cliente ANTERIOR, porque el
   * que el usuario acababa de buscar todavía no estaba elegido. O sea: el usuario abría el
   * selector para cambiar de cliente, tipeaba el nuevo, apretaba Enter esperando elegirlo, y
   * guardaba la orden con el viejo. Sin ningún aviso.
   *
   * Ahora Enter elige lo que está resaltado (por defecto, el primer resultado), y en todos los
   * casos corta el evento para que el formulario no se entere. Las flechas mueven el resaltado
   * y Escape cierra.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Se corta SIEMPRE, haya o no resultado: un Enter acá nunca debe enviar el formulario.
      e.preventDefault();
      e.stopPropagation();
      const elegida = filtered[resaltado] ?? filtered[0];
      if (elegida) handleSelect(elegida.id);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => (filtered.length ? Math.min(i + 1, filtered.length - 1) : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    close();
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={isOpen ? close : open}
        disabled={disabled}
        className={`input text-left flex items-center justify-between gap-2 w-full
          ${error ? "border-red-400 focus:ring-red-400" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate flex-1 ${!selected ? "text-gray-500" : "text-gray-900"}`}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sublabel && (
                <span className="ml-2 text-xs font-mono text-gray-500">
                  {selected.sublabel}
                </span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>

        <span className="shrink-0 flex items-center gap-1">
          {selected && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-0 overflow-hidden rounded-xl border border-surface-border bg-white shadow-lg sm:min-w-[220px]">
          {/* Buscador */}
          <div className="p-2 border-b border-surface-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setResaltado(0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                placeholder={searchPlaceholder}
              />
            </div>
          </div>

          {/* Lista */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500 text-center">Sin resultados</li>
            ) : (
              filtered.map((option, i) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    onMouseEnter={() => setResaltado(i)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors
                      ${i === resaltado ? "bg-gray-50" : ""}
                      ${option.id === value ? "bg-navy/5 text-navy font-medium" : "text-gray-700"}`}
                  >
                    <span className="block truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-gray-500">
                        {option.sublabel}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
