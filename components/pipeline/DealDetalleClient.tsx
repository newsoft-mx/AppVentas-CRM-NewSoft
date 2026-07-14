"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MessageCircle, StickyNote,
  Building2, Trophy, Cog, ChevronDown, XCircle, PauseCircle, Play, CalendarClock,
  Star, Link2, ArrowUpCircle, ChevronRight, UserPlus, Pencil, Trash2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import Termometro from "@/components/pipeline/Termometro";
import NuevoDealModal from "@/components/pipeline/NuevoDealModal";
import Markdown from "@/components/ui/Markdown";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import { formatCompacto, formatFechaHora } from "@/lib/utils";
import { MAX_CONTENIDO } from "@/lib/actividad";
import { ahoraLocal } from "@/lib/filter-utils";
import {
  TEMPERATURA_META, ROL_CONTACTO_LABEL, ESTADO_ACCION_META, ESTADO_ACCION_CICLO,
  EFECTO_META, ESTADO_PLAN_META,
  type DealDetalle, type DealActividadItem, type StageResumen, type TipoActividad,
  type Temperatura,
} from "@/types/crm";
// El panel de IA (DealAIPanel) está construido pero se libera en Fase 2.

export interface ResultadoAccionOpcion {
  id: string;
  nombre: string;
  efecto: "POSITIVO" | "NEUTRO" | "NEGATIVO";
  sugiere_reagendar: boolean;
}

export interface TipoAccionOpcion {
  id: string;
  nombre: string;
  color: string;
  agendable: boolean;
  con_resultado: boolean;
}

interface Props {
  deal: DealDetalle;
  stages: StageResumen[];
  canWrite: boolean;
  vendedores?: { id: string; nombre: string }[];
  clientes?: { id: string; nombre: string }[];
  tipos?: { id: string; nombre: string }[];
  motivos?: string[]; // catálogo de motivos de pérdida (SOL-10)
  /** Catálogo de tipos de acción (SOL-04): pills del composer */
  tiposAccion?: TipoAccionOpcion[];
  /** Catálogo de resultados de acción (SOL-04): mueven el termómetro al registrar la interacción */
  resultadosAccion?: ResultadoAccionOpcion[];
  /** ¿El score ya cruza el umbral de avance? Derivado en el server (dealScoreView). */
  sugerirAvanceInicial?: boolean;
}

// Deriva el tipo legado (para ícono/placeholder/éxito) a partir del nombre del tipo del catálogo.
function tipoLegado(nombre: string): TipoActividad {
  const n = nombre.toLowerCase();
  if (n.includes("llamad")) return "LLAMADA";
  if (n.includes("mail") || n.includes("correo")) return "EMAIL";
  if (n.includes("whats")) return "WHATSAPP";
  return "NOTA";
}

function fmtFull(n: number): string {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 0 });
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
// Saneo de teléfono para tel:/wa.me (SOL-15). tel: admite +; wa.me solo dígitos.
const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
const waHref = (t: string) => `https://wa.me/${t.replace(/\D/g, "")}`;

const FILTROS_VER: { key: "TODAS" | "NOTA" | "LLAMADA" | "EMAIL" | "WHATSAPP"; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "NOTA", label: "Notas" },
  { key: "LLAMADA", label: "Llamadas" },
  { key: "EMAIL", label: "Emails" },
  { key: "WHATSAPP", label: "WhatsApp" },
];
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
const PLACEHOLDER: Record<TipoActividad, string> = {
  NOTA: "Escribe una nota interna…",
  LLAMADA: "¿Qué pasó en la llamada?",
  EMAIL: "Pega o resume el correo…",
  WHATSAPP: "¿Qué se conversó por WhatsApp?",
  SISTEMA: "",
};

