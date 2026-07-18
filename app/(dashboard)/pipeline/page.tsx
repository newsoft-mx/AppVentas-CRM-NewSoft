import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite, isAdmin } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { estadoAtencion } from "@/lib/atencion";
import { WHERE_TAREA_PENDIENTE } from "@/lib/tareas";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import PipelineKanban from "@/components/pipeline/PipelineKanban";
import { parsePipelineFiltros } from "@/lib/pipeline-filtros";
import type { Metadata } from "next";
import type { DealResumen, StageResumen } from "@/types/crm";

export const metadata: Metadata = { title: "Pipeline CRM" };
export const dynamic = "force-dynamic";

// Días transcurridos (UTC) desde que el deal entró a su etapa actual
function diasEnEtapa(desde: Date): number {
  const ms = Date.now() - desde.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  // Filtros + orden iniciales desde la URL (persistencia compartida — pilar 3)
  const initialFiltros = parsePipelineFiltros(await searchParams);

  // Scoping por vendedor: el VENDEDOR solo ve SUS deals; ADMIN/GERENTE ven todos.
  const [stages, deals, vendedores, clientes, tipos, catalogoDeal] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, orden: true, color: true },
    }),
    // Todos los estados del deal (SOL-18): el filtro multi-estado decide cuáles se ven.
    prisma.deal.findMany({
      where: scopeDealWhere(session, { resultado: { in: ["ABIERTO", "SUSPENDIDO", "GANADO", "PERDIDO"] } }),
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        contactos: { select: { contacto: { select: { nombre: true } } } },
        _count: { select: { actividades: true } },
        // Próximo seguimiento pendiente (tarea agendada más cercana)
        actividades: {
          where: WHERE_TAREA_PENDIENTE,
          orderBy: { fecha_tarea: "asc" },
          take: 1,
          select: { fecha_tarea: true },
        },
      },
      // Orden por fecha de ingreso al pipeline (dato de negocio), no por created_at.
      orderBy: { fecha_ingreso: "desc" },
    }),
    prisma.vendedor.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipoCotizacion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.catalogoDeal.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);
  const canales = catalogoDeal.filter((c) => c.tipo === "CANAL").map(({ id, nombre }) => ({ id, nombre }));
  const origenes = catalogoDeal.filter((c) => c.tipo === "ORIGEN").map(({ id, nombre }) => ({ id, nombre }));

  // KPIs de altas por período (REQ-04): nuevos deals hoy / esta semana / este mes
  const ahora = new Date();
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const diaSemana = (inicioDia.getDay() + 6) % 7; // lunes = 0
  const inicioSemana = new Date(inicioDia);
  inicioSemana.setDate(inicioDia.getDate() - diaSemana);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  // Última actividad por deal — acotada a los deals cargados; + config + conteos por período
  const dealIds = deals.map((d) => d.id);
  const [actsScore, ctx, nuevosHoy, nuevosSemana, nuevosMes] = await Promise.all([
    // Actividades de todos los deals visibles en UNA query (para el score, sin N+1)
    prisma.dealActividad.findMany({
      where: { deal_id: { in: dealIds }, eliminada: false },
      orderBy: { created_at: "asc" },
      select: { deal_id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
    }),
    getScoringContext(),
    prisma.deal.count({ where: scopeDealWhere(session, { fecha_ingreso: { gte: inicioDia } }) }),
    prisma.deal.count({ where: scopeDealWhere(session, { fecha_ingreso: { gte: inicioSemana } }) }),
    prisma.deal.count({ where: scopeDealWhere(session, { fecha_ingreso: { gte: inicioMes } }) }),
  ]);
  // Agrupa por deal: actividades (para el score) + última fecha (para atención). asc → última gana.
  const actsByDeal = new Map<string, { tipo_accion_id: string | null; resultado_id: string | null; created_at: Date }[]>();
  const ultimaPorDeal = new Map<string, Date>();
  for (const a of actsScore) {
    const arr = actsByDeal.get(a.deal_id) ?? [];
    arr.push({ tipo_accion_id: a.tipo_accion_id, resultado_id: a.resultado_id, created_at: a.created_at });
    actsByDeal.set(a.deal_id, arr);
    ultimaPorDeal.set(a.deal_id, a.created_at);
  }

  const stagesSerialized: StageResumen[] = stages;

  const dealsSerialized: DealResumen[] = deals.map((d) => {
    const proximo = d.actividades[0]?.fecha_tarea ?? null;
    // estadoAtencion: si hay seguimiento futuro/vencido lo usa; si no, mide inactividad
    const atencionInput = proximo
      ? [{ es_tarea: true, completada: false, fecha_tarea: proximo, created_at: proximo }]
      : [
          {
            es_tarea: false,
            completada: false,
            fecha_tarea: null,
            created_at: ultimaPorDeal.get(d.id) ?? d.created_at,
          },
        ];
    const atencion = estadoAtencion(atencionInput, ahora, ctx.config.umbral_inactividad_dias).estado;
    // Score y sus derivaciones desde el SSOT (único punto de derivación)
    const view = dealScoreView(
      ctx,
      { ajuste_manual: d.ajuste_manual, stage_id: d.stage_id, created_at: d.created_at, actividades: actsByDeal.get(d.id) ?? [] },
      ahora
    );

    return {
      id: d.id,
      nombre: d.nombre,
      valor: Number(d.valor),
      moneda: d.moneda,
      temperatura: view.temperatura,
      probabilidad: view.probabilidad,
      resultado: d.resultado,
      stage_id: d.stage_id,
      dias_en_etapa: diasEnEtapa(d.fecha_entrada_stage),
      actividades_count: d._count.actividades,
      proximo_seguimiento: proximo ? proximo.toISOString() : null,
      atencion,
      cliente: d.cliente ? { id: d.cliente.id, nombre: d.cliente.nombre } : null,
      vendedor: d.vendedor ? { id: d.vendedor.id, nombre: d.vendedor.nombre } : null,
      tipo: d.tipo_cotizacion ? { id: d.tipo_cotizacion.id, nombre: d.tipo_cotizacion.nombre } : null,
      contactos: d.contactos.map((c) => c.contacto.nombre),
      razon_perdida: d.razon_perdida,
      fecha_ingreso: d.fecha_ingreso.toISOString(),
    };
  });

  return (
    <PipelineKanban
      initialFiltros={initialFiltros}
      stages={stagesSerialized}
      deals={dealsSerialized}
      vendedores={vendedores}
      clientes={clientes}
      tipos={tipos}
      canales={canales}
      origenes={origenes}
      canWrite={canWrite(session)}
      esAdmin={isAdmin(session)}
      altas={{ hoy: nuevosHoy, semana: nuevosSemana, mes: nuevosMes }}
    />
  );
}
