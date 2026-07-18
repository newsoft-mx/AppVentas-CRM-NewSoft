import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { isAdmin } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import EliminadosClient from "@/components/pipeline/EliminadosClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leads eliminados" };
export const dynamic = "force-dynamic";

// La contracara del borrado (SOL borrar-leads): ADMIN ve los leads MARCADOS como
// eliminados y puede restaurarlos. Los destruidos físicamente no están acá: eran basura
// sin trabajo, y eso fue intencional. Solo ADMIN — no es una papelera que todos gestionan.
export default async function EliminadosPage() {
  const session = await getServerSession();
  if (!isAdmin(session)) notFound(); // 404, no revela que la ruta existe a quien no es admin

  // incluirEliminados invierte el candado: acá QUEREMOS ver los que el resto oculta.
  const deals = await prisma.deal.findMany({
    where: scopeDealWhere(session, { eliminada: true }, { incluirEliminados: true }),
    orderBy: { eliminada_at: "desc" },
    select: {
      id: true,
      nombre: true,
      eliminada_at: true,
      eliminada_por: true,
      motivo_eliminacion: true,
      cliente: { select: { nombre: true } },
      _count: { select: { actividades: { where: { eliminada: false, tipo: { not: "SISTEMA" } } } } },
    },
  });

  return (
    <EliminadosClient
      deals={deals.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        cliente: d.cliente?.nombre ?? "Sin cliente",
        eliminada_at: d.eliminada_at ? d.eliminada_at.toISOString() : null,
        eliminada_por: d.eliminada_por,
        motivo: d.motivo_eliminacion,
        actividades: d._count.actividades,
      }))}
    />
  );
}
