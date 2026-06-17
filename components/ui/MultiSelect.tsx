"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
  maxLabels?: number;
  searchable?: boolean;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  className = "",
  maxLabels = 2,
  searchable = true,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = search.trim()
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(search.toLowerCase()) ||
          option.sublabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const label = useMemo(() => {
    const selectedOptions = options.filter((option) => selected.has(option.id));
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= maxLabels) return selectedOptions.map((option) => option.label).join(", ");
    return `${selectedOptions.length} seleccionados`;
  }, [maxLabels, options, placeholder, selected]);

  const open = useCallback(() => {
    setIsOpen(true);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const selectAll = () => onChange(options.map((option) => option.id));
  const clear = () => onChange([]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close, isOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [close, isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={isOpen ? close : open}
        className={`input flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm ${
          value.length > 0 ? "border-navy/30 bg-navy/5" : ""
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${value.length ? "text-navy" : "text-gray-500"}`}>
          {label}
        </span>
        {value.length > 0 && (
          <span className="rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {value.length}
          </span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-0 overflow-hidden rounded-xl border border-surface-border bg-white shadow-lg sm:min-w-[220px]">
          {searchable && (
            <div className="border-b border-surface-border p-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-surface-border py-1.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
                  placeholder={searchPlaceholder}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-surface-border px-2 py-1.5">
            <button type="button" onClick={selectAll} className="text-xs font-medium text-navy hover:text-orange">
              Seleccionar todos
            </button>
            <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
              <X size={12} />
              Limpiar
            </button>
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-gray-400">Sin resultados</li>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.has(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => toggle(option.id)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        isSelected ? "bg-navy/5 text-navy" : "text-gray-700"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected ? "border-navy bg-navy text-white" : "border-gray-300"
                      }`}>
                        {isSelected && <Check size={11} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.sublabel && (
                          <span className="mt-0.5 block truncate font-mono text-xs text-gray-400">
                            {option.sublabel}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
