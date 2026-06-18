"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Filter, Building2, Clock } from "lucide-react";
import {
  TEMPERATURA_META,
  TEMPERATURAS_CALIENTES,
  type DealResumen,
  type StageResumen,
} from "@/types/crm";

interface Props {
  stages: StageResumen[];
  deals: DealResumen[];
  vendedores: { id: string; nombre: string }[];
  canWrite: boolean;
}

// Formato compacto de monto: $1.2M / $950K / $500
function fmt(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + n.toLocaleString("es-MX");
}

export default function PipelineKanban({ stages, deals, vendedores, canWrite }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<DealResumen[]>(deals);
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      vendedorFiltro === "todos"
        ? items
        : items.filter((d) => d.vendedor?.id === vendedorFiltro),
    [items, vendedorFiltro]
  );

  // KPIs
  const valorTotal = filtered.reduce((s, d) => s + d.valor, 0);
  const calientes = filtered.filter((d) =>
    TEMPERATURAS_CALIENTES.includes(d.temperatura)
  ).length;
  const promedio = filtered.length ? valorTotal / filtered.length : 0;

  const dealsByStage = (stageId: string) =>
    filtered.filter((d) => d.stage_id === stageId);

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
          {canWrite && (
            <button
              onClick={() => alert("Crear deal — disponible en la siguiente fase")}
              className="flex items-center gap-1.5 rounded-lg bg-orange px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90"
            >
              <Plus size={16} /> Nuevo Deal
            </button>
          )}
        </div>
      </header>

      {/* Barra de KPIs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-surface-border bg-white px-6 py-4">
        <Kpi label="Valor del pipeline" value={`${fmt(valorTotal)} MXN`} big />
        <div className="h-9 w-px bg-borde" />
        <Kpi label="Deals activos" value={String(filtered.length)} />
        <Kpi label="🔥 Calientes" value={String(calientes)} />
        <Kpi label="Promedio deal" value={fmt(promedio)} />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          <Filter size={14} /> {stages.length} etapas
        </div>
      </div>

      {/* Tablero Kanban */}
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
                    {fmt(totalStage)}{" "}
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
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, big }: { label: string; value: string; big?: boolean }) {
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
        <div className="text-sm font-bold tracking-tight text-navy">{fmt(deal.valor)}</div>
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
    </div>
  );
}
