import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import DealDetalleClient from "@/components/pipeline/DealDetalleClient";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
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

  // Scoping por vendedor: un VENDEDOR no puede abrir por URL el deal de otro.
  const deal = await prisma.deal.findFirst({
    where: scopeDealWhere(session, { id }),
    include: {
      stage: { select: { id: true, nombre: true, orden: true } },
      cliente: { select: { id: true, nombre: true, estatus: true } },
      vendedor: { select: { id: true, nombre: true } },
      tipo_cotizacion: { select: { id: true, nombre: true } },
      contactos: { orderBy: { created_at: "asc" } },
      actividades: {
        where: { eliminada: false },
        orderBy: { created_at: "desc" },
        include: {
          contacto: { select: { nombre: true } },
          // Modelo de actividad (SOL-04): tipo del catálogo (color) y resultado (efecto)
          tipo_accion: { select: { id: true, nombre: true, color: true } },
          resultado: { select: { id: true, nombre: true, efecto: true } },
        },
      },
    },
  });

  if (!deal) notFound();

  const [stages, historial, vendedores, clientes, tipos, motivos, tiposAccion, resultadosAccion] = await Promise.all([
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
    prisma.vendedor.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.cliente.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.tipoCotizacion.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.motivoPerdida.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { nombre: true },
    }),
    // Catálogo de tipos de acción (SOL-04): pills del composer
    prisma.tipoAccion.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, color: true, agendable: true, con_resultado: true },
    }),
    // Catálogo de resultados de acción (SOL-04): mueven el termómetro al registrar la interacción
    prisma.resultadoAccion.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, efecto: true, sugiere_reagendar: true },
    }),
  ]);

  const ganadas = historial.filter((o) => o.estatus === "VENTA");
  const totalFacturado = ganadas.reduce((s, o) => s + Number(o.total_mxn), 0);

  // Score y sus derivaciones desde el SSOT (mismo adaptador que el Kanban → mismo número)
  const scoringCtx = await getScoringContext();
  const view = dealScoreView(
    scoringCtx,
    { ajuste_manual: deal.ajuste_manual, stage_id: deal.stage_id, created_at: deal.created_at, actividades: deal.actividades },
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
    // Score y sus derivaciones vienen del SSOT (dealScoreView), no de columnas persistidas.
    score: view.score,
    temperatura: view.temperatura,
    probabilidad: view.probabilidad,
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
      editada: a.editada,
      enlace_url: a.enlace_url,
      fecha_tarea: a.fecha_tarea ? a.fecha_tarea.toISOString() : null,
      created_at: a.created_at.toISOString(),
      estado_plan: a.estado_plan,
      tipo_accion: a.tipo_accion
        ? { id: a.tipo_accion.id, nombre: a.tipo_accion.nombre, color: a.tipo_accion.color }
        : null,
      resultado: a.resultado
        ? { id: a.resultado.id, nombre: a.resultado.nombre, efecto: a.resultado.efecto }
        : null,
    })),
    historial: {
      ordenes_total: historial.length,
      proyectos_ganados: ganadas.length,
      total_facturado: totalFacturado,
    },
  };

  const stagesSerialized: StageResumen[] = stages;

  return (
    <DealDetalleClient
      deal={detalle}
      stages={stagesSerialized}
      canWrite={canWrite(session)}
      vendedores={vendedores}
      clientes={clientes}
      tipos={tipos}
      motivos={motivos.map((m) => m.nombre)}
      tiposAccion={tiposAccion}
      resultadosAccion={resultadosAccion}
      sugerirAvanceInicial={view.cruzaAvance}
    />
  );
}
