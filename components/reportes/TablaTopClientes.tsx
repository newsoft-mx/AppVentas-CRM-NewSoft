"use client";

import { useState } from "react";
import type { TopClienteItem } from "@/types/reportes";
import { formatMXNEntero as formatMXN } from "@/lib/utils";
import ThOrdenable from "@/components/ui/ThOrdenable";
import {
  ordenarFilas, propsOrdenables, siguienteOrden,
  type ExtractoresOrden, type OrdenTabla,
} from "@/lib/tabla-orden";

interface Props {
  data: TopClienteItem[];
}

// Columnas ordenables (ley de tablas: toda tabla de datos ordena por encabezado).
// El ranking (#) es del dataset —top por venta— y no se reordena: identifica al cliente
// aunque la tabla se mire por otra columna.
type Col = "cliente" | "ordenes" | "ventas" | "total";
const EXTRACTORES: ExtractoresOrden<TopClienteItem, Col> = {
  cliente: (c) => c.nombre,
  ordenes: (c) => c.ordenes_totales,
  ventas: (c) => c.ordenes_venta,
  total: (c) => c.total_mxn,
};

export default function TablaTopClientes({ data }: Props) {
  const [orden, setOrden] = useState<OrdenTabla<Col>>({ campo: null, sentido: "asc" });
  const th = propsOrdenables(orden, (campo) => setOrden((o) => siguienteOrden(o, campo)));
  // El puesto del ranking viaja con la fila: ordenar por otra columna no lo re-numera.
  const filas = ordenarFilas(
    data.map((c, i) => ({ ...c, puesto: i })),
    orden,
    EXTRACTORES
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-navy mb-4">Top clientes por venta</h2>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[120px] text-gray-500 text-sm">
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
                <ThOrdenable {...th("cliente")} className="py-2 px-3 text-xs font-medium text-gray-500">Cliente</ThOrdenable>
                <ThOrdenable {...th("ordenes")} align="right" className="py-2 px-3 text-xs font-medium text-gray-500">Órdenes</ThOrdenable>
                <ThOrdenable {...th("ventas")} align="right" className="py-2 px-3 text-xs font-medium text-gray-500">Ventas</ThOrdenable>
                <ThOrdenable {...th("total")} align="right" className="py-2 px-3 text-xs font-medium text-gray-500">Total MXN</ThOrdenable>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr
                  key={c.cliente_id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                        c.puesto === 0
                          ? "bg-[#E8751A] text-white"
                          : c.puesto === 1
                          ? "bg-navy text-white"
                          : c.puesto === 2
                          ? "bg-gray-400 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.puesto + 1}
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
