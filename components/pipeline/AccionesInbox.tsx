"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Phone, Mail, MessageCircle, StickyNote, ListChecks } from "lucide-react";
import { TEMPERATURA_META, type AccionItem, type TipoActividad } from "@/types/crm";

const TIPO_ICON: Record<TipoActividad, typeof Phone> = {
  NOTA: StickyNote,
  LLAMADA: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SISTEMA: StickyNote,
};

type Urgencia = "alta" | "media" | "baja";
const GRUPOS: { key: Urgencia; label: string }[] = [
  { key: "alta", label: "Urgente — hoy" },
  { key: "media", label: "Esta semana" },
  { key: "baja", label: "Próximo mes" },
];
const URG_BADGE: Record<Urgencia, { label: string; cls: string }> = {
  alta: { label: "Urgente", cls: "bg-red-50 text-red-700" },
  media: { label: "Esta semana", cls: "bg-amber-50 text-amber-700" },
  baja: { label: "Próximo mes", cls: "bg-emerald-50 text-emerald-700" },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + n.toLocaleString("es-MX");
}

function urgenciaDe(fecha: string | null): Urgencia {
  if (!fecha) return "media";
  const dias = Math.floor((new Date(fecha + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (dias <= 0) return "alta";
  if (dias <= 7) return "media";
  return "baja";
}

export default function AccionesInbox({
  acciones,
  vendedores,
}: {
  acciones: AccionItem[];
  vendedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<AccionItem[]>(acciones);
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [filtro, setFiltro] = useState<"todas" | "alta" | "media" | "LLAMADA" | "EMAIL">("todas");

  const filtered = useMemo(
    () =>
      vendedorFiltro === "todos"
        ? items
        : items.filter((a) => a.deal.vendedor?.id === vendedorFiltro),
    [items, vendedorFiltro]
  );

  const conUrgenciaAll = filtered.map((a) => ({ ...a, urgencia: urgenciaDe(a.fecha_tarea) }));
  const conUrgencia = conUrgenciaAll.filter((a) => {
    if (filtro === "todas") return true;
    if (filtro === "alta" || filtro === "media") return a.urgencia === filtro;
    return a.tipo === filtro; // LLAMADA | EMAIL
  });

  const FILTROS: { key: typeof filtro; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "alta", label: "Urgente" },
    { key: "media", label: "Esta semana" },
    { key: "LLAMADA", label: "Llamadas" },
    { key: "EMAIL", label: "Emails" },
  ];
  const cuenta = {
    alta: conUrgenciaAll.filter((a) => a.urgencia === "alta").length,
    media: conUrgenciaAll.filter((a) => a.urgencia === "media").length,
    baja: conUrgenciaAll.filter((a) => a.urgencia === "baja").length,
  };

  async function completar(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((a) => a.id !== id)); // optimista
    try {
      const res = await fetch(`/api/crm/actividades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completada: true }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      alert("No se pudo completar la acción.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy">Mis acciones</h1>
          <p className="text-xs text-gray-400">
            {filtered.length} acciones pendientes ·{" "}
            {new Set(filtered.map((a) => a.deal.id)).size} deals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <Pill cls="bg-red-50 text-red-700">{cuenta.alta} urgentes</Pill>
            <Pill cls="bg-amber-50 text-amber-700">{cuenta.media} esta semana</Pill>
            <Pill cls="bg-emerald-50 text-emerald-700">{cuenta.baja} después</Pill>
          </div>
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
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-surface-border bg-white px-6 py-2.5">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              filtro === f.key
                ? "border-navy bg-navy text-white"
                : "border-surface-border text-gray-500 hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-surface px-6 py-5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ListChecks size={40} className="text-gray-200" />
            <div className="text-base font-semibold text-gray-400">Todo al día</div>
            <div className="text-sm text-gray-400">Sin acciones pendientes con este filtro.</div>
          </div>
        )}

        {GRUPOS.map((g) => {
          const grupo = conUrgencia.filter((a) => a.urgencia === g.key);
          if (grupo.length === 0) return null;
          return (
            <div key={g.key} className="mb-6">
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {g.label}
                <span className="font-medium normal-case text-gray-300">{grupo.length} acciones</span>
                <span className="h-px flex-1 bg-surface-border" />
              </div>
              <div className="space-y-1.5">
                {grupo.map((a) => {
                  const temp = TEMPERATURA_META[a.deal.temperatura];
                  const Icon = TIPO_ICON[a.tipo];
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-surface-border bg-white px-4 py-3 transition-shadow hover:shadow-sm"
                    >
                      <button
                        onClick={() => completar(a.id)}
                        title="Marcar completada"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gray-300 text-white transition-colors hover:border-orange hover:bg-emerald-500"
                      >
                        <Check size={11} className="opacity-0 hover:opacity-100" />
                      </button>
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => router.push(`/pipeline/${a.deal.id}`)}
                      >
                        <div className="text-sm font-semibold leading-snug text-navy">{a.contenido}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: temp.color }} />
                          <span className="rounded bg-surface px-1.5 py-0.5">{a.deal.nombre}</span>
                          <span className="font-bold text-navy">{fmt(a.deal.valor)}</span>
                          {a.deal.vendedor && <span className="text-gray-400">· {a.deal.vendedor.nombre}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${URG_BADGE[a.urgencia].cls}`}>
                          {URG_BADGE[a.urgencia].label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Icon size={11} /> {a.tipo.charAt(0) + a.tipo.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${cls}`}>{children}</span>;
}
