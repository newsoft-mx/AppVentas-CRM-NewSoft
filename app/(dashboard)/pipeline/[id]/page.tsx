import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import DealDetalleClient from "@/components/pipeline/DealDetalleClient";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import { ACTIVIDAD_INCLUDE, serializeActividad } from "@/lib/actividad-input";
import type { Metadata } from "next";
import type { DealDetalle, StageResumen } from "@/types/crm";

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
      cliente: { select: { id: true, nombre: true, estatus: true, website: true, tamano_empresa: true } },
      vendedor: { select: { id: true, nombre: true } },
      tipo_cotizacion: { select: { id: true, nombre: true } },
      canal: { select: { id: true, nombre: true } },
      origen: { select: { id: true, nombre: true } },
      contactos: {
        orderBy: { created_at: "asc" },
        include: { contacto: true },
      },
      actividades: {
        where: { eliminada: false },
        orderBy: { created_at: "desc" },
        // Relaciones que necesita serializeActividad (contacto + tipo del catálogo +
        // resultado). Mismas que usan la agenda y los endpoints: una sola definición.
        include: ACTIVIDAD_INCLUDE,
      },
    },
  });

  if (!deal) notFound();

  const [
    stages, historial, vendedores, clientes, tipos, motivos, tiposAccion, resultadosAccion, catalogoDeal,
  ] = await Promise.all([
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
    // Catálogo de canales/orígenes activos (para los selects del modal)
    prisma.catalogoDeal.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);
  const canales = catalogoDeal.filter((c) => c.tipo === "CANAL").map(({ id, nombre }) => ({ id, nombre }));
  const origenes = catalogoDeal.filter((c) => c.tipo === "ORIGEN").map(({ id, nombre }) => ({ id, nombre }));

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
    dias_abierto: diasDesde(deal.fecha_ingreso),
    fecha_ingreso: deal.fecha_ingreso.toISOString(),
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
      contacto_id: c.contacto_id,
      nombre: c.contacto.nombre,
      rol: c.rol,
      email: c.contacto.email,
      telefono: c.contacto.telefono,
      whatsapp: c.contacto.whatsapp,
      cargo: c.contacto.cargo,
      es_principal: c.contacto.es_principal,
    })),
    // Mismo serializador que la agenda y los endpoints (lib/actividad-input). Este mapeo
    // a mano todavía emitía exitosa/estado_accion/estado_plan: campos que ya nadie lee
    // (SOL-21/23 los reemplazó por es_tarea + completada) y que seguían viajando al front.
    actividades: deal.actividades.map(serializeActividad),
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
      canales={canales}
      origenes={origenes}
      motivos={motivos.map((m) => m.nombre)}
      tiposAccion={tiposAccion}
      resultadosAccion={resultadosAccion}
      sugerirAvanceInicial={view.cruzaAvance}
    />
  );
}
