import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { MAX_CONTENIDO, MSG_CONTENIDO_LARGO } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const TIPOS = ["NOTA", "LLAMADA", "EMAIL", "WHATSAPP"] as const;

// ── POST /api/crm/deals/:id/actividades ─────────────────────────
// Registra una entrada en la bitácora del deal (nota/llamada/email/whatsapp),
// opcionalmente como tarea con fecha.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    tipo,
    contenido,
    contacto_id,
    fecha_evento,
    exitosa,
    fecha_tarea,
    enlace_url,
    tipo_accion_id,
    resultado_id,
  } = (body ?? {}) as {
    tipo?: string;
    contenido?: string;
    contacto_id?: string;
    fecha_evento?: string;
    exitosa?: boolean;
    fecha_tarea?: string;
    enlace_url?: string;
    // Modelo de actividad (SOL-04): tipo del catálogo + resultado (mueve el termómetro)
    tipo_accion_id?: string;
    resultado_id?: string;
  };

  if (!tipo || !TIPOS.includes(tipo as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "Tipo inválido", campo: "tipo" }, { status: 422 });
  }
  if (!contenido || !contenido.trim()) {
    return NextResponse.json({ error: "El contenido es obligatorio", campo: "contenido" }, { status: 422 });
  }
  if (contenido.length > MAX_CONTENIDO) {
    return NextResponse.json({ error: MSG_CONTENIDO_LARGO, campo: "contenido" }, { status: 422 });
  }

  // Enlace externo: solo http/https. Bloquea javascript:/data: (XSS almacenado vía href).
  const enlaceLimpio = typeof enlace_url === "string" ? enlace_url.trim() : "";
  if (enlaceLimpio && !/^https?:\/\//i.test(enlaceLimpio)) {
    return NextResponse.json({ error: "El enlace debe empezar con http:// o https://", campo: "enlace_url" }, { status: 422 });
  }
  if (enlaceLimpio.length > 500) {
    return NextResponse.json({ error: "El enlace es demasiado largo (máx. 500)", campo: "enlace_url" }, { status: 422 });
  }

  const tipoActividad = tipo as (typeof TIPOS)[number];

  try {
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: { id: true, stage_id: true, ajuste_manual: true, created_at: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // Validar que el contacto (si viene) pertenece al deal
    let contactoId: string | null = null;
    if (contacto_id) {
      const c = await prisma.dealContacto.findFirst({ where: { id: contacto_id, deal_id: id }, select: { id: true } });
      contactoId = c?.id ?? null;
    }

    const exitosaVal = tipoActividad === "LLAMADA" ? (typeof exitosa === "boolean" ? exitosa : null) : null;

    // ── Modelo de actividad (SOL-04): valida tipo/resultado del catálogo y captura su efecto.
    let tipoAccionId: string | null = null;
    if (tipo_accion_id) {
      const ta = await prisma.tipoAccion.findFirst({
        where: { id: tipo_accion_id, activo: true },
        select: { id: true },
      });
      tipoAccionId = ta?.id ?? null;
    }
    let resultadoId: string | null = null;
    let sugiereReagendar = false;
    if (resultado_id) {
      const r = await prisma.resultadoAccion.findFirst({
        where: { id: resultado_id, activo: true },
        select: { id: true, sugiere_reagendar: true },
      });
      if (r) {
        resultadoId = r.id;
        sugiereReagendar = r.sugiere_reagendar;
      }
    }
    // Estado de planeación: si capturó resultado, la acción está REALIZADA; si agenda a futuro, PLANEADA.
    const estadoPlan = resultadoId ? "REALIZADA" : fecha_tarea ? "PLANEADA" : null;

    const actividad = await prisma.dealActividad.create({
      data: {
        deal_id: id,
        tipo: tipoActividad,
        contenido: contenido.trim(),
        autor: session.email,
        contacto_id: contactoId,
        enlace_url: enlaceLimpio || null,
        // Las interacciones (llamada/email/whatsapp) registran cuándo ocurrieron;
        // si no se indica, se asume "ahora". Las notas no tienen fecha de evento.
        fecha_evento: tipoActividad === "NOTA" ? null : fecha_evento ? new Date(fecha_evento) : new Date(),
        exitosa: exitosaVal,
        // Seguimiento opcional: agenda el próximo paso (con fecha y hora)
        es_tarea: Boolean(fecha_tarea),
        fecha_tarea: fecha_tarea ? new Date(fecha_tarea) : null,
        // Modelo de actividad (SOL-04)
        tipo_accion_id: tipoAccionId,
        resultado_id: resultadoId,
        estado_plan: estadoPlan,
      },
      include: {
        contacto: { select: { nombre: true } },
        tipo_accion: { select: { id: true, nombre: true, color: true } },
        resultado: { select: { id: true, nombre: true, efecto: true } },
      },
    });

    // ── Scoring: se RECALCULA on-read desde todo el historial (SSOT). Nada de temperatura persistida.
    const ctx = await getScoringContext();
    const actsAll = await prisma.dealActividad.findMany({
      where: { deal_id: id, eliminada: false },
      select: { id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
    });
    const dealBase = { ajuste_manual: deal.ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at };
    const ahora = new Date();
    const view = dealScoreView(ctx, { ...dealBase, actividades: actsAll }, ahora);
    // Score ANTES de esta actividad (para disparar avance solo al CRUZAR al alza, no en cada nota a tope)
    const scoreAntes = dealScoreView(
      ctx,
      { ...dealBase, actividades: actsAll.filter((a) => a.id !== actividad.id) },
      ahora
    ).score;
    const umbral = ctx.stageById.get(deal.stage_id)?.umbral_avance_score ?? null;
    const cruzoAlAlza = umbral != null && scoreAntes < umbral && view.score >= umbral && view.siguienteStageId !== null;

    let sugerirAvance = false;
    let avanzoEtapa = false;
    if (cruzoAlAlza && view.siguienteStageId) {
      if (ctx.avance_modo === "AUTOMATICO") {
        await prisma.deal.update({
          where: { id },
          data: { stage_id: view.siguienteStageId, fecha_entrada_stage: new Date() },
        });
        await prisma.dealActividad.create({
          data: { deal_id: id, tipo: "SISTEMA", autor: "Sistema", contenido: `Avance automático (score ${view.score}/100).` },
        });
        await prisma.dealStageEvent.create({
          data: { deal_id: id, from_stage_id: deal.stage_id, to_stage_id: view.siguienteStageId },
        });
        avanzoEtapa = true;
      } else {
        sugerirAvance = true; // modo SUGERIR → el front muestra el banner
      }
    }

    return NextResponse.json(
      {
        actividad: {
          id: actividad.id,
          tipo: actividad.tipo,
          contenido: actividad.contenido,
          autor: actividad.autor,
          contacto_nombre: actividad.contacto?.nombre ?? null,
          fecha_evento: actividad.fecha_evento ? actividad.fecha_evento.toISOString() : null,
          exitosa: actividad.exitosa,
          es_tarea: actividad.es_tarea,
          completada: actividad.completada,
          estado_accion: actividad.estado_accion,
          destacada: actividad.destacada,
          enlace_url: actividad.enlace_url,
          fecha_tarea: actividad.fecha_tarea ? actividad.fecha_tarea.toISOString() : null,
          created_at: actividad.created_at.toISOString(),
          estado_plan: actividad.estado_plan,
          tipo_accion: actividad.tipo_accion
            ? { id: actividad.tipo_accion.id, nombre: actividad.tipo_accion.nombre, color: actividad.tipo_accion.color }
            : null,
          resultado: actividad.resultado
            ? { id: actividad.resultado.id, nombre: actividad.resultado.nombre, efecto: actividad.resultado.efecto }
            : null,
        },
        // Score y derivaciones recalculadas (SSOT). Si avanzó de etapa, el front refresca.
        score: view.score,
        temperatura: view.temperatura,
        probabilidad: view.probabilidad,
        sugerir_avance: sugerirAvance,
        avanzo_etapa: avanzoEtapa,
        // Cierre de ciclo (SOL-04): el resultado sugiere agendar la próxima acción
        sugerir_reagendar: sugiereReagendar,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Error al registrar la actividad" }, { status: 500 });
  }
}
