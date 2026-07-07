import { prisma } from "@/lib/prisma";
import AccionesInbox from "@/components/pipeline/AccionesInbox";
import type { Metadata } from "next";
import type { AccionItem, Temperatura } from "@/types/crm";

export const metadata: Metadata = { title: "Mis acciones" };
export const dynamic = "force-dynamic";

export default async function AccionesPage() {
  // Inbox: tareas pendientes de la bitácora, de deals activos.
  // Visibilidad abierta (todos ven todo) — coherente con el pipeline.
  const [tareas, vendedores] = await Promise.all([
    prisma.dealActividad.findMany({
      where: { es_tarea: true, completada: false, deal: { resultado: "ABIERTO" } },
      include: {
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
    fecha_tarea: t.fecha_tarea ? t.fecha_tarea.toISOString().slice(0, 10) : null,
    deal: {
      id: t.deal.id,
      nombre: t.deal.nombre,
      valor: Number(t.deal.valor),
      temperatura: t.deal.temperatura as Temperatura,
      vendedor: t.deal.vendedor,
    },
  }));

  return <AccionesInbox acciones={acciones} vendedores={vendedores} />;
}
