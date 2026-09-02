"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import type { VentasVendedorItem } from "@/types/reportes";
import { formatMXNEntero as formatMXN } from "@/lib/utils";
import ThOrdenable from "@/components/ui/ThOrdenable";
import { ordenarFilas, propsOrdenables, siguienteOrden, type OrdenTabla } from "@/lib/tabla-orden";
import { EXTRACTORES_VENTAS_VENDEDOR, type CampoVentasVendedor } from "@/lib/reportes-orden";

interface Props {
  data: VentasVendedorItem[];
}

export default function TablaVentasVendedor({ data }: Props) {
  const [orden, setOrden] = useState<OrdenTabla<CampoVentasVendedor>>({ campo: null, sentido: "asc" });
  const th = propsOrdenables(orden, (campo) => setOrden((o) => siguienteOrden(o, campo)));
  // Sin `useMemo` a propósito: con `campo: null` ordenarFilas devuelve la MISMA referencia que
  // recibe, y el React Compiler no puede preservar una memoización cuyo resultado a veces ES
  // una de sus dependencias — abandonaba el archivo entero ("Compilation Skipped"), dejándolo
  // sin ninguna optimización. Suelto, el compilador lo memoiza solo.
  const filas = ordenarFilas(data, orden, EXTRACTORES_VENTAS_VENDEDOR);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-green-100 p-2 text-green-700">
          <UserRound size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-navy">Ventas por vendedor</h2>
          <p className="text-xs text-gray-500">Montos netos sin IVA</p>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay ventas cerradas.</p>
      ) : (
        <>
        <div className="space-y-2 sm:hidden">
          {filas.map((row) => (
            <div key={row.vendedor_id ?? "sin-vendedor"} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{row.vendedor}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {row.ordenes_venta} venta{row.ordenes_venta === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-green-700">{formatMXN(row.total_mxn)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-lg border border-gray-100 sm:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <ThOrdenable {...th("vendedor")}>Vendedor</ThOrdenable>
                <ThOrdenable {...th("ordenes_venta")} align="right">Ventas</ThOrdenable>
                <ThOrdenable {...th("total_mxn")} align="right">Total neto</ThOrdenable>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((row) => (
                <tr key={row.vendedor_id ?? "sin-vendedor"}>
                  <td className="px-3 py-2 font-medium text-navy">{row.vendedor}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{row.ordenes_venta}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{formatMXN(row.total_mxn)}</td>
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
