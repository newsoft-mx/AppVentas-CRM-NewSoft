import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { scopeDealWhere } from "@/lib/access-control";
import AccionesInbox from "@/components/pipeline/AccionesInbox";
import type { Metadata } from "next";
import type { AccionItem, Temperatura } from "@/types/crm";

export const metadata: Metadata = { title: "Próximas Acciones" };
export const dynamic = "force-dynamic";

export default async function AccionesPage() {
  const session = await getServerSession();
  // Próximas Acciones: seguimientos pendientes / en proceso (no terminados) de
  // deals activos. Scope por vendedor en sesión (REQ-01): el VENDEDOR solo ve los
  // suyos; ADMIN/GERENTE ven todos y filtran con el dropdown.
  const dealScope = scopeDealWhere(session, { resultado: "ABIERTO" });

  const [tareas, vendedores] = await Promise.all([
    prisma.dealActividad.findMany({
      where: {
        es_tarea: true,
        completada: false,
        fecha_tarea: { not: null },
        deal: dealScope,
      },
      include: {
        contacto: { select: { nombre: true } },
        deal: {
          select: {
            id: true,
            nombre: true,
            valor: true,
            temperatura: true,
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

  const acciones: AccionItem[] = tareas.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    contenido: t.contenido,
    fecha_tarea: t.fecha_tarea ? t.fecha_tarea.toISOString() : null,
    estado_accion: t.estado_accion,
    contacto_nombre: t.contacto?.nombre ?? null,
    deal: {
      id: t.deal.id,
      nombre: t.deal.nombre,
      valor: Number(t.deal.valor),
      temperatura: t.deal.temperatura as Temperatura,
      vendedor: t.deal.vendedor,
    },
  }));

  // El VENDEDOR no necesita el dropdown (ya está scopeado a lo suyo)
  const mostrarFiltroVendedor = session?.rol !== "VENDEDOR";

  return (
    <AccionesInbox
      acciones={acciones}
      vendedores={vendedores}
      mostrarFiltroVendedor={mostrarFiltroVendedor}
    />
  );
}
