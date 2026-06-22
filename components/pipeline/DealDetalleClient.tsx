"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MessageCircle, StickyNote,
  Building2, Trophy, Cog, ChevronDown,
} from "lucide-react";
import Modal from "@/components/ui/Modal";

const RAZONES_PERDIDA = ["Precio", "Tiempo / urgencia", "Competencia", "Sin presupuesto", "Sin respuesta", "No era el momento", "Otro"];
import {
  TEMPERATURA_META, ROL_CONTACTO_LABEL,
  type DealDetalle, type DealActividadItem, type StageResumen, type TipoActividad,
} from "@/types/crm";
// El panel de IA (DealAIPanel) está construido pero se libera en Fase 2.

interface Props {
  deal: DealDetalle;
  stages: StageResumen[];
  canWrite: boolean;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + n.toLocaleString("es-MX");
}
function fmtFull(n: number): string {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 0 });
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
function fmtHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ACT_TABS = ["Actividad", "Emails", "Llamadas", "Archivos"] as const;
const TIPO_PILLS: { tipo: TipoActividad; label: string; icon: typeof StickyNote }[] = [
  { tipo: "NOTA", label: "Nota", icon: StickyNote },
  { tipo: "LLAMADA", label: "Llamada", icon: Phone },
  { tipo: "EMAIL", label: "Email", icon: Mail },
  { tipo: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
];
const ACT_ICON: Record<TipoActividad, { icon: typeof StickyNote; color: string; bg: string }> = {
  NOTA: { icon: StickyNote, color: "#F5A623", bg: "#FFF8EB" },
  LLAMADA: { icon: Phone, color: "#1D9E75", bg: "#E8F8F2" },
  EMAIL: { icon: Mail, color: "#2A5298", bg: "#EAF0FA" },
  WHATSAPP: { icon: MessageCircle, color: "#1D9E75", bg: "#E8F8F2" },
  SISTEMA: { icon: Cog, color: "#6B7A99", bg: "#F3F5F9" },
};

export default function DealDetalleClient({ deal, stages, canWrite }: Props) {
  const router = useRouter();
  const temp = TEMPERATURA_META[deal.temperatura];
  const [actividades, setActividades] = useState<DealActividadItem[]>(deal.actividades);
  const [tab, setTab] = useState<(typeof ACT_TABS)[number]>("Actividad");
  const [tipoNueva, setTipoNueva] = useState<TipoActividad>("NOTA");
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalPerdida, setModalPerdida] = useState(false);
  const [razon, setRazon] = useState("");
  const [comentarioP, setComentarioP] = useState("");

  async function cambiarResultado(
    resultado: "GANADO" | "PERDIDO" | "SUSPENDIDO" | "ABIERTO",
    extra?: { razon_perdida?: string; comentario_perdida?: string }
  ) {
    setProcesando(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/crm/deals/${deal.id}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error");
      if (resultado === "GANADO") {
        const h = data.handoff;
        const params = new URLSearchParams();
        if (h?.cliente_id) params.set("cliente_id", h.cliente_id);
        if (h?.vendedor_id) params.set("vendedor_id", h.vendedor_id);
        if (h?.descripcion) params.set("descripcion", h.descripcion);
        if (h?.valor) params.set("valor", String(h.valor));
        params.set("deal_id", deal.id);
        router.push(`/ventas/nueva?${params.toString()}`);
      } else {
        router.push("/pipeline");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
      setProcesando(false);
    }
  }

  const actividadesFiltradas = actividades.filter((a) => {
    if (tab === "Emails") return a.tipo === "EMAIL";
    if (tab === "Llamadas") return a.tipo === "LLAMADA";
    if (tab === "Archivos") return false; // adjuntos: fase futura
    return true;
  });

  async function guardarActividad() {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/deals/${deal.id}/actividades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipoNueva, contenido: texto.trim() }),
      });
      if (!res.ok) throw new Error();
      const nueva: DealActividadItem = await res.json();
      setActividades((cur) => [nueva, ...cur]);
      setTexto("");
    } catch {
      alert("No se pudo guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Topbar */}
      <header className="flex items-center justify-between gap-3 border-b border-surface-border bg-white px-6 py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/pipeline" className="flex items-center gap-1 hover:text-navy">
            <ArrowLeft size={14} /> Pipeline
          </Link>
          <span>›</span>
          <span>{deal.stage.nombre}</span>
          <span>›</span>
          <span className="font-semibold text-navy">{deal.nombre}</span>
        </nav>
        {canWrite && (deal.resultado === "ABIERTO" || deal.resultado === "SUSPENDIDO") && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={procesando}
              className="flex items-center gap-1.5 rounded-lg bg-orange px-3.5 py-2 text-sm font-semibold text-white hover:bg-orange/90 disabled:opacity-50"
            >
              <Trophy size={15} /> {procesando ? "Procesando…" : "Cambiar estado"} <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-surface-border bg-white py-1 shadow-lg">
                <button onClick={() => cambiarResultado("GANADO")} className="block w-full px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">🏆 Ganado</button>
                <button onClick={() => { setMenuOpen(false); setRazon(""); setComentarioP(""); setModalPerdida(true); }} className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">✕ Perdido</button>
                {deal.resultado === "ABIERTO" ? (
                  <button onClick={() => cambiarResultado("SUSPENDIDO")} className="block w-full px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50">⏸ Suspender (hold)</button>
                ) : (
                  <button onClick={() => cambiarResultado("ABIERTO")} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">▶ Reactivar</button>
                )}
              </div>
            )}
          </div>
        )}
        {canWrite && (deal.resultado === "GANADO" || deal.resultado === "PERDIDO") && (
          <button
            onClick={() => cambiarResultado("ABIERTO")}
            disabled={procesando}
            className="rounded-lg border border-surface-border px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-surface disabled:opacity-50"
          >
            Reabrir deal
          </button>
        )}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[320px_1fr]">
        {/* ── IZQUIERDA: info del deal ── */}
        <aside className="overflow-y-auto border-r border-surface-border bg-white p-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${temp.color}1A`, color: temp.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: temp.color }} />
            {temp.label} · {deal.stage.nombre}
          </span>
          <h1 className="mt-2.5 text-lg font-bold leading-tight text-navy">{deal.nombre}</h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
            <Building2 size={14} className="text-gray-400" />
            {deal.cliente?.nombre ?? "Sin cliente"}
          </div>

          {/* Progreso de stages */}
          <div className="mt-4">
            <div className="flex gap-0.5">
              {stages.map((s) => (
                <div
                  key={s.id}
                  className="h-1 flex-1 rounded-full"
                  style={{
                    background:
                      s.orden < deal.stage.orden ? "#F47920"
                      : s.orden === deal.stage.orden ? temp.color
                      : "#E5E7EB",
                  }}
                />
              ))}
            </div>
          </div>

          {/* KPIs 2x2 */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <KpiCard label="Monto" value={fmt(deal.valor)} accent="orange" />
            <KpiCard label="Cierre est." value={fmtFecha(deal.fecha_cierre_estimada)} />
            <KpiCard label="Días abierto" value={`${deal.dias_abierto} días`} />
            <KpiCard label="Probabilidad" value={deal.probabilidad != null ? `${deal.probabilidad}%` : "—"} accent="green" />
          </div>

          {/* Datos del deal */}
          <Section title="Datos del deal">
            <Field label="Tipo" value={deal.tipo?.nombre ?? "—"} tag />
            {deal.setup != null && <Field label="Setup" value={`${fmtFull(deal.setup)} ${deal.moneda}`} />}
            {deal.mensualidad != null && <Field label="Mensualidad" value={`${fmtFull(deal.mensualidad)} / mes`} />}
            {deal.canal && <Field label="Canal" value={deal.canal} />}
            {deal.origen && <Field label="Origen" value={deal.origen} />}
            <Field label="Responsable" value={deal.vendedor?.nombre ?? "Sin vendedor"} />
          </Section>

          {/* Contactos */}
          <Section title="Contactos">
            {deal.contactos.length === 0 && <p className="text-xs text-gray-400">Sin contactos</p>}
            {deal.contactos.map((c) => (
              <div key={c.id} className="mb-2.5 flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                  {c.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-navy">{c.nombre}</div>
                  <div className="text-[10px] text-gray-400">{ROL_CONTACTO_LABEL[c.rol]}</div>
                  <div className="mt-1 flex gap-1.5">
                    {c.telefono && <Chip icon={Phone}>Llamar</Chip>}
                    {c.email && <Chip icon={Mail}>Email</Chip>}
                    {c.whatsapp && <Chip icon={MessageCircle}>WA</Chip>}
                  </div>
                </div>
              </div>
            ))}
          </Section>

          {/* Historial con el cliente */}
          <Section title="Historial con el cliente">
            <Field label="Proyectos ganados" value={`${deal.historial.proyectos_ganados}`} green />
            <Field label="Órdenes totales" value={`${deal.historial.ordenes_total}`} />
            <Field label="Total facturado" value={`${fmtFull(deal.historial.total_facturado)} MXN`} />
          </Section>
        </aside>

        {/* ── CENTRO: bitácora ── */}
        <section className="flex flex-col overflow-hidden bg-surface">
          <div className="flex items-center gap-1 border-b border-surface-border bg-white px-5 py-2.5">
            {ACT_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t ? "border-orange text-orange" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Compositor */}
          {canWrite && (
            <div className="border-b border-surface-border bg-white px-5 py-3">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Registrar nota, llamada, email…"
                rows={2}
                className="w-full resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-orange focus:bg-white"
              />
              <div className="mt-2 flex items-center gap-1.5">
                {TIPO_PILLS.map(({ tipo, label, icon: Icon }) => (
                  <button
                    key={tipo}
                    onClick={() => setTipoNueva(tipo)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      tipoNueva === tipo ? "border-navy bg-navy text-white" : "border-surface-border text-gray-500 hover:bg-surface"
                    }`}
                  >
                    <Icon size={11} /> {label}
                  </button>
                ))}
                <button
                  onClick={guardarActividad}
                  disabled={!texto.trim() || guardando}
                  className="ml-auto rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {actividadesFiltradas.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">Sin actividad en esta vista.</p>
            )}
            <div className="space-y-4">
              {actividadesFiltradas.map((a) => {
                const meta = ACT_ICON[a.tipo];
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-navy">{a.autor}</span>
                        <span className="ml-auto text-[11px] text-gray-400">{fmtHora(a.created_at)}</span>
                      </div>
                      <div
                        className="mt-1 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm leading-relaxed text-gray-700"
                        style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
                      >
                        {a.contenido}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {modalPerdida && (
        <Modal title="Marcar deal como perdido" onClose={() => setModalPerdida(false)} size="md">
          <div className="space-y-4">
            <div>
              <label className="label">Razón de pérdida *</label>
              <select className="input" value={razon} onChange={(e) => setRazon(e.target.value)}>
                <option value="">Selecciona…</option>
                {RAZONES_PERDIDA.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Comentarios <span className="font-normal text-gray-400">(opcional)</span></label>
              <textarea className="input" rows={3} value={comentarioP} onChange={(e) => setComentarioP(e.target.value)} placeholder="Detalle de por qué se perdió…" />
            </div>
            <div className="flex justify-end gap-2 border-t border-surface-border pt-4">
              <button onClick={() => setModalPerdida(false)} className="btn-secondary justify-center">Cancelar</button>
              <button
                onClick={() => { if (!razon) return; setModalPerdida(false); cambiarResultado("PERDIDO", { razon_perdida: razon, comentario_perdida: comentarioP }); }}
                disabled={!razon}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Marcar perdido
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "orange" | "green" }) {
  const color = accent === "orange" ? "text-orange" : accent === "green" ? "text-green-600" : "text-navy";
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-[15px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-surface-border pt-3">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, tag, green }: { label: string; value: string; tag?: boolean; green?: boolean }) {
  return (
    <div className="mb-1.5 flex items-start justify-between gap-2">
      <span className="text-[11px] text-gray-400">{label}</span>
      {tag ? (
        <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange">{value}</span>
      ) : (
        <span className={`text-right text-[11px] font-medium ${green ? "text-green-600" : "text-navy"}`}>{value}</span>
      )}
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
      <Icon size={10} /> {children}
    </span>
  );
}
