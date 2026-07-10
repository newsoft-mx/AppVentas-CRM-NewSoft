"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Filter, Building2, Clock, LayoutGrid, List, ArrowDownUp, Flame, CalendarClock, Search } from "lucide-react";
import {
  TEMPERATURA_META,
  TEMPERATURAS_CALIENTES,
  TEMPERATURA_RANK,
  ATENCION_META,
  ESTADO_DEAL_META,
  type DealResumen,
  type DealResultado,
  type StageResumen,
} from "@/types/crm";
import NuevoDealModal from "@/components/pipeline/NuevoDealModal";
import { formatCompacto, formatFechaHora } from "@/lib/utils";
import Toast, { ToastData } from "@/components/ui/Toast";

interface Props {
  stages: StageResumen[];
  deals: DealResumen[];
  vendedores: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  tipos: { id: string; nombre: string }[];
  canWrite: boolean;
  altas: { hoy: number; semana: number; mes: number };
}

// Estados en orden de aparición (columnas sintéticas / chips). ABIERTO se
// muestra en las columnas de etapa; el resto en columnas de estado.
const ESTADOS_ORDEN: DealResultado[] = ["ABIERTO", "SUSPENDIDO", "GANADO", "PERDIDO"];
const ESTADOS_DEFAULT: DealResultado[] = ["ABIERTO", "SUSPENDIDO"];

