"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Trophy, ChevronDown, XCircle, PauseCircle, Play, CalendarClock,
  Star, Link2, ArrowUpCircle, ChevronRight, UserPlus, Pencil, Trash2, Plus, X,
  Globe, AlertTriangle, Check,
  type LucideIcon,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import Termometro from "@/components/pipeline/Termometro";
import ContactosDeal from "@/components/pipeline/ContactosDeal";
import CasosNegocioDeal from "@/components/pipeline/CasosNegocioDeal";
import NuevoDealModal from "@/components/pipeline/NuevoDealModal";
import Markdown from "@/components/ui/Markdown";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import ActividadCompositor, {
  type TipoAccionOpcion, type ResultadoAccionOpcion, type RespuestaGuardado,
} from "@/components/pipeline/ActividadCompositor";
import { formatCompacto, formatFechaHora } from "@/lib/utils";
import { TIPO_ACTIVIDAD_META } from "@/lib/actividad-tipos";
import { esTareaPendiente, estaVencida, estadoTarea } from "@/lib/tareas";
import {
  TEMPERATURA_META, ESTADO_TAREA_META,
  EFECTO_META, TAMANO_EMPRESA_LABEL,
  type DealDetalle, type DealActividadItem, type StageResumen, type TipoActividad,
  type Temperatura,
} from "@/types/crm";
// El panel de IA (DealAIPanel) está construido pero se libera en Fase 2.

// Los catálogos del compositor (TipoAccionOpcion / ResultadoAccionOpcion) viven en
// ActividadCompositor: es quien los consume. Se re-exportan porque las páginas que
// arman las props los tipan desde acá.
export type { TipoAccionOpcion, ResultadoAccionOpcion };

interface Props {
  deal: DealDetalle;
  stages: StageResumen[];
  canWrite: boolean;
  vendedores?: { id: string; nombre: string }[];
  clientes?: { id: string; nombre: string }[];
  tipos?: { id: string; nombre: string }[];
  canales?: { id: string; nombre: string }[];
  origenes?: { id: string; nombre: string }[];
  motivos?: string[]; // catálogo de motivos de pérdida (SOL-10)
  /** Catálogo de tipos de acción (SOL-04): pills del composer */
  tiposAccion?: TipoAccionOpcion[];
  /** Catálogo de resultados de acción (SOL-04): mueven el termómetro al registrar la interacción */
  resultadosAccion?: ResultadoAccionOpcion[];
  /** ¿El score ya cruza el umbral de avance? Derivado en el server (dealScoreView). */
  sugerirAvanceInicial?: boolean;
}

function fmtFull(n: number): string {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 0 });
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  // Fecha-solo (YYYY-MM-DD): anclar a UTC → misma fecha en server y cliente (sin corrimiento).
  return new Date(iso + "T00:00:00Z").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
// Una vista de la bitácora ("Ver"): un botón que empareja actividades por un criterio.
// Dos ejes ortogonales: por tipo de movimiento (derivado del contenido — catálogo
// tipo_accion, o el tipo legado si no hay catálogo) y facetas transversales
// (Favoritas / Pendientes / Con enlace). Se arma desde las actividades presentes, con
// contador, así cubre exactamente los movimientos que existen y no puede divergir.
interface FiltroBitacora {
  key: string;
  label: string;
  count: number;
  /** Punto de color (entradas por tipo) */
  color?: string;
  /** Ícono (entradas de faceta) */
  icon?: LucideIcon;
  match: (a: DealActividadItem) => boolean;
}

