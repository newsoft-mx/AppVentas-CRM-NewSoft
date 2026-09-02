"use client";

import { useState } from "react";
import ThOrdenable from "@/components/ui/ThOrdenable";
import { ordenarFilas, propsOrdenables, siguienteOrden, type OrdenTabla } from "@/lib/tabla-orden";
import { EXTRACTORES_CONVERSION, type CampoConversion } from "@/lib/reportes-orden";
import type { ConversionTipoItem } from "@/types/reportes";

interface Props {
  data: ConversionTipoItem[];
}

function TasaBadge({ tasa }: { tasa: number }) {
  const color =
    tasa >= 70
      ? "bg-green-100 text-green-700"
      : tasa >= 40
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {tasa}%
    </span>
  );
}

export default function TablaConversionTipo({ data }: Props) {
  const [orden, setOrden] = useState<OrdenTabla<CampoConversion>>({ campo: null, sentido: "asc" });
  const th = propsOrdenables(orden, (campo) => setOrden((o) => siguienteOrden(o, campo)));

  // Sin campo elegido se respeta el orden del server (tasa descendente).
  // Sin `useMemo` a propósito: con `campo: null` ordenarFilas devuelve la MISMA referencia que
  // recibe, y el React Compiler no puede preservar una memoización cuyo resultado a veces ES
  // una de sus dependencias — abandonaba el archivo entero ("Compilation Skipped"), dejándolo
  // sin ninguna optimización. Suelto, el compilador lo memoiza solo.
  const filas = ordenarFilas(data, orden, EXTRACTORES_CONVERSION);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-navy mb-4">Conversión por tipo de cotización</h2>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[120px] text-gray-500 text-sm">
          Sin datos en el período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <ThOrdenable {...th("tipo")} className="text-xs text-gray-500">Tipo</ThOrdenable>
                <ThOrdenable {...th("total")} align="right" className="text-xs text-gray-500">Total</ThOrdenable>
                <ThOrdenable {...th("cotizadas")} align="right" className="text-xs text-gray-500">
                  Cotizadas
                </ThOrdenable>
                <ThOrdenable {...th("ventas")} align="right" className="text-xs text-gray-500">Ventas</ThOrdenable>
                <ThOrdenable {...th("tasa")} align="right" className="text-xs text-gray-500">Tasa</ThOrdenable>
                <th className="py-2 px-3 text-xs font-medium text-gray-500 w-32">Progreso</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((row) => (
                <tr
                  key={row.tipo_id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-900">{row.tipo}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{row.total}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{row.cotizadas}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{row.ventas}</td>
                  <td className="py-2.5 px-3 text-right">
                    <TasaBadge tasa={row.tasa} />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-navy h-1.5 rounded-full transition-all"
                        style={{ width: `${row.tasa}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
