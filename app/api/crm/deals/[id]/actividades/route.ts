import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { getCrmConfig, toParametrosTermometro } from "@/lib/crm-config";
import {
  subirTemperatura,
  cruzaUmbralAvance,
  actividadExitosa,
} from "@/lib/termometro";
import type { Temperatura } from "@/types/crm";

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

  const { tipo, contenido, contacto_id, fecha_evento, exitosa, fecha_tarea, enlace_url } =
    (body ?? {}) as {
      tipo?: string;
      contenido?: string;
      contacto_id?: string;
      fecha_evento?: string;
      exitosa?: boolean;
      fecha_tarea?: string;
      enlace_url?: string;
    };

  if (!tipo || !TIPOS.includes(tipo as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "Tipo inválido", campo: "tipo" }, { status: 422 });
  }
  if (!contenido || !contenido.trim()) {
    return NextResponse.json({ error: "El contenido es obligatorio", campo: "contenido" }, { status: 422 });
  }
  if (contenido.length > 5000) {
    return NextResponse.json({ error: "El contenido es demasiado largo (máx. 5000)", campo: "contenido" }, { status: 422 });
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
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { id: true, temperatura: true, stage: { select: { umbral_avance: true, orden: true } } },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // Validar que el contacto (si viene) pertenece al deal
    let contactoId: string | null = null;
    if (contacto_id) {
      const c = await prisma.dealContacto.findFirst({ where: { id: contacto_id, deal_id: id }, select: { id: true } });
      contactoId = c?.id ?? null;
    }

    const exitosaVal = tipoActividad === "LLAMADA" ? (typeof exitosa === "boolean" ? exitosa : null) : null;

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
      },
      include: { contacto: { select: { nombre: true } } },
    });

    // ── Termómetro (REQ-06): una actividad exitosa sube la temperatura; la fallida no.
    let temperaturaActual = deal.temperatura as Temperatura;
    let sugerirAvance = false;
    let avanzoEtapa = false;
    if (actividadExitosa(tipoActividad, exitosaVal)) {
      const config = await getCrmConfig();
      const nueva = subirTemperatura(temperaturaActual, tipoActividad, toParametrosTermometro(config));
      const subio = nueva !== temperaturaActual;
      if (subio) {
        temperaturaActual = nueva;
        await prisma.deal.update({ where: { id }, data: { temperatura: nueva } });
      }
      const cruza = cruzaUmbralAvance(temperaturaActual, deal.stage.umbral_avance as Temperatura | null);
      // Solo actuar cuando la temperatura cambió (evita re-sugerir en cada nota a tope)
      if (cruza && subio) {
        if (config.avance_modo === "AUTOMATICO") {
          // Avanzar a la siguiente etapa activa (por orden)
          const siguiente = await prisma.pipelineStage.findFirst({
            where: { activo: true, orden: { gt: deal.stage.orden } },
            orderBy: { orden: "asc" },
            select: { id: true, nombre: true, probabilidad_base: true },
          });
          if (siguiente) {
            await prisma.deal.update({
              where: { id },
              data: {
                stage_id: siguiente.id,
                fecha_entrada_stage: new Date(),
                probabilidad: siguiente.probabilidad_base,
              },
            });
            await prisma.dealActividad.create({
              data: {
                deal_id: id,
                tipo: "SISTEMA",
                autor: "Sistema",
                contenido: `Avance automático a "${siguiente.nombre}" (termómetro en ${temperaturaActual}).`,
              },
            });
            avanzoEtapa = true;
          }
        } else {
          sugerirAvance = true; // modo SUGERIR → el front muestra el banner
        }
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
        },
        temperatura: temperaturaActual,
        sugerir_avance: sugerirAvance,
        avanzo_etapa: avanzoEtapa,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Error al registrar la actividad" }, { status: 500 });
  }
}