export default function DealDetalleClient({
  deal, stages, canWrite,
  vendedores = [], clientes = [], tipos = [], canales = [], origenes = [], motivos = [],
  tiposAccion = [], resultadosAccion = [], sugerirAvanceInicial = false,
}: Props) {
  const router = useRouter();
  // Motivos del catálogo (SOL-10); si viene vacío, fallback a la lista base.
  // Los motivos vienen del catálogo MotivoPerdida (SSOT). Sin fallback hardcodeado.
  const razonesPerdida = motivos;
  const [temperatura, setTemperatura] = useState<Temperatura>(deal.temperatura);
  const temp = TEMPERATURA_META[temperatura];
  const [actividades, setActividades] = useState<DealActividadItem[]>(deal.actividades);
  const [filtroVer, setFiltroVer] = useState<string>("TODAS");
  // "Ahora" en ms, seteado tras el montaje: evita llamar Date.now() en el render
  // (mismatch de hidratación). Alimenta seguimientoVencido.
  const [nowTs, setNowTs] = useState<number | null>(null);
  useEffect(() => {
    setNowTs(Date.now());
  }, []);
  // Mini-modal de desenlace (SOL-23): se abre al marcar Listo una acción con resultado.
  const [completando, setCompletando] = useState<DealActividadItem | null>(null);
  const [desenlaceSel, setDesenlaceSel] = useState("");
  // El compositor está colapsado por defecto (la bitácora ocupa toda la altura); se
  // abre al tocar "Registrar actividad" y se cierra al guardar o con Cancelar/✕.
  const [registrando, setRegistrando] = useState(false);
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
  // Edición de una entrada: se reusa el MISMO compositor, precargado con `editando`.
  const [editando, setEditando] = useState<DealActividadItem | null>(null);
  // Contacto elegido desde el panel de contactos → arranca el compositor con él.
  const [contactoInicial, setContactoInicial] = useState<string | undefined>(undefined);
  // Ref al compositor para desplazarlo a la vista al iniciar una edición.
  const composerRef = useRef<HTMLDivElement>(null);
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

  // Estado (SOL-21/23): Pendiente ⇄ Listo, nada más. Al marcar Listo se pide el DESENLACE
  // (si el tipo lo lleva): el desenlace solo tiene sentido cuando la acción ya ocurrió, y
  // mueve el termómetro según su efecto. Al agendar nunca se pregunta.
  function alternarEstado(a: DealActividadItem) {
    if (a.completada) return marcarEstado(a, false); // deshacer: vuelve a Pendiente
    const tipoCat = tiposAccion.find((t) => t.id === a.tipo_accion?.id);
    if (tipoCat?.con_resultado && resultadosAccion.length > 0) {
      setCompletando(a); // abre el mini-modal de desenlace
      setDesenlaceSel("");
      return;
    }
    marcarEstado(a, true);
  }

  async function marcarEstado(a: DealActividadItem, completada: boolean, resultadoId?: string) {
    const prev = a.completada;
    setActividades((cur) => cur.map((x) => (x.id === a.id ? { ...x, completada } : x)));
    setCompletando(null);
    try {
      const res = await fetch(`/api/crm/actividades/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completada, ...(resultadoId ? { resultado_id: resultadoId } : {}) }),
      });
      if (!res.ok) throw new Error();
      // El desenlace mueve el termómetro (efecto del catálogo) → refrescar del server.
      if (resultadoId) router.refresh();
    } catch {
      // Revertir el cambio optimista si el servidor no lo aceptó.
      setActividades((cur) => cur.map((x) => (x.id === a.id ? { ...x, completada: prev } : x)));
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

  // Filtros "Ver" derivados del contenido: Todas + tipos de movimiento presentes +
  // facetas con resultados. Con contador; se auto-mantienen con lo que hay en la bitácora.
  const filtrosBitacora = useMemo<FiltroBitacora[]>(() => {
    const tipos = new Map<string, FiltroBitacora>();
    for (const a of actividades) {
      if (a.tipo_accion) {
        const key = `acc:${a.tipo_accion.id}`;
        const found = tipos.get(key);
        if (found) { found.count++; continue; }
        const accId = a.tipo_accion.id;
        tipos.set(key, {
          key, label: a.tipo_accion.nombre, color: a.tipo_accion.color, count: 1,
          match: (x) => x.tipo_accion?.id === accId,
        });
      } else {
        const key = `leg:${a.tipo}`;
        const found = tipos.get(key);
        if (found) { found.count++; continue; }
        const leg = a.tipo;
        tipos.set(key, {
          key, label: TIPO_ACTIVIDAD_META[leg].labelPlural, color: TIPO_ACTIVIDAD_META[leg].color, count: 1,
          match: (x) => !x.tipo_accion && x.tipo === leg,
        });
      }
    }
    const facetas: FiltroBitacora[] = [
      { key: "fav", label: "Favoritas", icon: Star, count: actividades.filter((a) => a.destacada).length, match: (a) => a.destacada },
      { key: "pend", label: "Pendientes", icon: CalendarClock, count: actividades.filter(esTareaPendiente).length, match: esTareaPendiente },
      { key: "link", label: "Con enlace", icon: Link2, count: actividades.filter((a) => Boolean(a.enlace_url)).length, match: (a) => Boolean(a.enlace_url) },
    ];
    return [
      { key: "TODAS", label: "Todas", count: actividades.length, match: () => true },
      ...tipos.values(),
      ...facetas.filter((f) => f.count > 0),
    ];
  }, [actividades]);
  // Si el filtro elegido dejó de existir (p.ej. se borró la última de ese tipo), cae a "Todas".
  const filtroActivo = filtrosBitacora.find((f) => f.key === filtroVer) ?? filtrosBitacora[0];

  const actividadesFiltradas = actividades
    .filter((a) => (filtroActivo ? filtroActivo.match(a) : true))
    // Destacadas primero (pin), el resto en su orden cronológico
    .sort((x, y) => Number(y.destacada) - Number(x.destacada));

  // Próximo seguimiento pendiente (tarea agendada más cercana) — predicado SSOT.
  const proximoSeguimiento =
    actividades
      .filter(esTareaPendiente)
      .map((a) => a.fecha_tarea as string)
      .sort()[0] ?? null;
  const seguimientoVencido =
    proximoSeguimiento && nowTs != null ? estaVencida(proximoSeguimiento, nowTs) : false;

  // Abrir el compositor para editar una entrada: precarga sola con `editando` (el
  // compositor comparte validación y payload con el alta).
  function iniciarEdicion(a: DealActividadItem) {
    setEditando(a);
    setRegistrando(true);
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  function cerrarCompositor() {
    setEditando(null);
    setContactoInicial(undefined);
    setRegistrando(false);
  }

  // El compositor ya hizo el POST/PATCH; acá solo se refleja lo que devolvió el server.
  function alGuardar(data: RespuestaGuardado, editada: boolean) {
    const guardada = data.actividad;
    setActividades((cur) =>
      editada ? cur.map((x) => (x.id === guardada.id ? guardada : x)) : [guardada, ...cur]
    );
    // Termómetro devuelto por el servidor (REQ-06) — el alta y la edición lo recalculan.
    if (data.temperatura) setTemperatura(data.temperatura);
    if (data.sugerir_avance) setSugerirAvance(true);
    // Cierre de ciclo (SOL-04): el resultado sugiere agendar la próxima acción.
    if (data.sugerir_reagendar) {
      setToast({ type: "success", message: "Guardado. El resultado sugiere agendar la próxima acción." });
    }
    // En modo AUTOMÁTICO el servidor ya avanzó de etapa y registró el evento SISTEMA:
    // refrescar para reflejar la nueva etapa y la entrada en la bitácora.
    if (data.avanzo_etapa) router.refresh();
    cerrarCompositor();
  }


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
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
            <Building2 size={14} className="text-gray-400" />
            {deal.cliente?.nombre ?? "Sin cliente"}
            {deal.cliente?.estatus === "PROSPECTO" && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Prospecto</span>
            )}
            {deal.cliente?.website ? (
              <a
                href={deal.cliente.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-medium text-orange hover:underline"
              >
                <Globe size={12} /> {deal.cliente.website.replace(/^https?:\/\//, "")}
              </a>
            ) : deal.cliente ? (
              <span
                title="Este lead no tiene sitio web — dificulta identificarlo. Agregalo en la ficha del cliente."
                className="flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5
                           text-[10px] font-semibold text-amber-700"
              >
                <AlertTriangle size={11} /> Sin website
              </span>
            ) : null}
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
                {/* Mismo editor que el compositor (SSOT): autocrece + expandir + markdown. */}
                <MarkdownEditor
                  value={notas}
                  onChange={setNotas}
                  autoFocus
                  placeholder="¿De qué trata este deal? (contexto, alcance, notas)…"
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
                <span className="flex-1">
                  {notas ? (
                    <Markdown>{notas}</Markdown>
                  ) : (
                    <span className="text-gray-400">Sin descripción — clic para agregar</span>
                  )}
                </span>
                {canWrite && <Pencil size={12} className="mt-0.5 shrink-0 text-gray-300" />}
              </button>
            )}
          </Section>

          {/* Datos del deal */}
          <Section title="Datos del deal">
            <Field label="Tipo" value={deal.tipo?.nombre ?? "—"} tag />
            {deal.setup != null && <Field label="Setup" value={`${fmtFull(deal.setup)} ${deal.moneda}`} />}
            {deal.mensualidad != null && <Field label="Mensualidad" value={`${fmtFull(deal.mensualidad)} / mes`} />}
            {deal.canal && <Field label="Canal" value={deal.canal.nombre} />}
            {deal.origen && <Field label="Origen" value={deal.origen.nombre} />}
            {deal.cliente?.tamano_empresa && (
              <Field label="Tamaño empresa" value={TAMANO_EMPRESA_LABEL[deal.cliente.tamano_empresa]} />
            )}
            <Field label="Responsable" value={deal.vendedor?.nombre ?? "Sin vendedor"} />
            <Field label="Ingreso al pipeline" value={fmtFecha(deal.fecha_ingreso.slice(0, 10))} />
          </Section>

          {/* Contactos (Bloque C): editar el contacto compartido, agregar, cambiar rol */}
          <Section title="Contactos">
            <ContactosDeal
              dealId={deal.id}
              clienteId={deal.cliente?.id ?? null}
              contactos={deal.contactos}
              canWrite={canWrite}
              onError={(message) => setToast({ type: "error", message })}
              onSelect={(id) => {
                // Clic en un contacto = "quiero registrar algo con él": abre el compositor
                // en alta, con ese contacto ya puesto.
                setEditando(null);
                setContactoInicial(id);
                setRegistrando(true);
              }}
            />
          </Section>

          {/* Casos de negocio (Simulador Fase 2): abrir/crear casos vinculados al deal */}
          <Section title="Casos de negocio">
            <CasosNegocioDeal dealId={deal.id} />
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

          {/* Colapsado: solo un trigger; la bitácora ocupa toda la altura (pedido de UX). */}
          {canWrite && !registrando && (
            <div className="border-b border-surface-border bg-white px-5 py-3">
              <button
                onClick={() => setRegistrando(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-surface-border
                  px-3 py-2 text-sm font-semibold text-gray-500 hover:border-orange hover:text-navy"
              >
                <Plus size={15} /> Registrar actividad
              </button>
            </div>
          )}

          {/* Compositor: el MISMO componente que usa la agenda global. Las reglas de
              captura (SOL-21/22/23) viven ahí una sola vez, no duplicadas por pantalla. */}
          {canWrite && registrando && (
            <div ref={composerRef}>
              {/* key: cambiar de actividad (o de contacto) remonta el compositor, que nace
                  ya precargado. Evita un efecto que pise lo que se está tipeando. */}
              <ActividadCompositor
                key={editando?.id ?? contactoInicial ?? "nueva"}
                deal={{ id: deal.id, contactos: deal.contactos }}
                tiposAccion={tiposAccion}
                resultadosAccion={resultadosAccion}
                editando={editando}
                contactoInicial={contactoInicial}
                onGuardado={alGuardar}
                onCancelar={cerrarCompositor}
                onError={(m) => setToast({ type: "error", message: m })}
              />
            </div>
          )}

          {/* Filtros "Ver": tipos de movimiento presentes + facetas, con contador (derivados del contenido) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-gray-50 px-5 py-2.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ver:</span>
            {filtrosBitacora.map((f) => {
              const activo = filtroActivo?.key === f.key;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltroVer(f.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    activo ? "bg-navy text-white" : "text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {f.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />}
                  {Icon && <Icon size={12} />}
                  {f.label}
                  <span className={activo ? "text-white/60" : "text-gray-400"}>{f.count}</span>
                </button>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {actividadesFiltradas.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">Sin actividad en esta vista.</p>
            )}
            <div className="space-y-4">
              {actividadesFiltradas.map((a) => {
                const meta = TIPO_ACTIVIDAD_META[a.tipo];
                const Icon = meta.icon;
                // Estado derivado (SOL-21/23): solo las agendadas tienen Pendiente/Listo.
                const estadoT = estadoTarea(a);
                // SOL-21: la nota es opcional → sin cuerpo no se dibuja la caja (antes
                // quedaba un recuadro vacío). La caja existe si hay algo que mostrar.
                const tieneCuerpo =
                  a.contenido.trim() !== "" || Boolean(a.enlace_url) || Boolean(a.es_tarea && a.fecha_tarea);
                return (
                  <div key={a.id} className="flex gap-3">
                    {/* Columna izquierda: en las agendadas, checkbox para completar de un
                        clic (el gesto de Gaby en Pipedrive); en los registros, el ícono. */}
                    {canWrite && estadoT ? (
                      <button
                        onClick={() => alternarEstado(a)}
                        title={a.completada ? "Marcar como Pendiente" : "Marcar como Listo"}
                        aria-label={a.completada ? "Marcar como Pendiente" : "Marcar como Listo"}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                    border-2 transition-colors ${
                                      a.completada
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : `border-gray-300 text-transparent hover:border-emerald-600
                                           hover:text-emerald-600`
                                    }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    ) : (
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        <Icon size={13} />
                      </div>
                    )}
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
                        {estadoT && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold
                                        ${ESTADO_TAREA_META[estadoT].chip}`}
                          >
                            {ESTADO_TAREA_META[estadoT].label}
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
                        {canWrite && a.tipo !== "SISTEMA" && (
                          <>
                            <button onClick={() => iniciarEdicion(a)} title="Editar" className="text-gray-300 hover:text-navy">
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
                      {tieneCuerpo && (
                        <div
                          className={`mt-1 flex flex-col items-start gap-1.5 rounded-lg border border-surface-border
                                      bg-white px-3 py-2 text-sm leading-relaxed text-gray-700 ${
                                        editando?.id === a.id ? "ring-2 ring-orange/40" : ""
                                      }`}
                          style={{ borderLeftWidth: 3, borderLeftColor: a.destacada ? "#F5A623" : meta.color }}
                        >
                          {a.contenido.trim() !== "" && (
                            <div className="w-full">
                              <Markdown>{a.contenido}</Markdown>
                            </div>
                          )}
                          {a.enlace_url && /^https?:\/\//i.test(a.enlace_url) && (
                            <a
                              href={a.enlace_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] font-semibold
                                         text-blue-600 hover:underline"
                            >
                              <Link2 size={12} /> Ver enlace
                            </a>
                          )}
                          {/* El estado ya lo dice el checkbox de la izquierda + el chip de
                              arriba; acá solo el "cuándo" del seguimiento. */}
                          {a.es_tarea && a.fecha_tarea && (
                            <span
                              className={`flex items-center gap-1 text-[11px] font-semibold ${
                                a.completada ? "text-gray-400 line-through" : "text-blue-700"
                              }`}
                            >
                              <CalendarClock size={12} /> Seguimiento: {formatFechaHora(a.fecha_tarea)}
                            </span>
                          )}
                        </div>
                      )}
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

      {/* Desenlace al completar (SOL-23): el resultado se pide SOLO al pasar la acción a
          Listo — nunca al agendar. El efecto del desenlace mueve el termómetro. */}
      {completando && (
        <Modal title="¿Cómo salió?" onClose={() => setCompletando(null)} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Marcás <b>Listo</b>
              {completando.tipo_accion ? <> «{completando.tipo_accion.nombre}»</> : null}. Registrá
              el desenlace para que el termómetro lo refleje.
            </p>
            <div>
              <label className="label">Desenlace <span className="font-normal text-gray-400">(opcional)</span></label>
              <select className="input" value={desenlaceSel} onChange={(e) => setDesenlaceSel(e.target.value)}>
                <option value="">— Sin registrar desenlace —</option>
                {resultadosAccion.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                    {r.efecto === "POSITIVO" ? "  ▲" : r.efecto === "NEGATIVO" ? "  ▼" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-surface-border pt-4">
              <button onClick={() => setCompletando(null)} className="btn-secondary justify-center">Cancelar</button>
              <button
                onClick={() => marcarEstado(completando, true, desenlaceSel || undefined)}
                className="btn-primary justify-center"
              >
                Marcar Listo
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
          canales={canales}
          origenes={origenes}
          deal={{
            id: deal.id,
            nombre: deal.nombre,
            cliente_id: deal.cliente?.id ?? "",
            vendedor_id: deal.vendedor?.id ?? null,
            stage_id: deal.stage.id,
            tipo_cotizacion_id: deal.tipo?.id ?? null,
            temperatura: deal.temperatura,
            moneda: deal.moneda,
            valor: deal.valor,
            setup: deal.setup,
            mensualidad: deal.mensualidad,
            meses: deal.meses,
            canal_id: deal.canal?.id ?? null,
            origen_id: deal.origen?.id ?? null,
            fecha_cierre_estimada: deal.fecha_cierre_estimada ? deal.fecha_cierre_estimada.slice(0, 10) : null,
            fecha_ingreso: deal.fecha_ingreso.slice(0, 10),
            cliente_website: deal.cliente?.website ?? null,
            cliente_tamano: deal.cliente?.tamano_empresa ?? null,
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

