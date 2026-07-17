"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TEMPERATURA_META, type AccionItem } from "@/types/crm";
import { TIPO_ACTIVIDAD_META, tituloActividad } from "@/lib/actividad-tipos";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

const MAX_CHIPS = 3;

export default function CalendarioAcciones({
  acciones,
  ahora,
  onAbrir,
}: {
  acciones: AccionItem[];
  ahora: Date;
  onAbrir: (dealId: string) => void;
}) {
  // Mes visible: arranca en el mes de "ahora"
  const [mes, setMes] = useState(() => new Date(ahora.getFullYear(), ahora.getMonth(), 1));

  // Agrupa las acciones por día (local) y ordena cada día por hora
  const porDia = useMemo(() => {
    const m = new Map<string, AccionItem[]>();
    for (const a of acciones) {
      if (!a.fecha_tarea) continue;
      const k = claveDia(new Date(a.fecha_tarea));
      const arr = m.get(k) ?? [];
      arr.push(a);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((x, y) => (x.fecha_tarea! < y.fecha_tarea! ? -1 : 1));
    }
    return m;
  }, [acciones]);

  // Grilla de 42 celdas (6 semanas) empezando el lunes de la semana del día 1
  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offset = (primero.getDay() + 6) % 7; // lunes = 0
    const inicio = new Date(primero);
    inicio.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [mes]);

  const claveHoy = claveDia(ahora);
  const cambiarMes = (delta: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const totalMes = acciones.filter(
    (a) => a.fecha_tarea && new Date(a.fecha_tarea).getMonth() === mes.getMonth() && new Date(a.fecha_tarea).getFullYear() === mes.getFullYear()
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-navy">
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </h2>
          <span className="text-xs text-gray-400">{totalMes} acciones</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => cambiarMes(-1)}
            className="rounded-lg border border-surface-border p-1.5 text-gray-500 hover:bg-surface"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMes(new Date(ahora.getFullYear(), ahora.getMonth(), 1))}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-surface"
          >
            Hoy
          </button>
          <button
            onClick={() => cambiarMes(1)}
            className="rounded-lg border border-surface-border p-1.5 text-gray-500 hover:bg-surface"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Encabezados de día */}
      <div className="grid grid-cols-7 gap-px border-y border-surface-border bg-surface-border px-6 [&>*]:bg-white">
        {DIAS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Grilla del mes */}
      <div className="grid flex-1 grid-cols-7 gap-px overflow-y-auto bg-surface-border px-6 pb-6">
        {celdas.map((d, i) => {
          const k = claveDia(d);
          const delMes = d.getMonth() === mes.getMonth();
          const esHoy = k === claveHoy;
          const items = porDia.get(k) ?? [];
          const vencido = k < claveHoy;
          return (
            <div
              key={i}
              className={`min-h-[92px] bg-white p-1.5 ${delMes ? "" : "bg-gray-50/60"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    esHoy ? "bg-orange text-white" : delMes ? "text-gray-500" : "text-gray-300"
                  }`}
                >
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="text-[10px] font-semibold text-gray-300">{items.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, MAX_CHIPS).map((a) => {
                  const Icon = TIPO_ACTIVIDAD_META[a.tipo].icon;
                  const temp = TEMPERATURA_META[a.deal.temperatura];
                  return (
                    <button
                      key={a.id}
                      onClick={() => onAbrir(a.deal.id)}
                      title={`${hora(a.fecha_tarea!)} · ${a.deal.nombre} — ${tituloActividad(a)}`}
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-surface ${
                        vencido && !esHoy ? "bg-red-50" : "bg-surface/70"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: temp.color }} />
                      <Icon size={9} className="shrink-0 text-gray-400" />
                      <span className="shrink-0 font-semibold text-gray-500">{hora(a.fecha_tarea!)}</span>
                      <span className="truncate text-gray-600">{a.deal.nombre}</span>
                    </button>
                  );
                })}
                {items.length > MAX_CHIPS && (
                  <div className="px-1 text-[10px] font-semibold text-gray-400">+{items.length - MAX_CHIPS} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
