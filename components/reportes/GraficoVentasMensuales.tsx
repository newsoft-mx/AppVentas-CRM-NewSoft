"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MesVenta } from "@/types/reportes";
import { formatMXNEntero } from "@/lib/utils";

interface Props {
  data: MesVenta[];
  anoActual: number;
  anoAnterior: number;
}

function formatMXN(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-navy mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="font-medium">
            {formatMXNEntero(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function GraficoVentasMensuales({ data, anoActual, anoAnterior }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-navy mb-4">Ventas mensuales (MXN)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={formatMXN}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="square"
            iconSize={10}
            formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
          />
          <Bar dataKey="actual" name={String(anoActual)} fill="#1B2A4A" radius={[3, 3, 0, 0]} />
          <Bar dataKey="anterior" name={String(anoAnterior)} fill="#E8751A" radius={[3, 3, 0, 0]} opacity={0.55} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