export default function PipelineKanban({ stages, deals, vendedores, clientes, tipos, canWrite, altas }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<DealResumen[]>(deals);
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  // Filtro multi-estado (SOL-18): unión de los estados seleccionados.
  const [estadosSel, setEstadosSel] = useState<Set<DealResultado>>(new Set(ESTADOS_DEFAULT));
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [orden, setOrden] = useState<"none" | "valor" | "temperatura" | "probabilidad" | "actividad" | "seguimiento">("none");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filtro por vendedor + tipo + búsqueda (SOL-17), ANTES del estado: sirve para
  // contar cuántos deals hay por estado en el contexto actual.
  const q = busqueda.trim().toLowerCase();
  const preEstado = useMemo(
    () =>
      items.filter(
        (d) =>
          (vendedorFiltro === "todos" || d.vendedor?.id === vendedorFiltro) &&
          (tipoFiltro === "todos" || d.tipo?.id === tipoFiltro) &&
          (!q ||
            d.nombre.toLowerCase().includes(q) ||
            (d.cliente?.nombre.toLowerCase().includes(q) ?? false) ||
            d.contactos.some((n) => n.toLowerCase().includes(q)))
      ),
    [items, vendedorFiltro, tipoFiltro, q]
  );
  // Conteo por estado (para los chips) + set final filtrado por estado.
  const countPorEstado = useMemo(() => {
    const c: Record<DealResultado, number> = { ABIERTO: 0, SUSPENDIDO: 0, GANADO: 0, PERDIDO: 0 };
    for (const d of preEstado) c[d.resultado]++;
    return c;
  }, [preEstado]);
  const filtered = useMemo(() => preEstado.filter((d) => estadosSel.has(d.resultado)), [preEstado, estadosSel]);

  function toggleEstado(est: DealResultado) {
    setEstadosSel((prev) => {
      const next = new Set(prev);
      if (next.has(est)) next.delete(est);
      else next.add(est);
      // Nunca dejar el filtro vacío: "limpiar" restablece la vista por defecto (activos).
      return next.size === 0 ? new Set(ESTADOS_DEFAULT) : next;
    });
  }

  function sortDeals(arr: DealResumen[]): DealResumen[] {
    if (orden === "none") return arr;
    const copy = [...arr];
    copy.sort((a, b) => {
      if (orden === "valor") return b.valor - a.valor;
      if (orden === "temperatura") return TEMPERATURA_RANK[b.temperatura] - TEMPERATURA_RANK[a.temperatura];
      if (orden === "probabilidad") return (b.probabilidad ?? 0) - (a.probabilidad ?? 0);
      if (orden === "seguimiento") {
        // Más urgente arriba (vencidos/próximos primero); sin seguimiento al final
        const ta = a.proximo_seguimiento ? new Date(a.proximo_seguimiento).getTime() : Infinity;
        const tb = b.proximo_seguimiento ? new Date(b.proximo_seguimiento).getTime() : Infinity;
        return ta - tb;
      }
      return b.actividades_count - a.actividades_count; // actividad
    });
    return copy;
  }

  // KPIs: siempre sobre el pipeline activo (ABIERTO), independiente de los chips de estado.
  const activosKpi = preEstado.filter((d) => d.resultado === "ABIERTO");
  const valorTotal = activosKpi.reduce((s, d) => s + d.valor, 0);
  const calientes = activosKpi.filter((d) => TEMPERATURAS_CALIENTES.includes(d.temperatura)).length;
  const promedio = activosKpi.length ? valorTotal / activosKpi.length : 0;

  // Deals visibles según el filtro de estado.
  const activos = filtered.filter((d) => d.resultado === "ABIERTO");
  const dealsByStage = (stageId: string) => sortDeals(activos.filter((d) => d.stage_id === stageId));
  // Deals de un estado no-abierto → columna sintética.
  const dealsDeEstado = (est: DealResultado) => sortDeals(filtered.filter((d) => d.resultado === est));
  // Motivos de perdidos en el set filtrado (SOL-06 preservado como strip).
  const perdidosFiltrados = filtered.filter((d) => d.resultado === "PERDIDO");
  const motivosPerdida = Object.entries(
    perdidosFiltrados.reduce((acc, p) => {
      const k = p.razon_perdida ?? "Sin motivo";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);
  // Estados no-abiertos a mostrar como columnas sintéticas (según selección).
  const estadosSinteticos = (["SUSPENDIDO", "GANADO", "PERDIDO"] as DealResultado[]).filter(
    (est) => estadosSel.has(est) && filtered.some((d) => d.resultado === est)
  );
  const hayColumnas = (estadosSel.has("ABIERTO") && activos.length > 0) || estadosSinteticos.length > 0;

  async function moverDeal(dealId: string, nuevoStageId: string) {
    const prev = items;
    const deal = items.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === nuevoStageId) return;

    // Optimista: mover y reiniciar días en etapa
    setItems((cur) =>
      cur.map((d) =>
        d.id === dealId ? { ...d, stage_id: nuevoStageId, dias_en_etapa: 0 } : d
      )
    );

    try {
      const res = await fetch(`/api/crm/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: nuevoStageId }),
      });
      if (!res.ok) throw new Error("fallo");
    } catch {
      setItems(prev); // revertir
      setToast({ type: "error", message: "No se pudo mover el deal. Intenta de nuevo." });
    }
  }

  return (
    <div className="flex h-full flex-col">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {/* Topbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy">Pipeline CRM</h1>
          <p className="text-xs text-gray-400">Prospectos activos</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Leyenda de temperatura */}
          <div className="hidden items-center gap-3 lg:flex">
            {(["MUY_CALIENTE", "CALIENTE", "TIBIO", "FRIO", "MUY_FRIO"] as const).map(
              (t) => (
                <span key={t} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: TEMPERATURA_META[t].color }}
                  />
                  {TEMPERATURA_META[t].label}
                </span>
              )
            )}
          </div>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-navy outline-none"
          >
            <option value="todos">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          <select
            value={vendedorFiltro}
            onChange={(e) => setVendedorFiltro(e.target.value)}
            className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-navy outline-none"
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
          {/* Buscador (SOL-17): deal, cliente o contacto; se combina con los filtros */}
          <div className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-white px-2.5 py-1.5 focus-within:border-orange">
            <Search size={14} className="shrink-0 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar deal, cliente o contacto…"
              className="w-48 bg-transparent text-sm text-navy outline-none placeholder:text-gray-400"
            />
          </div>
          {/* Toggle tablero / lista */}
          <div className="flex overflow-hidden rounded-lg border border-surface-border">
            <button
              onClick={() => setVista("tablero")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${vista === "tablero" ? "bg-navy text-white" : "text-gray-500 hover:bg-surface"}`}
              title="Vista tablero"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setVista("lista")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold ${vista === "lista" ? "bg-navy text-white" : "text-gray-500 hover:bg-surface"}`}
              title="Vista lista"
            >
              <List size={14} />
            </button>
          </div>
          {canWrite && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90"
            >
              <Plus size={16} /> Nuevo Deal
            </button>
          )}
        </div>
      </header>

      {/* Barra de KPIs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-surface-border bg-white px-6 py-4">
        <Kpi label="Valor del pipeline" value={`${formatCompacto(valorTotal)} MXN`} big />
        <div className="h-9 w-px bg-borde" />
        <Kpi label="Deals activos" value={String(activos.length)} />
        <Kpi label={<span className="inline-flex items-center gap-1"><Flame size={11} className="text-orange" /> Calientes</span>} value={String(calientes)} />
        <Kpi label="Promedio deal" value={formatCompacto(promedio)} />
        <div className="h-9 w-px bg-borde" />
        {/* Altas por período (REQ-04) */}
        <Kpi label="Nuevos hoy" value={String(altas.hoy)} />
        <Kpi label="Esta semana" value={String(altas.semana)} />
        <Kpi label="Este mes" value={String(altas.mes)} />
        <div className="ml-auto flex items-center gap-2">
          {/* Filtro multi-estado (SOL-18): chips unión activo/pausado/ganado/perdido */}
          <div className="flex items-center gap-1">
            {ESTADOS_ORDEN.map((est) => {
              const meta = ESTADO_DEAL_META[est];
              const on = estadosSel.has(est);
              return (
                <button
                  key={est}
                  onClick={() => toggleEstado(est)}
                  className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors"
                  style={
                    on
                      ? { borderColor: meta.color, color: meta.color, background: `${meta.color}14` }
                      : { borderColor: "var(--surface-border, #E5E7EB)", color: "#9CA3AF" }
                  }
                  title={`${on ? "Ocultar" : "Mostrar"} ${meta.label.toLowerCase()}s`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label} ({countPorEstado[est]})
                </button>
              );
            })}
          </div>
          <ArrowDownUp size={14} className="text-gray-400" />
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as typeof orden)}
            className="rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy outline-none"
          >
            <option value="none">Orden por defecto</option>
            <option value="valor">Mayor valor</option>
            <option value="temperatura">Más calientes</option>
            <option value="probabilidad">Mayor probabilidad</option>
            <option value="actividad">Más actividad</option>
            <option value="seguimiento">Próximo seguimiento</option>
          </select>
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Filter size={14} /> {stages.length} etapas</span>
        </div>
      </div>

      {/* Strip de motivos de pérdida (SOL-06): visible cuando hay perdidos en el filtro */}
      {perdidosFiltrados.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-white px-6 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Motivos de pérdida</span>
          {motivosPerdida.map(([razon, n]) => (
            <span key={razon} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {razon} <span className="rounded-full bg-red-100 px-1.5">{n}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tablero Kanban */}
      {vista === "tablero" && (
      <div className="flex-1 overflow-x-auto bg-surface px-6 py-5">
        {!hayColumnas ? (
          <div className="rounded-xl border border-surface-border bg-white p-12 text-center text-gray-400">Sin deals con estos filtros.</div>
        ) : (
        <div className="flex min-w-max items-start gap-3.5">
          {estadosSel.has("ABIERTO") && stages.map((stage) => {
            const stageDeals = dealsByStage(stage.id);
            const totalStage = stageDeals.reduce((s, d) => s + d.valor, 0);
            const isOver = overStage === stage.id;
            return (
              <div key={stage.id} className="flex w-60 shrink-0 flex-col">
                {/* Header de columna */}
                <div className="rounded-t-xl border border-b-0 border-surface-border bg-white px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-navy">{stage.nombre}</span>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-gray-400">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-[3px] rounded-full"
                    style={{ background: stage.color, opacity: 0.7 }}
                  />
                  <div className="mt-1.5 text-[13px] font-bold text-navy">
                    {formatCompacto(totalStage)}{" "}
                    <span className="text-[10px] font-medium text-gray-400">MXN</span>
                  </div>
                </div>
                {/* Cuerpo de columna (zona de drop) */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStage(stage.id);
                  }}
                  onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    if (dragId) moverDeal(dragId, stage.id);
                    setDragId(null);
                  }}
                  className={`flex min-h-[120px] flex-col gap-2 rounded-b-xl border border-t-0 border-surface-border p-2 transition-colors ${
                    isOver ? "bg-orange/5 ring-1 ring-inset ring-orange/40" : "bg-surface"
                  }`}
                >
                  {stageDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      draggable={canWrite}
                      onDragStart={() => setDragId(deal.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => router.push(`/pipeline/${deal.id}`)}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-gray-300">
                      Sin deals
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Columnas sintéticas por estado (pausado/ganado/perdido) — SOL-18 */}
          {estadosSinteticos.map((est) => {
            const meta = ESTADO_DEAL_META[est];
            const dealsEst = dealsDeEstado(est);
            return (
              <div key={est} className="flex w-60 shrink-0 flex-col">
                <div className="rounded-t-xl border border-b-0 border-surface-border bg-white px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-bold text-navy">
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} /> {meta.label}s
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-gray-400">{dealsEst.length}</span>
                  </div>
                  <div className="mt-1.5 h-[3px] rounded-full" style={{ background: meta.color, opacity: 0.7 }} />
                  <div className="mt-1.5 text-[13px] font-bold text-navy">
                    {formatCompacto(dealsEst.reduce((s, d) => s + d.valor, 0))}{" "}
                    <span className="text-[10px] font-medium text-gray-400">MXN</span>
                  </div>
                </div>
                <div className="flex min-h-[120px] flex-col gap-2 rounded-b-xl border border-t-0 border-surface-border bg-surface p-2">
                  {dealsEst.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      draggable={false}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                      onClick={() => router.push(`/pipeline/${deal.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
      )}

      {/* Vista lista — todos los estados seleccionados, con columna Estado (SOL-18) */}
      {vista === "lista" && (
        <div className="flex-1 overflow-auto bg-surface px-6 py-5">
          <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Deal</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Etapa</th>
                  <th className="px-4 py-3 text-center font-semibold">Temp.</th>
                  <th className="px-4 py-3 text-center font-semibold">Prob.</th>
                  <th className="px-4 py-3 text-center font-semibold">Días</th>
                  <th className="px-4 py-3 text-center font-semibold">Act.</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 font-semibold">Dueño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {sortDeals(filtered).map((d) => {
                  const t = TEMPERATURA_META[d.temperatura];
                  const est = ESTADO_DEAL_META[d.resultado];
                  return (
                    <tr key={d.id} onClick={() => router.push(`/pipeline/${d.id}`)} className="cursor-pointer hover:bg-surface">
                      <td className="px-4 py-2.5 font-semibold text-navy">{d.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{d.cliente?.nombre ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${est.color}1A`, color: est.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: est.color }} />{est.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{stages.find((s) => s.id === d.stage_id)?.nombre ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${t.color}1A`, color: t.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />{t.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{d.probabilidad ?? 0}%</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{d.dias_en_etapa}d</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{d.actividades_count}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-navy">{formatCompacto(d.valor)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{d.vendedor?.nombre ?? "Sin asignar"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Sin deals con estos filtros.</td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-surface-border bg-gray-50 font-bold text-navy">
                    <td className="px-4 py-3" colSpan={8}>Total ({filtered.length} deals)</td>
                    <td className="px-4 py-3 text-right">{formatCompacto(filtered.reduce((s, d) => s + d.valor, 0))}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {modalOpen && canWrite && (
        <NuevoDealModal
          stages={stages}
          vendedores={vendedores}
          clientes={clientes}
          tipos={tipos}
          onClose={() => setModalOpen(false)}
          onCreated={(deal) => {
            setItems((cur) => [deal, ...cur]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, big }: { label: React.ReactNode; value: string; big?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`font-bold tracking-tight text-navy ${big ? "text-2xl text-green-600" : "text-base"}`}>
        {value}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  deal: DealResumen;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const temp = TEMPERATURA_META[deal.temperatura];
  const iniciales = deal.vendedor
    ? deal.vendedor.nombre
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "—";
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-surface-border bg-white p-3 transition-shadow hover:shadow-md"
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: temp.color }}
      />
      <div className="text-[13px] font-semibold leading-tight text-navy">{deal.nombre}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
        <Building2 size={11} className="text-gray-400" />
        {deal.cliente?.nombre ?? "Sin cliente"}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-bold tracking-tight text-navy">{formatCompacto(deal.valor)}</div>
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{ background: `${temp.color}1A`, color: temp.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: temp.color }} />
          {temp.label}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock size={10} />
          {deal.dias_en_etapa === 0 ? "Hoy" : `${deal.dias_en_etapa}d en etapa`}
        </div>
        <div
          className="ml-auto flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ background: "#1B3A6B" }}
          title={deal.vendedor?.nombre ?? "Sin vendedor"}
        >
          {iniciales}
        </div>
      </div>
      {/* Estado de atención (stand-by): un seguimiento futuro deja el deal "en seguimiento"
          (verde), no en rojo. Vencido = rojo. Sin próxima acción = ámbar. */}
      <div
        className={`mt-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          ATENCION_META[deal.atencion].chip
        }`}
      >
        <CalendarClock size={10} />
        {deal.proximo_seguimiento
          ? `${ATENCION_META[deal.atencion].label} · ${formatFechaHora(deal.proximo_seguimiento)}`
          : ATENCION_META[deal.atencion].label}
      </div>
    </div>
  );
}
