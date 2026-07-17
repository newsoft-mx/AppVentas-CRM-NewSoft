"use client";

// Compositor de actividad: SSOT de la CAPTURA en el front.
//
// Lo usan la bitácora del deal (deal fijo) y la agenda global (elige deal). Un solo
// compositor para los dos: las reglas de SOL-21/22/23 —fecha obligatoria, hora opcional,
// nota opcional, desenlace solo de lo ya ocurrido— viven acá una vez, igual que su par
// del server (lib/actividad-input), y no pueden divergir entre pantallas.
import { useState } from "react";
import { CalendarClock, Clock, User, Link2, X, type LucideIcon } from "lucide-react";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { MAX_CONTENIDO } from "@/lib/actividad";
import { fechaInput } from "@/lib/tz";
import { TIPO_ACTIVIDAD_META, TIPOS_CREABLES } from "@/lib/actividad-tipos";
import type { DealActividadItem, TipoActividad, Temperatura } from "@/types/crm";

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

export interface ContactoOpcion {
  id: string;
  nombre: string;
}

/** Deal contra el que se registra. En la agenda global se elige de una lista. */
export interface DealCompositor {
  id: string;
  contactos: ContactoOpcion[];
  /** Solo para el selector de la agenda global. */
  titulo?: string;
  cliente_nombre?: string;
}

/** Lo que devuelve el server al guardar (el termómetro y los avisos los usa el detalle). */
export interface RespuestaGuardado {
  actividad: DealActividadItem;
  temperatura?: Temperatura;
  sugerir_avance?: boolean;
  sugerir_reagendar?: boolean;
  avanzo_etapa?: boolean;
}

interface Props {
  /** Deal fijo (bitácora del detalle). Excluyente con `deals`. */
  deal?: DealCompositor;
  /** Deals elegibles (agenda global): el deal_id es obligatorio, así que hay que elegir uno. */
  deals?: DealCompositor[];
  tiposAccion: TipoAccionOpcion[];
  resultadosAccion: ResultadoAccionOpcion[];
  /** Actividad a editar: precarga todos los campos y guarda con PATCH. */
  editando?: DealActividadItem | null;
  /** Contacto con el que arrancar (ej. clic en un contacto del panel del deal). */
  contactoInicial?: string;
  onGuardado: (r: RespuestaGuardado, editada: boolean) => void;
  onCancelar: () => void;
  onError: (mensaje: string) => void;
}

// Campos opcionales revelados a demanda con "+ Agregar" (SOL-22).
type Extra = "hora" | "contacto" | "enlace";
const EXTRAS_META: Record<Extra, { label: string; icon: LucideIcon }> = {
  hora: { label: "Hora", icon: Clock },
  contacto: { label: "Contacto", icon: User },
  enlace: { label: "Enlace", icon: Link2 },
};

// Deriva el tipo legado (ícono/placeholder) a partir del nombre del tipo del catálogo.
export function tipoLegado(nombre: string): TipoActividad {
  const n = nombre.toLowerCase();
  if (n.includes("llamad")) return "LLAMADA";
  if (n.includes("mail") || n.includes("correo")) return "EMAIL";
  if (n.includes("whats")) return "WHATSAPP";
  return "NOTA";
}

// "Hoy" como YYYY-MM-DD en hora local (default del campo fecha).
export function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/**
 * Campos con los que abre el compositor: en limpio (fecha = hoy) o precargado con la
 * actividad a editar. Al editar se revelan los opcionales que YA traen valor — si
 * quedaran detrás de "+ Agregar" se editarían a ciegas, o se borrarían sin verlos.
 */
function inicial(
  editando: DealActividadItem | null | undefined,
  deal: DealCompositor | undefined,
  contactoInicial: string | undefined,
  tiposAccion: TipoAccionOpcion[]
) {
  if (!editando) {
    return {
      tipo: "NOTA" as TipoActividad,
      tipoAccion: null,
      texto: "",
      contacto: contactoInicial ?? deal?.contactos[0]?.id ?? "",
      fecha: hoyISO(),
      hora: "",
      resultado: "",
      enlace: "",
      // Un contacto elegido desde afuera se muestra: escondido viajaría sin que se vea.
      extras: (contactoInicial ? ["contacto"] : []) as Extra[],
    };
  }
  // El "cuándo": si es tarea agendada, fecha_tarea; si es registro, fecha_evento.
  const cuando = editando.fecha_tarea ?? editando.fecha_evento;
  const local = cuando ? fechaInput(cuando) : ""; // "YYYY-MM-DDTHH:mm"
  const horaGuardada = local ? local.slice(11, 16) : "";
  return {
    tipo: editando.tipo,
    tipoAccion: tiposAccion.find((t) => t.id === editando.tipo_accion?.id) ?? null,
    texto: editando.contenido,
    contacto: editando.contacto_id ?? "",
    fecha: local ? local.slice(0, 10) : hoyISO(),
    hora: horaGuardada,
    resultado: editando.resultado?.id ?? "",
    enlace: editando.enlace_url ?? "",
    extras: [
      ...(horaGuardada ? ["hora"] : []),
      ...(editando.contacto_id ? ["contacto"] : []),
      ...(editando.enlace_url ? ["enlace"] : []),
    ] as Extra[],
  };
}

