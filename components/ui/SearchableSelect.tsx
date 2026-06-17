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
        <span className={`truncate flex-1 ${!selected ? "text-gray-400" : "text-gray-900"}`}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sublabel && (
                <span className="ml-2 text-xs font-mono text-gray-400">
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
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-0 overflow-hidden rounded-xl border border-surface-border bg-white shadow-lg sm:min-w-[220px]">
          {/* Buscador */}
          <div className="p-2 border-b border-surface-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20"
                placeholder={searchPlaceholder}
              />
            </div>
          </div>

          {/* Lista */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-400 text-center">Sin resultados</li>
            ) : (
              filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors
                      ${option.id === value ? "bg-navy/5 text-navy font-medium" : "text-gray-700"}`}
                  >
                    <span className="block truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="mt-0.5 block truncate font-mono text-xs text-gray-400">
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
