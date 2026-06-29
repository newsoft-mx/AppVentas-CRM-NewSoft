import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { estadoAtencion } from "@/lib/atencion";
import { getCrmConfig, toParametrosTermometro } from "@/lib/crm-config";
import { temperaturaEfectiva } from "@/lib/termometro";
import PipelineKanban from "@/components/pipeline/PipelineKanban";
import type { Metadata } from "next";
import type { DealResumen, StageResumen, Temperatura } from "@/types/crm";

export const metadata: Metadata = { title: "Pipeline CRM" };
export const dynamic = "force-dynamic";

// Días transcurridos (UTC) desde que el deal entró a su etapa actual
function diasEnEtapa(desde: Date): number {
  const ms = Date.now() - desde.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function PipelinePage() {
  const session = await getServerSession();

  // Visibilidad abierta: todos los vendedores ven todos los deals (decisión de negocio).
  const [stages, deals, vendedores, clientes, tipos] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, orden: true, color: true },
    }),
    prisma.deal.findMany({
      where: { resultado: { in: ["ABIERTO", "SUSPENDIDO"] } },
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        _count: { select: { actividades: true } },
        // Próximo seguimiento pendiente (tarea agendada más cercana)
        actividades: {
          where: { es_tarea: true, completada: false, fecha_tarea: { not: null } },
          orderBy: { fecha_tarea: "asc" },
          take: 1,
          select: { fecha_tarea: true },
        },
      },
      orderBy: { created_at: "desc" },
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
  ]);

  // Última actividad por deal — acotada a los deals cargados (no escanea todo el histórico)
  // + parámetros del termómetro/atención
  const dealIds = deals.map((d) => d.id);
  const [ultimas, config] = await Promise.all([
    prisma.dealActividad.groupBy({
      by: ["deal_id"],
      where: { deal_id: { in: dealIds } },
      _max: { created_at: true },
    }),
    getCrmConfig(),
  ]);
  const ultimaPorDeal = new Map(ultimas.map((u) => [u.deal_id, u._max.created_at]));
  const params = toParametrosTermometro(config);
  const ahora = new Date();

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
    const atencion = estadoAtencion(atencionInput, ahora, config.umbral_inactividad_dias).estado;
    // Temperatura efectiva: enfriada si el deal lleva inactivo más del umbral (display)
    const tempEfectiva = temperaturaEfectiva(
      d.temperatura as Temperatura,
      ultimaPorDeal.get(d.id) ?? null,
      config.umbral_inactividad_dias,
      params,
      ahora
    );

    return {
      id: d.id,
      nombre: d.nombre,
      valor: Number(d.valor),
      moneda: d.moneda,
      temperatura: tempEfectiva,
      probabilidad: d.probabilidad,
      resultado: d.resultado,
      stage_id: d.stage_id,
      dias_en_etapa: diasEnEtapa(d.fecha_entrada_stage),
      actividades_count: d._count.actividades,
      proximo_seguimiento: proximo ? proximo.toISOString() : null,
      atencion,
      cliente: d.cliente ? { id: d.cliente.id, nombre: d.cliente.nombre } : null,
      vendedor: d.vendedor ? { id: d.vendedor.id, nombre: d.vendedor.nombre } : null,
      tipo: d.tipo_cotizacion ? { id: d.tipo_cotizacion.id, nombre: d.tipo_cotizacion.nombre } : null,
    };
  });

  return (
    <PipelineKanban
      stages={stagesSerialized}
      deals={dealsSerialized}
      vendedores={vendedores}
      clientes={clientes}
      tipos={tipos}
      canWrite={canWrite(session)}
    />
  );
}
