"use client";

import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import MultiSelect from "@/components/ui/MultiSelect";
import type { FiltroReportes } from "@/types/reportes";

interface Props {
  filtros: FiltroReportes;
  onChange: (f: FiltroReportes) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => ({ id: String(CURRENT_YEAR - i), label: String(CURRENT_YEAR - i) }));
const TRIMESTRES = [
  { id: "1", label: "Q1 (Ene-Mar)" },
  { id: "2", label: "Q2 (Abr-Jun)" },
  { id: "3", label: "Q3 (Jul-Sep)" },
  { id: "4", label: "Q4 (Oct-Dic)" },
];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
].map((label, index) => ({ id: String(index + 1), label }));

function toNumbers(values: string[]) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function optionLabel(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

export default function FiltrosReportes({ filtros, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = filtros.ano.length + filtros.q.length + filtros.mes.length;

  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; onRemove: () => void }> = [];
    filtros.ano.forEach((year) => {
      items.push({
        key: `ano-${year}`,
        label: String(year),
        onRemove: () => onChange({ ...filtros, ano: filtros.ano.filter((item) => item !== year) }),
      });
    });
    filtros.q.forEach((quarter) => {
      items.push({
        key: `q-${quarter}`,
        label: optionLabel(TRIMESTRES, String(quarter)),
        onRemove: () => onChange({ ...filtros, q: filtros.q.filter((item) => item !== quarter) }),
      });
    });
    filtros.mes.forEach((month) => {
      items.push({
        key: `mes-${month}`,
        label: optionLabel(MESES, String(month)),
        onRemove: () => onChange({ ...filtros, mes: filtros.mes.filter((item) => item !== month) }),
      });
    });
    return items;
  }, [filtros, onChange]);

  const clearAll = () => onChange({ ano: [], q: [], mes: [] });

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`btn-secondary relative ${activeCount ? "border-navy/30 bg-navy/5 text-navy" : ""}`}
        >
          <Filter size={15} />
          Filtros
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <X size={13} />
            Limpiar todo
          </button>
        )}
      </div>

      {open && (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-white p-3 shadow-sm sm:w-auto">
          <MultiSelect
            className="w-full sm:w-36"
            options={YEARS}
            value={filtros.ano.map(String)}
            onChange={(values) => onChange({ ...filtros, ano: toNumbers(values) })}
            placeholder="Años"
            searchable={false}
          />
          <MultiSelect
            className="w-full sm:w-44"
            options={TRIMESTRES}
            value={filtros.q.map(String)}
            onChange={(values) => onChange({ ...filtros, q: toNumbers(values), mes: [] })}
            placeholder="Trimestres"
            searchable={false}
          />
          <MultiSelect
            className="w-full sm:w-44"
            options={MESES}
            value={filtros.mes.map(String)}
            onChange={(values) => onChange({ ...filtros, mes: toNumbers(values), q: [] })}
            placeholder="Meses"
            searchable={false}
          />
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex max-w-full flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full bg-navy/5 px-2 py-1 text-xs font-medium text-navy hover:bg-red-50 hover:text-red-600"
            >
              {chip.label}
              <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
