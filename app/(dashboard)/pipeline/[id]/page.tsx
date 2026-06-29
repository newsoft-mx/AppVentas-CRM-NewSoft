import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { getCrmConfig, toParametrosTermometro } from "@/lib/crm-config";
import { temperaturaEfectiva } from "@/lib/termometro";
import DealDetalleClient from "@/components/pipeline/DealDetalleClient";
import type { Metadata } from "next";
import type { DealDetalle, StageResumen, Temperatura } from "@/types/crm";

export const metadata: Metadata = { title: "Deal — Pipeline CRM" };
export const dynamic = "force-dynamic";

function diasDesde(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function DealDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: { select: { id: true, nombre: true, orden: true, umbral_avance: true } },
      cliente: { select: { id: true, nombre: true } },
      vendedor: { select: { id: true, nombre: true } },
      tipo_cotizacion: { select: { id: true, nombre: true } },
      contactos: { orderBy: { created_at: "asc" } },
      actividades: {
        orderBy: { created_at: "desc" },
        include: { contacto: { select: { nombre: true } } },
      },
    },
  });

  if (!deal) notFound();

  const [stages, historial, config] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, orden: true, color: true },
    }),
    deal.cliente_id
      ? prisma.ordenVenta.findMany({
          where: { cliente_id: deal.cliente_id },
          select: { estatus: true, total_mxn: true },
        })
      : Promise.resolve([]),
    getCrmConfig(),
  ]);

  const ganadas = historial.filter((o) => o.estatus === "VENTA");
  const totalFacturado = ganadas.reduce((s, o) => s + Number(o.total_mxn), 0);

  // Temperatura efectiva: enfriada por inactividad desde la última actividad (display)
  const ultimaActividad = deal.actividades.reduce<Date | null>((max, a) => {
    const f = a.fecha_evento ?? a.created_at;
    return !max || f > max ? f : max;
  }, null);
  const tempEfectiva = temperaturaEfectiva(
    deal.temperatura as Temperatura,
    ultimaActividad,
    config.umbral_inactividad_dias,
    toParametrosTermometro(config),
    new Date()
  );

  const detalle: DealDetalle = {
    id: deal.id,
    nombre: deal.nombre,
    moneda: deal.moneda,
    valor: Number(deal.valor),
    setup: deal.setup != null ? Number(deal.setup) : null,
    mensualidad: deal.mensualidad != null ? Number(deal.mensualidad) : null,
    meses: deal.meses,
    temperatura: tempEfectiva,
    probabilidad: deal.probabilidad,
    canal: deal.canal,
    origen: deal.origen,
    resultado: deal.resultado,
    fecha_cierre_estimada: deal.fecha_cierre_estimada
      ? deal.fecha_cierre_estimada.toISOString().slice(0, 10)
      : null,
    dias_abierto: diasDesde(deal.created_at),
    notas: deal.notas,
    stage: {
      id: deal.stage.id,
      nombre: deal.stage.nombre,
      orden: deal.stage.orden,
      umbral_avance: deal.stage.umbral_avance as Temperatura | null,
    },
    cliente: deal.cliente,
    vendedor: deal.vendedor,
    tipo: deal.tipo_cotizacion
      ? { id: deal.tipo_cotizacion.id, nombre: deal.tipo_cotizacion.nombre }
      : null,
    contactos: deal.contactos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      rol: c.rol,
      email: c.email,
      telefono: c.telefono,
      whatsapp: c.whatsapp,
    })),
    actividades: deal.actividades.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      contenido: a.contenido,
      autor: a.autor,
      contacto_nombre: a.contacto?.nombre ?? null,
      fecha_evento: a.fecha_evento ? a.fecha_evento.toISOString() : null,
      exitosa: a.exitosa,
      es_tarea: a.es_tarea,
      completada: a.completada,
      estado_accion: a.estado_accion,
      destacada: a.destacada,
      enlace_url: a.enlace_url,
      fecha_tarea: a.fecha_tarea ? a.fecha_tarea.toISOString() : null,
      created_at: a.created_at.toISOString(),
    })),
    historial: {
      ordenes_total: historial.length,
      proyectos_ganados: ganadas.length,
      total_facturado: totalFacturado,
    },
  };

  const stagesSerialized: StageResumen[] = stages;

  return (
    <DealDetalleClient deal={detalle} stages={stagesSerialized} canWrite={canWrite(session)} />
  );
}
