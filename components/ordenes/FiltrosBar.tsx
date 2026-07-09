"use client";

import { X } from "lucide-react";
import type { FiltroOrdenes } from "@/types/ordenes";
import MultiSelect, { MultiSelectOption } from "@/components/ui/MultiSelect";

interface FiltrosBarProps {
  filtros: FiltroOrdenes;
  clientes: MultiSelectOption[];
  tipos: MultiSelectOption[];
  vendedores: MultiSelectOption[];
  onChange: (filtros: FiltroOrdenes) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
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
const ESTATUS = [
  { id: "BORRADOR", label: "Borrador" },
  { id: "COTIZADO", label: "Cotizado" },
  { id: "VENTA", label: "Venta" },
];

function toNumbers(values: string[]) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

export default function FiltrosBar({ filtros, clientes, tipos, vendedores, onChange }: FiltrosBarProps) {
  const set = <K extends keyof FiltroOrdenes>(key: K, val: FiltroOrdenes[K]) => {
    onChange({ ...filtros, [key]: val });
  };

  const hasFilters =
    filtros.ano.length > 0 ||
    filtros.q.length > 0 ||
    filtros.mes.length > 0 ||
    filtros.estatus.length > 0 ||
    filtros.cliente_id.length > 0 ||
    filtros.tipo_cotizacion_id.length > 0 ||
    filtros.vendedor_id.length > 0;

  const clearAll = () =>
    onChange({
      ano: [],
      q: [],
      mes: [],
      estatus: [],
      cliente_id: [],
      tipo_cotizacion_id: [],
      vendedor_id: [],
    });

  // Presets rápidos (SOL-09): activo cuando el filtro coincide exactamente.
  const esAnioActual =
    filtros.ano.length === 1 && filtros.ano[0] === CURRENT_YEAR && filtros.q.length === 0 && filtros.mes.length === 0;
  const esMesActual =
    filtros.ano.length === 1 && filtros.ano[0] === CURRENT_YEAR && filtros.mes.length === 1 && filtros.mes[0] === CURRENT_MONTH;
  const chipCls = (activo: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${activo ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets rápidos: un clic para ver el año o el mes actual completo (SOL-09) */}
      <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
        <button type="button" onClick={() => onChange({ ...filtros, ano: [CURRENT_YEAR], q: [], mes: [] })} className={chipCls(esAnioActual)}>
          Este año
        </button>
        <button type="button" onClick={() => onChange({ ...filtros, ano: [CURRENT_YEAR], mes: [CURRENT_MONTH], q: [] })} className={chipCls(esMesActual)}>
          Este mes
        </button>
      </div>

      <MultiSelect
        className="w-full sm:w-36"
        options={YEARS}
        value={filtros.ano.map(String)}
        onChange={(values) => set("ano", toNumbers(values))}
        placeholder="Todos los años"
        searchable={false}
      />

      <MultiSelect
        className="w-full sm:w-64"
        options={clientes}
        value={filtros.cliente_id}
        onChange={(values) => set("cliente_id", values)}
        placeholder="Todos los clientes"
        searchPlaceholder="Buscar cliente..."
      />

      <MultiSelect
        className="w-full sm:w-56"
        options={tipos}
        value={filtros.tipo_cotizacion_id}
        onChange={(values) => set("tipo_cotizacion_id", values)}
        placeholder="Todos los tipos"
        searchPlaceholder="Buscar tipo..."
      />

      <MultiSelect
        className="w-full sm:w-56"
        options={vendedores}
        value={filtros.vendedor_id}
        onChange={(values) => set("vendedor_id", values)}
        placeholder="Todos los vendedores"
        searchPlaceholder="Buscar vendedor..."
      />

      <MultiSelect
        className="w-full sm:w-44"
        options={TRIMESTRES}
        value={filtros.q.map(String)}
        onChange={(values) => onChange({ ...filtros, q: toNumbers(values), mes: [] })}
        placeholder="Todos los trimestres"
        searchable={false}
      />

      <MultiSelect
        className="w-full sm:w-44"
        options={MESES}
        value={filtros.mes.map(String)}
        onChange={(values) => onChange({ ...filtros, mes: toNumbers(values), q: [] })}
        placeholder="Todos los meses"
        searchable={false}
      />

      <MultiSelect
        className="w-full sm:w-40"
        options={ESTATUS}
        value={filtros.estatus}
        onChange={(values) => set("estatus", values as FiltroOrdenes["estatus"])}
        placeholder="Todos los estatus"
        searchable={false}
      />

      {hasFilters && (
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
  );
}
