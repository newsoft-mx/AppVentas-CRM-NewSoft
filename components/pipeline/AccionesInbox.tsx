"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Toast, { ToastData } from "@/components/ui/Toast";
import {
  Phone, Mail, MessageCircle, StickyNote, ListChecks, CalendarClock, ChevronRight,
  LayoutList, CalendarDays,
} from "lucide-react";
import {
  TEMPERATURA_META, ESTADO_ACCION_META, ESTADO_ACCION_CICLO, GRUPO_URGENCIA_META,
  type AccionItem, type TipoActividad, type EstadoAccion, type GrupoUrgencia,
} from "@/types/crm";
import CalendarioAcciones from "@/components/pipeline/CalendarioAcciones";
import InputFechaHora from "@/components/ui/InputFechaHora";
import { formatCompacto, formatFechaHora } from "@/lib/utils";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { serializeAccionesFiltros, type AccionesFiltros } from "@/lib/acciones-filtros";
import { grupoUrgencia } from "@/lib/tareas";

const TIPO_ICON: Record<TipoActividad, typeof Phone> = {
  NOTA: StickyNote,
  LLAMADA: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SISTEMA: StickyNote,
};

const ORDEN_GRUPOS: GrupoUrgencia[] = ["VENCIDAS", "HOY", "SEMANA", "DESPUES"];

