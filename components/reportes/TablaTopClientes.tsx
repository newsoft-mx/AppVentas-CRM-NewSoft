"use client";

import type { TopClienteItem } from "@/types/reportes";

interface Props {
  data: TopClienteItem[];
}

function formatMXN(v: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function TablaTopClientes({ data }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-navy mb-4">Top clientes por venta</h2>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[120px] text-gray-400 text-sm">
          Sin datos en el período
        </div>
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {data.map((c, i) => (
            <div key={c.cliente_id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {i + 1}. {c.nombre}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {c.ordenes_venta} ventas · {c.ordenes_totales} órdenes
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-navy">{formatMXN(c.total_mxn)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 w-8">#</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Órdenes</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Ventas</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Total MXN</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr
                  key={c.cliente_id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-[#E8751A] text-white"
                          : i === 1
                          ? "bg-navy text-white"
                          : i === 2
                          ? "bg-gray-400 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{c.ordenes_totales}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{c.ordenes_venta}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-navy">
                    {formatMXN(c.total_mxn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
