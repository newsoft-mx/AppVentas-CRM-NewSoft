import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { crearContactoPrincipal, crearOEncontrarContacto } from "@/lib/contactos";
import { logger } from "@/lib/logger";
import type { DealResumen } from "@/types/crm";
import type { RolContacto } from "@prisma/client";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Error de validación dentro de la transacción de alta → se traduce a 422 con campo.
class HttpError extends Error {
  constructor(public status: number, message: string, public campo?: string) {
    super(message);
  }
}

// ── POST /api/crm/deals ─────────────────────────────────────────
// Crea un nuevo deal (prospecto) en el pipeline.
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  let cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  const stage_id = typeof body.stage_id === "string" ? body.stage_id : "";

  // Contacto obligatorio: un deal nace con al menos un contacto.
  const ROLES = ["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"];
  const c = (body.contacto ?? {}) as Record<string, unknown>;
  const contactoNombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  const contactoRol = ROLES.includes(c.rol as string) ? (c.rol as string) : "OTRO";
  const contactoEmail = typeof c.email === "string" && c.email.trim() ? c.email.trim() : null;
  const contactoTel = typeof c.telefono === "string" && c.telefono.trim() ? c.telefono.trim() : null;

  // Alta rápida de prospecto: si no hay cliente_id, se crea un Cliente con estatus=PROSPECTO
  // a partir de los datos mínimos (empresa + contacto). Los datos fiscales se piden al convertir.
  const cn = (body.cliente_nuevo ?? null) as Record<string, unknown> | null;
  const prospectoNombre = cn && typeof cn.nombre === "string" ? cn.nombre.trim() : "";

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio", campo: "nombre" }, { status: 422 });
  if (nombre.length > 200 || prospectoNombre.length > 200 || contactoNombre.length > 150) {
    return NextResponse.json({ error: "Texto demasiado largo", campo: "nombre" }, { status: 422 });
  }
  if (!cliente_id && !prospectoNombre) {
    return NextResponse.json(
      { error: "Indica un cliente existente o un prospecto nuevo", campo: "cliente_id" },
      { status: 422 }
    );
  }
  if (!stage_id) return NextResponse.json({ error: "La etapa es obligatoria", campo: "stage_id" }, { status: 422 });
  if (!contactoNombre) return NextResponse.json({ error: "El nombre del contacto es obligatorio", campo: "contacto.nombre" }, { status: 422 });

  const contactoWa = typeof c.whatsapp === "string" && c.whatsapp.trim() ? c.whatsapp.trim() : null;
  const contactoCargo = typeof c.cargo === "string" && c.cargo.trim() ? c.cargo.trim() : null;
  const contactoDatos = {
    nombre: contactoNombre,
    email: contactoEmail,
    telefono: contactoTel,
    whatsapp: contactoWa,
    cargo: contactoCargo,
  };

  try {
    // Validar el stage antes de tocar nada (el cliente se valida/crea en la transacción)
    const stage = await prisma.pipelineStage.findFirst({ where: { id: stage_id, activo: true }, select: { id: true } });
    if (!stage) return NextResponse.json({ error: "Etapa inválida", campo: "stage_id" }, { status: 422 });

    const fechaCierre = typeof body.fecha_cierre_estimada === "string" && body.fecha_cierre_estimada
      ? new Date(body.fecha_cierre_estimada) : null;

    // Todo el alta es atómica: prospecto (si aplica) + su contacto principal +
    // deal + link al contacto. El contacto es dueño del cliente (Bloque C).
    const deal = await prisma.$transaction(async (tx) => {
      // Crear el prospecto si corresponde (datos mínimos; condición = primera activa)
      if (!cliente_id && prospectoNombre) {
        const cond = await tx.condicionComercial.findFirst({
          where: { activo: true },
          orderBy: { dias_credito: "asc" },
          select: { id: true },
        });
        if (!cond) throw new HttpError(422, "No hay condiciones de pago configuradas");
        const prospecto = await tx.cliente.create({
          data: {
            nombre: prospectoNombre,
            contacto: contactoNombre,
            ciudad: "",
            email: contactoEmail,
            telefono: contactoTel,
            condicion_pago_id: cond.id,
            estatus: "PROSPECTO",
          },
          select: { id: true },
        });
        cliente_id = prospecto.id;
      }

      const cliente = await tx.cliente.findFirst({ where: { id: cliente_id, activo: true }, select: { id: true } });
      if (!cliente) throw new HttpError(422, "Cliente inválido", "cliente_id");

      // El contacto del deal: para un prospecto nuevo es su PRINCIPAL; para un
      // cliente existente se reutiliza (o crea) sin duplicar al principal.
      const existePrincipal = await tx.contacto.count({ where: { cliente_id, es_principal: true, activo: true } });
      const contacto =
        existePrincipal === 0
          ? await crearContactoPrincipal(tx, cliente_id, contactoDatos)
          : await crearOEncontrarContacto(tx, cliente_id, contactoDatos);

      return tx.deal.create({
        data: {
          nombre,
          cliente_id,
          stage_id,
          vendedor_id: typeof body.vendedor_id === "string" && body.vendedor_id ? body.vendedor_id : null,
          tipo_cotizacion_id: typeof body.tipo_cotizacion_id === "string" && body.tipo_cotizacion_id ? body.tipo_cotizacion_id : null,
          // temperatura/probabilidad se DERIVAN del score (dealScoreView); no se persisten.
          moneda: body.moneda === "USD" ? "USD" : "MXN",
          valor: num(body.valor) ?? 0,
          setup: num(body.setup),
          mensualidad: num(body.mensualidad),
          meses: num(body.meses) != null ? Math.round(num(body.meses)!) : null,
          canal: typeof body.canal === "string" && body.canal.trim() ? body.canal.trim() : null,
          origen: typeof body.origen === "string" && body.origen.trim() ? body.origen.trim() : null,
          fecha_cierre_estimada: fechaCierre,
          // Link al contacto (obligatorio) — un deal nace con al menos un contacto
          contactos: { create: [{ contacto_id: contacto.id, rol: contactoRol as RolContacto }] },
          // Evento de alta: entrada a la primera etapa (from_stage null) — inicia el embudo
          stage_events: { create: [{ to_stage_id: stage_id }] },
        },
        include: {
          cliente: { select: { id: true, nombre: true } },
          vendedor: { select: { id: true, nombre: true } },
          tipo_cotizacion: { select: { id: true, nombre: true } },
          contactos: { select: { contacto: { select: { nombre: true } } } },
        },
      });
    });

    // Score derivado del deal recién creado (sin actividades → score inicial) vía el SSOT
    const ctx = await getScoringContext();
    const view = dealScoreView(
      ctx,
      { ajuste_manual: deal.ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at, actividades: [] },
      new Date()
    );

    const resumen: DealResumen = {
      id: deal.id,
      nombre: deal.nombre,
      valor: Number(deal.valor),
      moneda: deal.moneda,
      temperatura: view.temperatura,
      probabilidad: view.probabilidad,
      resultado: deal.resultado,
      stage_id: deal.stage_id,
      dias_en_etapa: 0,
      actividades_count: 0,
      proximo_seguimiento: null,
      atencion: "SIN_PROXIMA",
      cliente: deal.cliente ? { id: deal.cliente.id, nombre: deal.cliente.nombre } : null,
      vendedor: deal.vendedor ? { id: deal.vendedor.id, nombre: deal.vendedor.nombre } : null,
      tipo: deal.tipo_cotizacion ? { id: deal.tipo_cotizacion.id, nombre: deal.tipo_cotizacion.nombre } : null,
      contactos: deal.contactos.map((c) => c.contacto.nombre),
      razon_perdida: deal.razon_perdida,
    };

    return NextResponse.json(resumen, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message, ...(err.campo ? { campo: err.campo } : {}) }, { status: err.status });
    }
    logger.error("Error al crear el deal", "POST /api/crm/deals", err);
    return NextResponse.json({ error: "Error al crear el deal" }, { status: 500 });
  }
}
