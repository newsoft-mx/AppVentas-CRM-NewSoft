import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import type { DealCompositor } from "@/components/pipeline/ActividadCompositor";
import { getScoringContext, dealScoreView } from "@/lib/deal-score";
import AccionesInbox from "@/components/pipeline/AccionesInbox";
import { parseAccionesFiltros } from "@/lib/acciones-filtros";
import { WHERE_TAREA_PENDIENTE } from "@/lib/tareas";
import { ACTIVIDAD_INCLUDE, serializeActividad } from "@/lib/actividad-input";
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

  const [tareas, vendedores, dealsAlta, tiposAccion, resultadosAccion] = await Promise.all([
    prisma.dealActividad.findMany({
      where: { ...WHERE_TAREA_PENDIENTE, deal: dealScope },
      include: {
        // Mismas relaciones que la bitácora: la agenda muestra la misma actividad, así que
        // la serializa el mismo lib/actividad-input en vez de recortarla a mano.
        ...ACTIVIDAD_INCLUDE,
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
    // Alta global (SOL-22): deal_id es NOT NULL, así que registrar desde la agenda exige
    // elegir un deal. Mismo scope que la lista (scopeDealWhere) → un VENDEDOR no puede
    // cargarle actividad a un deal ajeno. Se resuelve en el server: sin endpoint nuevo
    // ni fetch en cascada al abrir el compositor.
    prisma.deal.findMany({
      where: dealScope,
      select: {
        id: true,
        nombre: true,
        cliente: { select: { nombre: true } },
        contactos: { select: { id: true, contacto: { select: { nombre: true } } } },
      },
      orderBy: { created_at: "desc" },
    }),
    // Mismos catálogos que la bitácora del deal: el compositor es el mismo componente.
    prisma.tipoAccion.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, color: true, agendable: true },
    }),
    prisma.resultadoAccion.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, efecto: true, sugiere_reagendar: true },
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
    ...serializeActividad(t),
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

  // Opciones del selector "Deal — Cliente" del compositor.
  const dealsCompositor: DealCompositor[] = dealsAlta.map((d) => ({
    id: d.id,
    titulo: d.nombre,
    cliente_nombre: d.cliente?.nombre ?? "Sin cliente",
    contactos: d.contactos.map((c) => ({ id: c.id, nombre: c.contacto.nombre })),
  }));

  return (
    <AccionesInbox
      acciones={acciones}
      vendedores={vendedores}
      initialFiltros={initialFiltros}
      mostrarFiltroVendedor={mostrarFiltroVendedor}
      canWrite={canWrite(session)}
      deals={dealsCompositor}
      tiposAccion={tiposAccion}
      resultadosAccion={resultadosAccion}
    />
  );
}