// datetime-local espera "YYYY-MM-DDTHH:mm" en hora local
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function AccionesInbox({
  acciones,
  vendedores,
  initialFiltros,
  mostrarFiltroVendedor = true,
}: {
  acciones: AccionItem[];
  vendedores: { id: string; nombre: string }[];
  initialFiltros: AccionesFiltros;
  mostrarFiltroVendedor?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AccionItem[]>(acciones);

  // Filtros persistentes en la URL (mecanismo compartido — pilar 3)
  const [filtros, setFiltros] = useUrlFilters(initialFiltros, serializeAccionesFiltros);
  const { vista, vendedor: vendedorFiltro, tipo: tipoFiltro, estado: estadoFiltro } = filtros;
  const setVista = (v: "lista" | "calendario") => setFiltros((f) => ({ ...f, vista: v }));
  const setVendedorFiltro = (v: string) => setFiltros((f) => ({ ...f, vendedor: v }));
  const setTipoFiltro = (v: "todos" | TipoActividad) => setFiltros((f) => ({ ...f, tipo: v }));
  const setEstadoFiltro = (v: "todos" | EstadoAccion) => setFiltros((f) => ({ ...f, estado: v }));

  const [reprogramando, setReprogramando] = useState<string | null>(null);
  const [reprogValue, setReprogValue] = useState(""); // "YYYY-MM-DDTHH:mm" del reprogramar
  const [toast, setToast] = useState<ToastData | null>(null);
  // "Ahora" debe avanzar: si el inbox queda abierto (o cruza medianoche), el
  // agrupamiento Vencidas/Hoy/Semana se recalcula en vez de quedar congelado al montar.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((a) => {
        if (vendedorFiltro !== "todos" && a.deal.vendedor?.id !== vendedorFiltro) return false;
        if (tipoFiltro !== "todos" && a.tipo !== tipoFiltro) return false;
        if (estadoFiltro !== "todos" && a.estado_accion !== estadoFiltro) return false;
        return true;
      }),
    [items, vendedorFiltro, tipoFiltro, estadoFiltro]
  );

  const vencidas = useMemo(
    () => filtered.filter((a) => grupoUrgencia(a.fecha_tarea, ahora) === "VENCIDAS").length,
    [filtered, ahora]
  );

  // Cicla el estado: PENDIENTE → EN_PROCESO → TERMINADO. Al terminar, sale del listado.
  async function ciclarEstado(a: AccionItem) {
    const idx = ESTADO_ACCION_CICLO.indexOf(a.estado_accion);
    const siguiente = ESTADO_ACCION_CICLO[(idx + 1) % ESTADO_ACCION_CICLO.length];
    const prev = items;
    setItems((cur) =>
      siguiente === "TERMINADO"
        ? cur.filter((x) => x.id !== a.id)
        : cur.map((x) => (x.id === a.id ? { ...x, estado_accion: siguiente } : x))
    );
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_accion: siguiente }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      setToast({ type: "error", message: "No se pudo actualizar el estado." });
    }
  }

  async function reprogramar(a: AccionItem, nuevoLocal: string) {
    setReprogramando(null);
    if (!nuevoLocal) return;
    const iso = new Date(nuevoLocal).toISOString();
    const prev = items;
    setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, fecha_tarea: iso } : x)));
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_tarea: iso }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      setToast({ type: "error", message: "No se pudo reprogramar." });
    }
  }

  const FILTROS_TIPO: { key: typeof tipoFiltro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "LLAMADA", label: "Llamadas" },
    { key: "EMAIL", label: "Emails" },
    { key: "WHATSAPP", label: "WhatsApp" },
    { key: "NOTA", label: "Notas" },
  ];
  const FILTROS_ESTADO: { key: typeof estadoFiltro; label: string }[] = [
    { key: "todos", label: "Todos los estados" },
    { key: "PENDIENTE", label: "Pendiente" },
    { key: "EN_PROCESO", label: "En proceso" },
  ];

  return (
    <div className="flex h-full flex-col">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy">Próximas Acciones</h1>
          <p className="text-xs text-gray-400">
            {filtered.length} pendientes · {new Set(filtered.map((a) => a.deal.id)).size} deals
            {vencidas > 0 && <span className="ml-1 font-semibold text-red-600">· {vencidas} vencidas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Lista / Calendario (SOL-13) */}
          <div className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5">
            {([
              { key: "lista", label: "Lista", icon: LayoutList },
              { key: "calendario", label: "Calendario", icon: CalendarDays },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setVista(key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  vista === key ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as typeof estadoFiltro)}
            className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-navy outline-none"
          >
            {FILTROS_ESTADO.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
          {mostrarFiltroVendedor && (
            <select
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-navy outline-none"
            >
              <option value="todos">Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-surface-border bg-white px-6 py-2.5">
        {FILTROS_TIPO.map((f) => (
          <button
            key={f.key}
            onClick={() => setTipoFiltro(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              tipoFiltro === f.key
                ? "border-navy bg-navy text-white"
                : "border-surface-border text-gray-500 hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {vista === "calendario" ? (
        <div className="flex-1 overflow-hidden bg-surface">
          <CalendarioAcciones
            acciones={filtered}
            ahora={ahora}
            onAbrir={(dealId) => router.push(`/pipeline/${dealId}`)}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto bg-surface px-6 py-5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ListChecks size={40} className="text-gray-200" />
            <div className="text-base font-semibold text-gray-400">Todo al día</div>
            <div className="text-sm text-gray-400">Sin acciones pendientes con este filtro.</div>
          </div>
        )}

        {ORDEN_GRUPOS.map((g) => {
          const grupo = filtered.filter((a) => grupoUrgencia(a.fecha_tarea, ahora) === g);
          if (grupo.length === 0) return null;
          const vencido = g === "VENCIDAS";
          return (
            <div key={g} className="mb-6">
              <div
                className={`mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide ${
                  vencido ? "text-red-600" : "text-gray-400"
                }`}
              >
                {GRUPO_URGENCIA_META[g].label}
                <span className="font-medium normal-case text-gray-300">{grupo.length} acciones</span>
                <span className="h-px flex-1 bg-surface-border" />
              </div>
              <div className="space-y-1.5">
                {grupo.map((a) => {
                  const temp = TEMPERATURA_META[a.deal.temperatura];
                  const Icon = TIPO_ICON[a.tipo];
                  const estado = ESTADO_ACCION_META[a.estado_accion];
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 transition-shadow hover:shadow-sm"
                    >
                      <button
                        onClick={() => ciclarEstado(a)}
                        title={`${estado.label} — clic para avanzar`}
                        className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                        style={{ backgroundColor: estado.dot + "22", color: estado.dot }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: estado.dot }} />
                        {estado.label}
                      </button>
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => router.push(`/pipeline/${a.deal.id}`)}
                      >
                        <div className="text-sm font-semibold leading-snug text-navy">{a.contenido}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: temp.color }} />
                          <span className="rounded bg-surface px-1.5 py-0.5">{a.deal.nombre}</span>
                          <span className="font-bold text-navy">{formatCompacto(a.deal.valor)}</span>
                          {a.contacto_nombre && <span className="text-gray-400">· {a.contacto_nombre}</span>}
                          {a.deal.vendedor && <span className="text-gray-400">· {a.deal.vendedor.nombre}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                          <Icon size={12} className="text-gray-400" />
                          {a.fecha_tarea ? formatFechaHora(a.fecha_tarea) : "Sin fecha"}
                        </span>
                        {reprogramando === a.id ? (
                          <span className="flex items-center gap-1.5">
                            <InputFechaHora autoFocus value={reprogValue} onChange={setReprogValue} />
                            <button
                              onClick={() => reprogramar(a, reprogValue)}
                              disabled={!reprogValue.includes("T") || !reprogValue.split("T")[1]}
                              className="rounded bg-navy px-2 py-1 text-[11px] font-semibold
                                text-white disabled:opacity-40"
                            >
                              Guardar
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setReprogValue(a.fecha_tarea ? toLocalInput(a.fecha_tarea) : "");
                              setReprogramando(a.id);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-orange"
                          >
                            <CalendarClock size={11} /> Reprogramar
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/pipeline/${a.deal.id}`)}
                          className="flex items-center gap-0.5 text-[10px] font-semibold text-navy hover:text-orange"
                        >
                          Abrir deal <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