export default function ActividadCompositor({
  deal, deals, tiposAccion, resultadosAccion, editando, contactoInicial, onGuardado, onCancelar, onError,
}: Props) {
  // El estado nace ya precargado (ver `inicial`): el compositor solo se monta tras un
  // clic, nunca en SSR, así que puede leer el reloj sin riesgo de hidratación. Para
  // recargarlo con otra actividad, el padre lo remonta con `key` — no hace falta un
  // efecto que pise los campos.
  const ini = inicial(editando, deal, contactoInicial, tiposAccion);
  const [tipoNueva, setTipoNueva] = useState<TipoActividad>(ini.tipo);
  const [tipoAccionSel, setTipoAccionSel] = useState<TipoAccionOpcion | null>(ini.tipoAccion);
  const [texto, setTexto] = useState(ini.texto);
  const [contactoSel, setContactoSel] = useState(ini.contacto);
  const [fecha, setFecha] = useState(ini.fecha);
  const [hora, setHora] = useState(ini.hora);
  const [resultadoSel, setResultadoSel] = useState(ini.resultado);
  const [enlace, setEnlace] = useState(ini.enlace);
  const [extras, setExtras] = useState<Extra[]>(ini.extras);
  const [guardando, setGuardando] = useState(false);
  // Deal elegido en la agenda global (en el detalle viene fijo por prop).
  const [dealSel, setDealSel] = useState("");
  const [nowTs] = useState(() => Date.now());

  const dealActivo = deal ?? deals?.find((d) => d.id === dealSel) ?? null;
  const contactos = dealActivo?.contactos ?? [];
  const revelar = (e: Extra) => setExtras((prev) => (prev.includes(e) ? prev : [...prev, e]));
  const visible = (e: Extra) => extras.includes(e);

  // Composer basado en catálogo (SOL-04); fallback a pills fijos si no hay tipos configurados.
  const catalogoTipos = tiposAccion.length > 0;
  const capturaResultado = catalogoTipos ? !!tipoAccionSel?.con_resultado : tipoNueva !== "NOTA";
  const mostrarResultado = capturaResultado && resultadosAccion.length > 0;
  // ¿El "cuándo" elegido es futuro? Define si se AGENDA (pendiente, sin desenlace) o es un
  // registro de algo ya ocurrido. Misma regla que el server — acá solo para mostrar/ocultar.
  const cuandoFutura =
    /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    new Date(`${fecha}T${/^\d{2}:\d{2}$/.test(hora) ? hora : "09:00"}`).getTime() > nowTs;
  const extrasDisponibles = (Object.keys(EXTRAS_META) as Extra[]).filter(
    (e) => !visible(e) && (e !== "contacto" || contactos.length > 0)
  );

  async function guardar() {
    // SOL-21: lo único que bloquea es tipo + fecha (la nota NO). El server valida igual.
    if (!fecha || !dealActivo || guardando) return;
    setGuardando(true);
    const editar = editando != null;
    // El server (lib/actividad-input) decide con fecha+hora si esto se AGENDA (futura →
    // pendiente, con o sin hora) o es un registro. El desenlace solo viaja si ya ocurrió.
    const payload = {
      tipo: tipoNueva,
      contenido: texto.trim() || undefined,
      contacto_id: contactoSel || undefined,
      fecha,
      hora: hora || undefined,
      tipo_accion_id: tipoAccionSel?.id || undefined,
      resultado_id: !cuandoFutura && mostrarResultado ? resultadoSel || undefined : undefined,
      enlace_url: enlace.trim() || undefined,
    };
    try {
      const res = await fetch(
        editar ? `/api/crm/actividades/${editando.id}` : `/api/crm/deals/${dealActivo.id}/actividades`,
        {
          method: editar ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar la actividad.");
      onGuardado(data as RespuestaGuardado, editar);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="border-b border-surface-border bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {editando ? "Editar actividad" : "Nueva actividad"}
        </span>
        <button
          onClick={onCancelar}
          title="Cerrar"
          className="rounded p-1 text-gray-400 hover:bg-surface hover:text-navy"
        >
          <X size={16} />
        </button>
      </div>

      {/* Agenda global: la actividad SIEMPRE cuelga de un deal (deal_id es NOT NULL), así
          que lo primero es elegir contra cuál se registra. En el detalle ya viene fijo. */}
      {deals && (
        <label className="mb-3 flex flex-col gap-1 text-[11px] font-medium text-gray-500">
          Deal
          <SearchableSelect
            options={deals.map((d) => ({
              id: d.id,
              label: d.titulo ?? "Deal",
              sublabel: d.cliente_nombre,
            }))}
            value={dealSel}
            onChange={(id) => {
              setDealSel(id);
              // El contacto pertenece al deal: al cambiar de deal deja de aplicar.
              setContactoSel(deals.find((d) => d.id === id)?.contactos[0]?.id ?? "");
            }}
            placeholder="¿Sobre qué deal?"
            searchPlaceholder="Buscar por deal o cliente…"
          />
        </label>
      )}

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
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs
                              font-semibold transition-colors ${
                                activo ? "text-white" : "border-surface-border text-gray-500 hover:bg-surface"
                              }`}
                  style={activo ? { background: t.color, borderColor: t.color } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: activo ? "#fff" : t.color }} />
                  {t.nombre}
                </button>
              );
            })
          : TIPOS_CREABLES.map((tipo) => {
              const { label, icon: Icon } = TIPO_ACTIVIDAD_META[tipo];
              return (
                <button
                  key={tipo}
                  onClick={() => setTipoNueva(tipo)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs
                              font-semibold transition-colors ${
                                tipoNueva === tipo
                                  ? "border-navy bg-navy text-white"
                                  : "border-surface-border text-gray-500 hover:bg-surface"
                              }`}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
      </div>

      {/* Cuándo (SOL-21/22): la FECHA es lo único obligatorio (nace en hoy). La HORA es
          opcional y se revela con "+ Agregar" — sin hora igual se agenda. Futuro → pendiente;
          hoy/pasado → registro de algo que ya ocurrió. */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm
                       text-navy outline-none focus:border-orange"
          />
        </label>
        {visible("hora") && (
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
            Hora <span className="font-normal text-gray-400">(opcional)</span>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm
                         text-navy outline-none focus:border-orange"
            />
          </label>
        )}
        {cuandoFutura && (
          <p className="flex items-center gap-1 pb-2 text-[11px] font-medium text-blue-700">
            <CalendarClock size={13} /> Se agenda como pendiente
          </p>
        )}
      </div>

      <MarkdownEditor
        value={texto}
        onChange={setTexto}
        placeholder={TIPO_ACTIVIDAD_META[tipoNueva].placeholder}
      />

      {/* Opcionales: solo los revelados con "+ Agregar" (o los que ya traen valor al editar).
          El desenlace no es un "extra": aparece solo cuando el tipo lo captura y la
          actividad ya ocurrió (SOL-23). */}
      {(visible("contacto") || visible("enlace") || (mostrarResultado && !cuandoFutura)) && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible("contacto") && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
              {tipoNueva === "EMAIL" ? "¿A quién?" : "¿Con quién?"}
              <select
                value={contactoSel}
                onChange={(e) => setContactoSel(e.target.value)}
                className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm
                           text-navy outline-none focus:border-orange"
              >
                <option value="">— Selecciona contacto —</option>
                {contactos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          )}
          {visible("enlace") && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
              Enlace <span className="font-normal text-gray-400">(Drive, propuesta…)</span>
              <input
                type="url"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://…"
                className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm
                           text-navy outline-none placeholder:text-gray-400 focus:border-orange"
              />
            </label>
          )}
          {mostrarResultado && !cuandoFutura && (
            <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500 sm:col-span-2">
              Desenlace <span className="font-normal text-gray-400">(opcional — ajusta el termómetro)</span>
              <select
                value={resultadoSel}
                onChange={(e) => setResultadoSel(e.target.value)}
                className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm
                           text-navy outline-none focus:border-orange"
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

      {/* "+ Agregar" (SOL-22): revela los opcionales que falten, uno a uno. */}
      {extrasDisponibles.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            + Agregar:
          </span>
          {extrasDisponibles.map((e) => {
            const { label, icon: Icon } = EXTRAS_META[e];
            return (
              <button
                key={e}
                onClick={() => revelar(e)}
                className="flex items-center gap-1 rounded-full border border-dashed border-surface-border
                           px-2.5 py-1 text-[11px] font-semibold text-gray-500
                           hover:border-orange hover:text-navy"
              >
                <Icon size={12} /> {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancelar}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-surface hover:text-navy"
        >
          Cancelar
        </button>
        <button
          onClick={guardar}
          disabled={!fecha || !dealActivo || texto.length > MAX_CONTENIDO || guardando}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white
                     transition-colors hover:bg-navy-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar"}
        </button>
      </div>
    </div>
  );
}
