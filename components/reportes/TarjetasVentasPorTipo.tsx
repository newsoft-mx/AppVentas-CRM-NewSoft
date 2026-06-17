"use client";

import type { VentasTipoItem } from "@/types/reportes";

interface Props {
  data: VentasTipoItem[];
}

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TarjetasVentasPorTipo({ data }: Props) {
  const total = data.reduce((sum, item) => sum + item.total_mxn, 0);
  const ordenes = data.reduce((sum, item) => sum + item.ordenes_venta, 0);
  const cards = [
    { tipo_id: "total", tipo: "Total general", ordenes_venta: ordenes, total_mxn: total },
    ...data,
  ];

  if (cards.length === 1) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((item, index) => (
        <div
          key={item.tipo_id}
          className={`rounded-xl border p-4 ${
            index === 0 ? "border-navy/20 bg-navy text-white" : "border-gray-200 bg-white"
          }`}
        >
          <p className={`truncate text-xs font-semibold uppercase tracking-wide ${
            index === 0 ? "text-white/70" : "text-gray-400"
          }`}>
            {item.tipo}
          </p>
          <p className={`mt-2 break-words text-base font-bold sm:text-lg ${index === 0 ? "text-white" : "text-navy"}`}>
            {formatMXN(item.total_mxn)}
          </p>
          <p className={`mt-1 text-xs ${index === 0 ? "text-white/70" : "text-gray-500"}`}>
            {item.ordenes_venta} venta{item.ordenes_venta === 1 ? "" : "s"} cerrada{item.ordenes_venta === 1 ? "" : "s"}
          </p>
        </div>
      ))}
    </div>
  );
}
