"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Filter, Building2, Clock, LayoutGrid, List, ArrowDownUp, PauseCircle, Flame, CalendarClock } from "lucide-react";
import {
  TEMPERATURA_META,
  TEMPERATURAS_CALIENTES,
  TEMPERATURA_RANK,
  ATENCION_META,
  type DealResumen,
  type StageResumen,
} from "@/types/crm";
import NuevoDealModal from "@/components/pipeline/NuevoDealModal";
import { formatCompacto, formatFechaHora } from "@/lib/utils";

interface Props {
  stages: StageResumen[];
  deals: DealResumen[];
  vendedores: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  tipos: { id: string; nombre: string }[];
  canWrite: boolean;
  altas: { hoy: number; semana: number; mes: number };
}


export default function PipelineKanban({ stages, deals, vendedores, clientes, tipos, canWrite, altas }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<DealResumen[]>(deals);
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [orden, setOrden] = useState<"none" | "valor" | "temperatura" | "probabilidad" | "actividad" | "seguimiento">("none");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter(
        (d) =>
          (vendedorFiltro === "todos" || d.vendedor?.id === vendedorFiltro) &&
          (tipoFiltro === "todos" || d.tipo?.id === tipoFiltro)
      ),
    [items, vendedorFiltro, tipoFiltro]
  );

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

  // Deals activos (en etapas) vs suspendidos (columna Pausados)
  const activos = filtered.filter((d) => d.resultado === "ABIERTO");
  const pausados = filtered.filter((d) => d.resultado === "SUSPENDIDO");

  // KPIs (solo activos)
  const valorTotal = activos.reduce((s, d) => s + d.valor, 0);
  const calientes = activos.filter((d) =>
    TEMPERATURAS_CALIENTES.includes(d.temperatura)
  ).length;
  const promedio = activos.length ? valorTotal / activos.length : 0;

  const dealsByStage = (stageId: string) =>
    sortDeals(activos.filter((d) => d.stage_id === stageId));

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
      alert("No se pudo mover el deal. Intenta de nuevo.");
    }
  }

  return (
    <div className="flex h-full flex-col">
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

      {/* Tablero Kanban */}
      {vista === "tablero" && (
      <div className="flex-1 overflow-x-auto bg-surface px-6 py-5">
        <div className="flex min-w-max items-start gap-3.5">
          {stages.map((stage) => {
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

          {/* Columna sintética: deals suspendidos (estado, no etapa) */}
          {pausados.length > 0 && (
            <div className="flex w-60 shrink-0 flex-col">
              <div className="rounded-t-xl border border-b-0 border-surface-border bg-white px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-bold text-navy"><PauseCircle size={13} className="text-[#2A5298]" /> Pausados</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-gray-400">{pausados.length}</span>
                </div>
                <div className="mt-1.5 h-[3px] rounded-full" style={{ background: "#2A5298", opacity: 0.7 }} />
                <div className="mt-1.5 text-[13px] font-bold text-navy">
                  {formatCompacto(pausados.reduce((s, d) => s + d.valor, 0))}{" "}
                  <span className="text-[10px] font-medium text-gray-400">MXN</span>
                </div>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2 rounded-b-xl border border-t-0 border-surface-border bg-surface p-2">
                {pausados.map((deal) => (
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
          )}
        </div>
      </div>
      )}

      {/* Vista lista */}
      {vista === "lista" && (
        <div className="flex-1 overflow-auto bg-surface px-6 py-5">
          <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Deal</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
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
                {sortDeals(activos).map((d) => {
                  const t = TEMPERATURA_META[d.temperatura];
                  return (
                    <tr key={d.id} onClick={() => router.push(`/pipeline/${d.id}`)} className="cursor-pointer hover:bg-surface">
                      <td className="px-4 py-2.5 font-semibold text-navy">{d.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{d.cliente?.nombre ?? "—"}</td>
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
                {activos.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin deals activos con estos filtros.</td></tr>
                )}
              </tbody>
              {activos.length > 0 && (
                <tfoot>
                  <tr className="border-t border-surface-border bg-gray-50 font-bold text-navy">
                    <td className="px-4 py-3" colSpan={7}>Total ({activos.length} deals)</td>
                    <td className="px-4 py-3 text-right">{formatCompacto(activos.reduce((s, d) => s + d.valor, 0))}</td>
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
