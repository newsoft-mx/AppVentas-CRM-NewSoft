"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { VentasTipoItem } from "@/types/reportes";

interface Props {
  data: VentasTipoItem[];
}

const COLORS = ["#E8751A", "#1B2A4A", "#22C55E", "#3B82F6", "#F59E0B", "#64748B", "#A855F7", "#14B8A6"];

function fullMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as VentasTipoItem & { percent: number };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-navy">{item.tipo}</p>
      <p className="text-gray-700">{fullMXN(item.total_mxn)}</p>
      <p className="text-xs text-gray-500">
        {item.ordenes_venta} venta{item.ordenes_venta === 1 ? "" : "s"} · {item.percent.toFixed(1)}%
      </p>
    </div>
  );
}

function shortLabel(label: string) {
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

export default function GraficoVentasPorTipo({ data }: Props) {
  const total = data.reduce((sum, item) => sum + item.total_mxn, 0);
  const chartData = data.slice(0, 8).map((item) => ({
    ...item,
    percent: total > 0 ? (item.total_mxn / total) * 100 : 0,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-navy">Distribución por línea de producto</h2>
      {chartData.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
          Sin ventas cerradas en el período
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_1fr] xl:items-center">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="total_mxn"
                nameKey="tipo"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
              >
                {chartData.map((item, index) => (
                  <Cell key={item.tipo_id} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 gap-2">
            {chartData.map((item, index) => (
              <div key={item.tipo_id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-xs font-medium text-gray-600" title={item.tipo}>
                    {shortLabel(item.tipo)}
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs font-semibold text-navy">{fullMXN(item.total_mxn)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
