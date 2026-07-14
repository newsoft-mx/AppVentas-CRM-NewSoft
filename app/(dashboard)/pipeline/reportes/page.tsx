import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { puedeElegirVendedor } from "@/lib/reportes-funnel";
import { parseFunnelFiltros } from "@/lib/funnel-filtros";
import FunnelReportes from "@/components/reportes/FunnelReportes";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reportes de Funnel" };
export const dynamic = "force-dynamic";

export default async function ReportesFunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialFiltros = parseFunnelFiltros(await searchParams);
  const session = await getServerSession();
  const puedeElegir = puedeElegirVendedor(session);

  // La lista de vendedores solo se necesita para el selector de alcance (ADMIN/GERENTE).
  const vendedores = puedeElegir
    ? await prisma.vendedor.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      })
    : [];

  return <FunnelReportes puedeElegir={puedeElegir} vendedores={vendedores} initialFiltros={initialFiltros} />;
}