export default function DealDetalleClient({
  deal, stages, canWrite,
  vendedores = [], clientes = [], tipos = [], motivos = [],
  tiposAccion = [], resultadosAccion = [], sugerirAvanceInicial = false,
}: Props) {
  const router = useRouter();
  // Motivos del catálogo (SOL-10); si viene vacío, fallback a la lista base.
  // Los motivos vienen del catálogo MotivoPerdida (SSOT). Sin fallback hardcodeado.
  const razonesPerdida = motivos;
  const [temperatura, setTemperatura] = useState<Temperatura>(deal.temperatura);
  const temp = TEMPERATURA_META[temperatura];
  const [actividades, setActividades] = useState<DealActividadItem[]>(deal.actividades);
  const [filtroVer, setFiltroVer] = useState<"TODAS" | "NOTA" | "LLAMADA" | "EMAIL" | "WHATSAPP">("TODAS");
  const [tipoNueva, setTipoNueva] = useState<TipoActividad>("NOTA");
  const [tipoAccionSel, setTipoAccionSel] = useState<TipoAccionOpcion | null>(null);
  const [texto, setTexto] = useState("");
  // Contacto precargado por defecto: el primer contacto del deal (REQ-03)
  const [contactoSel, setContactoSel] = useState(deal.contactos[0]?.id ?? "");
  const [fechaEvento, setFechaEvento] = useState("");
  // Precargar "Cuándo ocurrió" con ahora (editable). En useEffect para evitar
  // mismatch de hidratación (new Date() difiere entre server y cliente). (SOL-03)
  useEffect(() => setFechaEvento(ahoraLocal()), []);
  const [exitosa, setExitosa] = useState(true);
  const [seguimiento, setSeguimiento] = useState("");
  const [resultadoSel, setResultadoSel] = useState("");
  const [enlace, setEnlace] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Compositor compacto por defecto: enlace + agendar se revelan al enfocar o
  // tener contenido (progressive disclosure — evita saturar la vista con opcionales).
  const [composerFocus, setComposerFocus] = useState(false);
  const composerAbierto = composerFocus || Boolean(texto.trim() || enlace.trim() || seguimiento);
  const [procesando, setProcesando] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [modalPerdida, setModalPerdida] = useState(false);
  const [razon, setRazon] = useState("");
  const [comentarioP, setComentarioP] = useState("");
  // Siguiente etapa (por orden) para el banner de avance
  const siguienteStage = stages
    .filter((s) => s.orden > deal.stage.orden)
    .sort((a, b) => a.orden - b.orden)[0] ?? null;

  // Banner de sugerencia de avance: el server ya derivó si el score cruza el umbral (SSOT).
  const [sugerirAvance, setSugerirAvance] = useState(Boolean(siguienteStage) && sugerirAvanceInicial);

  // Resumen / descripción del proyecto (REQ-05.3) — editable inline
  const [notas, setNotas] = useState(deal.notas ?? "");
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  // Edición/eliminación de entradas de bitácora (SOL-02)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  async function guardarNotas() {
    // No cerrar el editor hasta confirmar el guardado: si el PATCH falla, el texto
    // solo vive en memoria y se perdería al recargar (pérdida silenciosa de datos).
    try {
      const res = await fetch(`/api/crm/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas }),
      });
      if (!res.ok) throw new Error();
      setEditandoNotas(false);
    } catch {
      setToast({ type: "error", message: "No se pudieron guardar los cambios. Intentá de nuevo." });
    }
  }

  async function avanzarEtapa() {
    if (!siguienteStage) return;
    try {
      const res = await fetch(`/api/crm/deals/${deal.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: siguienteStage.id }),
      });
      if (!res.ok) throw new Error();
      setSugerirAvance(false);
      router.refresh();
    } catch {
      setToast({ type: "error", message: "No se pudo avanzar de etapa." });
    }
  }

  // Toggle del estado de una acción (cicla Pendiente→En proceso→Terminado)
  async function ciclarEstado(a: DealActividadItem) {
    const idx = ESTADO_ACCION_CICLO.indexOf(a.estado_accion);
    const siguiente = ESTADO_ACCION_CICLO[(idx + 1) % ESTADO_ACCION_CICLO.length];
    const prev = a.estado_accion;
    setActividades((cur) =>
      cur.map((x) => (x.id === a.id ? { ...x, estado_accion: siguiente, completada: siguiente === "TERMINADO" } : x))
    );
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_accion: siguiente }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revertir el cambio optimista si el servidor no lo aceptó.
      setActividades((cur) =>
        cur.map((x) => (x.id === a.id ? { ...x, estado_accion: prev, completada: prev === "TERMINADO" } : x))
      );
      setToast({ type: "error", message: "No se pudo actualizar el estado." });
    }
  }

  // Destacar/pin una actividad (REQ-03)
  async function toggleDestacar(a: DealActividadItem) {
    const nuevo = !a.destacada;
    setActividades((cur) => cur.map((x) => (x.id === a.id ? { ...x, destacada: nuevo } : x)));
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destacada: nuevo }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revertir el pin optimista si el servidor no lo aceptó.
      setActividades((cur) => cur.map((x) => (x.id === a.id ? { ...x, destacada: !nuevo } : x)));
      setToast({ type: "error", message: "No se pudo actualizar la actividad." });
    }
  }

  // Editar el contenido de una entrada (SOL-02) → marca "editado"
  async function guardarEdicion(a: DealActividadItem) {
    const nuevo = textoEdit.trim();
    if (!nuevo || nuevo === a.contenido) { setEditandoId(null); return; }
    const prev = actividades;
    setActividades((cur) => cur.map((x) => (x.id === a.id ? { ...x, contenido: nuevo, editada: true } : x)));
    setEditandoId(null);
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: nuevo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo guardar la edición.");
      }
    } catch (e) {
      setActividades(prev);
      setToast({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar la edición." });
    }
  }

  // Eliminar (soft-delete) una entrada de la bitácora (SOL-02)
  async function eliminarActividad(a: DealActividadItem) {
    if (!window.confirm("¿Eliminar esta entrada de la bitácora? Podés registrar otra si hace falta.")) return;
    const prev = actividades;
    setActividades((cur) => cur.filter((x) => x.id !== a.id));
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setActividades(prev);
      setToast({ type: "error", message: "No se pudo eliminar la entrada." });
    }
  }

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
      setToast({ type: "error", message: e instanceof Error ? e.message : "No se pudo cambiar el estado." });
      setProcesando(false);
    }
  }

  const actividadesFiltradas = actividades
    .filter((a) => (filtroVer === "TODAS" ? true : a.tipo === filtroVer))
    // Destacadas primero (pin), el resto en su orden cronológico
    .sort((x, y) => Number(y.destacada) - Number(x.destacada));

  // Próximo seguimiento pendiente (tarea agendada más cercana)
  const proximoSeguimiento =
    actividades
      .filter((a) => a.es_tarea && !a.completada && a.fecha_tarea)
      .map((a) => a.fecha_tarea as string)
      .sort()[0] ?? null;
  const seguimientoVencido = proximoSeguimiento
    ? new Date(proximoSeguimiento).getTime() < Date.now()
    : false;

  async function guardarActividad() {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/deals/${deal.id}/actividades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoNueva,
          contenido: texto.trim(),
          contacto_id: contactoSel || undefined,
          fecha_evento: fechaEvento || undefined,
          exitosa: tipoNueva === "LLAMADA" ? exitosa : undefined,
          fecha_tarea: seguimiento || undefined,
          tipo_accion_id: tipoAccionSel?.id || undefined,
          resultado_id: mostrarResultado ? resultadoSel || undefined : undefined,
          enlace_url: enlace.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar la actividad.");
      setActividades((cur) => [data.actividad as DealActividadItem, ...cur]);
      // Termómetro y sugerencia de avance devueltos por el servidor (REQ-06)
      if (data.temperatura) setTemperatura(data.temperatura as Temperatura);
      if (data.sugerir_avance) setSugerirAvance(true);
      // Cierre de ciclo (SOL-04): el resultado sugiere agendar la próxima acción
      if (data.sugerir_reagendar) {
        setToast({ type: "success", message: "Registrado. El resultado sugiere agendar la próxima acción." });
      }
      // En modo AUTOMÁTICO el servidor ya avanzó de etapa y registró el evento SISTEMA:
      // refrescar para reflejar la nueva etapa y la entrada en la bitácora.
      if (data.avanzo_etapa) router.refresh();
      setTexto("");
      setContactoSel(deal.contactos[0]?.id ?? "");
      setFechaEvento(ahoraLocal());
      setExitosa(true);
      setSeguimiento("");
      setResultadoSel("");
      setEnlace("");
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "No se pudo guardar la actividad." });
    } finally {
      setGuardando(false);
    }
  }

  // Composer basado en catálogo (SOL-04); con fallback a los pills fijos si no hay tipos configurados.
  const catalogoTipos = tiposAccion.length > 0;
  const mostrarInteraccion = catalogoTipos ? !!tipoAccionSel?.con_resultado : tipoNueva !== "NOTA";
  const mostrarResultado = mostrarInteraccion && resultadosAccion.length > 0;

  return (
    <div className="flex h-full flex-col">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
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
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-surface-border bg-white py-1 shadow-lg">
                <button onClick={() => cambiarResultado("GANADO")} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"><Trophy size={15} /> Ganado</button>
                <button onClick={() => { setMenuOpen(false); setRazon(""); setComentarioP(""); setModalPerdida(true); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"><XCircle size={15} /> Perdido</button>
                {deal.resultado === "ABIERTO" ? (
                  <button onClick={() => cambiarResultado("SUSPENDIDO")} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-blue-700 hover:bg-blue-50"><PauseCircle size={15} /> Suspender (hold)</button>
                ) : (
                  <button onClick={() => cambiarResultado("ABIERTO")} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"><Play size={15} /> Reactivar</button>
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
          <div className="mt-2.5 flex items-start justify-between gap-2">
            <h1 className="text-lg font-bold leading-tight text-navy">{deal.nombre}</h1>
            {canWrite && (
              <button
                onClick={() => setEditOpen(true)}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-surface-border px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-orange hover:text-orange"
              >
                <Pencil size={12} /> Editar
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
            <Building2 size={14} className="text-gray-400" />
            {deal.cliente?.nombre ?? "Sin cliente"}
            {deal.cliente?.estatus === "PROSPECTO" && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Prospecto</span>
            )}
          </div>
          {canWrite && deal.cliente?.estatus === "PROSPECTO" && (
            <Link
              href="/clientes?estatus=PROSPECTO"
              className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-orange/40 bg-orange/5 px-2.5 py-1.5 text-[11px] font-semibold text-orange hover:bg-orange/10"
            >
              <UserPlus size={13} /> Convertir a Cliente
            </Link>
          )}

          {proximoSeguimiento && (
            <div
              className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                seguimientoVencido ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
              }`}
            >
              <CalendarClock size={13} />
              {seguimientoVencido ? "Seguimiento vencido:" : "Próximo seguimiento:"} {formatFechaHora(proximoSeguimiento)}
            </div>
          )}

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
            <KpiCard label="Monto" value={formatCompacto(deal.valor)} accent="orange" />
            <KpiCard label="Cierre est." value={fmtFecha(deal.fecha_cierre_estimada)} />
            <KpiCard label="Días abierto" value={`${deal.dias_abierto} días`} />
            <KpiCard label="Probabilidad" value={deal.probabilidad != null ? `${deal.probabilidad}%` : "—"} accent="green" />
          </div>

          {/* Resumen / descripción del proyecto (REQ-05.3) */}
          <Section title="Resumen del proyecto">
            {editandoNotas ? (
              <div className="space-y-2">
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="¿De qué trata este deal? (contexto, alcance, notas)…"
                  className="w-full resize-none rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-navy outline-none focus:border-orange"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setNotas(deal.notas ?? ""); setEditandoNotas(false); }} className="text-[11px] font-semibold text-gray-400 hover:text-navy">Cancelar</button>
                  <button onClick={guardarNotas} className="rounded bg-navy px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-navy-700">Guardar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canWrite && setEditandoNotas(true)}
                className="flex w-full items-start gap-1.5 text-left text-xs text-gray-600 hover:text-navy"
              >
                <span className="flex-1">{notas || <span className="text-gray-400">Sin descripción — clic para agregar</span>}</span>
                {canWrite && <Pencil size={12} className="mt-0.5 shrink-0 text-gray-300" />}
              </button>
            )}
          </Section>

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
            {deal.contactos.map((c) => {
              const esDecisor = c.rol === "DECISOR";
              return (
                <div key={c.id} className="mb-3 flex items-start gap-2.5 last:mb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy
                    text-[11px] font-bold text-white">
                    {c.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-navy">{c.nombre}</span>
                      {esDecisor ? (
                        <span className="flex items-center gap-0.5 rounded bg-orange/10 px-1.5 py-0.5
                          text-[9px] font-bold uppercase tracking-wide text-orange">
                          <Star size={9} /> Decisor
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">{ROL_CONTACTO_LABEL[c.rol]}</span>
                      )}
                    </div>
                    {/* Datos de contacto accionables (SOL-15): tel:/mailto:/wa.me. Al usarlos,
                        pre-selecciona el contacto en el composer para registrar la interacción. */}
                    <div className="mt-1 flex flex-col gap-0.5">
                      {c.telefono && (
                        <a
                          href={telHref(c.telefono)}
                          onClick={() => setContactoSel(c.id)}
                          className="flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
                        >
                          <Phone size={11} className="shrink-0" /> {c.telefono}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          onClick={() => setContactoSel(c.id)}
                          className="flex min-w-0 items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
                        >
                          <Mail size={11} className="shrink-0" /> <span className="truncate">{c.email}</span>
                        </a>
                      )}
                      {c.whatsapp && (
                        <a
                          href={waHref(c.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setContactoSel(c.id)}
                          className="flex items-center gap-1.5 text-[11px] text-green-700 hover:underline"
                        >
                          <MessageCircle size={11} className="shrink-0" /> {c.whatsapp}
                        </a>
                      )}
                      {!c.telefono && !c.email && !c.whatsapp && (
                        <span className="text-[10px] text-gray-400">Sin datos de contacto</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
          {/* Termómetro del deal (REQ-06) + sugerencia de avance de etapa */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-white px-5 py-2.5">
            <Termometro
              dealId={deal.id}
              temperatura={temperatura}
              score={deal.score}
              canWrite={canWrite}
              onChange={setTemperatura}
            />
            {sugerirAvance && siguienteStage && (
              <button
                onClick={avanzarEtapa}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <ArrowUpCircle size={14} /> Listo para avanzar a {siguienteStage.nombre}
                <ChevronRight size={13} />
              </button>
            )}
          </div>

          {/* Compositor: arriba el TIPO de entrada → cambian los campos */}
          {canWrite && (
            <div
              className="border-b border-surface-border bg-white px-5 py-4"
              onFocus={() => setComposerFocus(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setComposerFocus(false);
              }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {catalogoTipos
                  ? tiposAccion.map((t) => {
                      const activo = tipoAccionSel?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTipoAccionSel(t);
                            setTipoNueva(tipoLegado(t.nombre));
                            if (!t.con_resultado) setResultadoSel("");
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            activo ? "text-white" : "border-surface-border text-gray-500 hover:bg-surface"
                          }`}
                          style={activo ? { background: t.color, borderColor: t.color } : undefined}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: activo ? "#fff" : t.color }} />
                          {t.nombre}
                        </button>
                      );
                    })
                  : TIPO_PILLS.map(({ tipo, label, icon: Icon }) => (
                      <button
                        key={tipo}
                        onClick={() => setTipoNueva(tipo)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          tipoNueva === tipo ? "border-navy bg-navy text-white" : "border-surface-border text-gray-500 hover:bg-surface"
                        }`}
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
              </div>

              {/* Campos según el tipo (catálogo: cuando el tipo captura resultado) */}
              {mostrarInteraccion && (
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                    {tipoNueva === "EMAIL" ? "¿A quién?" : "¿Con quién?"}
                    <select
                      value={contactoSel}
                      onChange={(e) => setContactoSel(e.target.value)}
                      className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
                    >
                      <option value="">— Selecciona contacto —</option>
                      {deal.contactos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                    Cuándo ocurrió
                    <input
                      type="datetime-local"
                      value={fechaEvento}
                      onChange={(e) => setFechaEvento(e.target.value)}
                      className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
                    />
                  </label>
                  {tipoNueva === "LLAMADA" && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
                      <input type="checkbox" checked={exitosa} onChange={(e) => setExitosa(e.target.checked)} className="h-4 w-4" /> ¿Contestó / fue exitosa?
                    </label>
                  )}
                  {mostrarResultado && (
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500 sm:col-span-2">
                      Resultado <span className="font-normal text-gray-400">(ajusta el termómetro)</span>
                      <select
                        value={resultadoSel}
                        onChange={(e) => setResultadoSel(e.target.value)}
                        className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
                      >
                        <option value="">— Sin registrar resultado —</option>
                        {resultadosAccion.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                            {r.efecto === "POSITIVO" ? "  ▲" : r.efecto === "NEGATIVO" ? "  ▼" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              <MarkdownEditor value={texto} onChange={setTexto} placeholder={PLACEHOLDER[tipoNueva]} />

              {/* Opcionales (enlace + agendar): se revelan al componer para no saturar la vista */}
              {composerAbierto && (
                <div className="mt-2 space-y-2">
                  {/* Enlace externo (ej. propuesta en Google Drive) — alternativa a subir archivo */}
                  <label className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-navy focus-within:border-orange">
                    <Link2 size={14} className="shrink-0 text-gray-400" />
                    <input
                      type="url"
                      value={enlace}
                      onChange={(e) => setEnlace(e.target.value)}
                      placeholder="Enlace (Google Drive, propuesta…) — opcional"
                      className="w-full bg-transparent outline-none placeholder:text-gray-400"
                    />
                  </label>

                  {/* Agendar próximo paso (opcional) — alimenta el inbox de Próximas Acciones */}
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
                    <span className="flex items-center gap-1"><CalendarClock size={12} /> Agendar seguimiento (opcional)</span>
                    <input
                      type="datetime-local"
                      value={seguimiento}
                      onChange={(e) => setSeguimiento(e.target.value)}
                      className="w-fit rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
                    />
                  </label>
                </div>
              )}

              {/* CTA — siempre visible */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={guardarActividad}
                  disabled={!texto.trim() || texto.length > MAX_CONTENIDO || guardando}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Registrar"}
                </button>
              </div>
            </div>
          )}

          {/* Filtros (ver bitácora por tipo) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-gray-50 px-5 py-2.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ver:</span>
            {FILTROS_VER.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroVer(f.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  filtroVer === f.key ? "bg-navy text-white" : "text-gray-500 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-gray-300" title="Próximamente (adjuntos)">Archivos</span>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {actividadesFiltradas.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">Sin actividad en esta vista.</p>
            )}
            <div className="space-y-4">
              {actividadesFiltradas.map((a) => {
                const meta = ACT_ICON[a.tipo];
                const Icon = meta.icon;
                const estado = ESTADO_ACCION_META[a.estado_accion];
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-navy">{a.autor}</span>
                        {a.contacto_nombre && <span className="text-gray-400">· con {a.contacto_nombre}</span>}
                        {/* Modelo de actividad (SOL-04): tipo del catálogo (color), estado y resultado */}
                        {a.tipo_accion && (
                          <span
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: a.tipo_accion.color + "1A", color: a.tipo_accion.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.tipo_accion.color }} />
                            {a.tipo_accion.nombre}
                          </span>
                        )}
                        {a.estado_plan && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ESTADO_PLAN_META[a.estado_plan].chip}`}>
                            {ESTADO_PLAN_META[a.estado_plan].label}
                          </span>
                        )}
                        {a.resultado && (
                          <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${EFECTO_META[a.resultado.efecto].chip}`}>
                            {EFECTO_META[a.resultado.efecto].arrow && (
                              <span>{EFECTO_META[a.resultado.efecto].arrow}</span>
                            )}
                            {a.resultado.nombre}
                          </span>
                        )}
                        {a.tipo === "LLAMADA" && a.exitosa !== null && (
                          <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${a.exitosa ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.exitosa ? "#1D9E75" : "#F5A623" }} />
                            {a.exitosa ? "Contestó" : "No contestó"}
                          </span>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => toggleDestacar(a)}
                            title={a.destacada ? "Quitar destacado" : "Destacar"}
                            className="text-gray-300 hover:text-amber-500"
                          >
                            <Star
                              size={13}
                              fill={a.destacada ? "#F5A623" : "none"}
                              color={a.destacada ? "#F5A623" : "currentColor"}
                            />
                          </button>
                        )}
                        {canWrite && a.tipo !== "SISTEMA" && editandoId !== a.id && (
                          <>
                            <button onClick={() => { setEditandoId(a.id); setTextoEdit(a.contenido); }} title="Editar" className="text-gray-300 hover:text-navy">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => eliminarActividad(a)} title="Eliminar" className="text-gray-300 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        <span className="ml-auto text-[11px] text-gray-400">
                          {a.editada && <span className="mr-1 italic text-gray-300">editado ·</span>}
                          {formatFechaHora(a.fecha_evento ?? a.created_at)}
                        </span>
                      </div>
                      <div
                        className="mt-1 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm leading-relaxed text-gray-700"
                        style={{ borderLeftWidth: 3, borderLeftColor: a.destacada ? "#F5A623" : meta.color }}
                      >
                        {editandoId === a.id ? (
                          <div className="space-y-2">
                            <MarkdownEditor value={textoEdit} onChange={setTextoEdit} autoFocus />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditandoId(null)} className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">Cancelar</button>
                              <button
                                onClick={() => guardarEdicion(a)}
                                disabled={textoEdit.length > MAX_CONTENIDO}
                                className="rounded bg-orange px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange/90 disabled:opacity-50"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <Markdown>{a.contenido}</Markdown>
                        )}
                        {a.enlace_url && /^https?:\/\//i.test(a.enlace_url) && (
                          <a
                            href={a.enlace_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 flex w-fit items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            <Link2 size={12} /> Ver enlace
                          </a>
                        )}
                        {a.es_tarea && a.fecha_tarea && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="flex items-center gap-1 font-semibold text-blue-700">
                              <CalendarClock size={12} /> Seguimiento: {formatFechaHora(a.fecha_tarea)}
                            </span>
                            {canWrite && (
                              <button
                                onClick={() => ciclarEstado(a)}
                                title="Cambiar estado"
                                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase hover:opacity-80"
                                style={{ background: estado.dot + "22", color: estado.dot }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: estado.dot }} />
                                {estado.label}
                              </button>
                            )}
                          </div>
                        )}
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
                {razonesPerdida.map((r) => <option key={r} value={r}>{r}</option>)}
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

      {/* Editar ficha completa del deal (SOL-01) — reusa el modal de alta en modo edición */}
      {editOpen && (
        <NuevoDealModal
          stages={stages}
          vendedores={vendedores}
          clientes={clientes}
          tipos={tipos}
          deal={{
            id: deal.id,
            nombre: deal.nombre,
            cliente_id: deal.cliente?.id ?? "",
            vendedor_id: deal.vendedor?.id ?? null,
            stage_id: deal.stage.id,
            tipo_cotizacion_id: deal.tipo?.id ?? null,
            temperatura: deal.temperatura,
            valor: deal.valor,
            setup: deal.setup,
            mensualidad: deal.mensualidad,
            canal: deal.canal,
            origen: deal.origen,
            fecha_cierre_estimada: deal.fecha_cierre_estimada ? deal.fecha_cierre_estimada.slice(0, 10) : null,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); router.refresh(); }}
        />
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

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 border-t border-surface-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2.5 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wide text-gray-400 hover:text-navy"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && children}
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

