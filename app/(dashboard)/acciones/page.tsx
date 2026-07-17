import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { scopeDealWhere } from "@/lib/access-control";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import AccionesInbox from "@/components/pipeline/AccionesInbox";
import { parseAccionesFiltros } from "@/lib/acciones-filtros";
import { WHERE_TAREA_PENDIENTE } from "@/lib/tareas";
import type { Metadata } from "next";
import type { AccionItem, Temperatura } from "@/types/crm";

export const metadata: Metadata = { title: "Próximas Acciones" };
export const dynamic = "force-dynamic";

export default async function AccionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialFiltros = parseAccionesFiltros(await searchParams);
  const session = await getServerSession();
  // Próximas Acciones: seguimientos pendientes / en proceso (no terminados) de
  // deals activos. Scope por vendedor en sesión (REQ-01): el VENDEDOR solo ve los
  // suyos; ADMIN/GERENTE ven todos y filtran con el dropdown.
  const dealScope = scopeDealWhere(session, { resultado: "ABIERTO" });

  const [tareas, vendedores] = await Promise.all([
    prisma.dealActividad.findMany({
      where: { ...WHERE_TAREA_PENDIENTE, deal: dealScope },
      include: {
        contacto: { select: { contacto: { select: { nombre: true } } } },
        deal: {
          select: {
            id: true,
            nombre: true,
            valor: true,
            ajuste_manual: true,
            stage_id: true,
            created_at: true,
            vendedor: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha_tarea: "asc" },
    }),
    prisma.vendedor.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  // Temperatura derivada por deal (SSOT): actividades de todos los deals de la lista en una query batch
  const dealIds = [...new Set(tareas.map((t) => t.deal.id))];
  const [ctx, actsScore] = await Promise.all([
    getScoringContext(),
    prisma.dealActividad.findMany({
      where: { deal_id: { in: dealIds }, eliminada: false },
      select: { deal_id: true, tipo_accion_id: true, resultado_id: true, created_at: true },
    }),
  ]);
  const actsByDeal = new Map<string, { tipo_accion_id: string | null; resultado_id: string | null; created_at: Date }[]>();
  for (const a of actsScore) {
    const arr = actsByDeal.get(a.deal_id) ?? [];
    arr.push({ tipo_accion_id: a.tipo_accion_id, resultado_id: a.resultado_id, created_at: a.created_at });
    actsByDeal.set(a.deal_id, arr);
  }
  const ahora = new Date();
  const tempByDeal = new Map<string, Temperatura>();
  for (const t of tareas) {
    if (tempByDeal.has(t.deal.id)) continue;
    tempByDeal.set(
      t.deal.id,
      dealScoreView(ctx, { ajuste_manual: t.deal.ajuste_manual, stage_id: t.deal.stage_id, created_at: t.deal.created_at, actividades: actsByDeal.get(t.deal.id) ?? [] }, ahora).temperatura
    );
  }

  const acciones: AccionItem[] = tareas.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    contenido: t.contenido,
    fecha_tarea: t.fecha_tarea ? t.fecha_tarea.toISOString() : null,
    es_tarea: t.es_tarea,
    completada: t.completada,
    contacto_nombre: t.contacto?.contacto?.nombre ?? null,
    deal: {
      id: t.deal.id,
      nombre: t.deal.nombre,
      valor: Number(t.deal.valor),
      temperatura: tempByDeal.get(t.deal.id) ?? "TIBIO",
      vendedor: t.deal.vendedor,
    },
  }));

  // El VENDEDOR no necesita el dropdown (ya está scopeado a lo suyo)
  const mostrarFiltroVendedor = session?.rol !== "VENDEDOR";

  return (
    <AccionesInbox
      acciones={acciones}
      vendedores={vendedores}
      initialFiltros={initialFiltros}
      mostrarFiltroVendedor={mostrarFiltroVendedor}
    />
  );
}
