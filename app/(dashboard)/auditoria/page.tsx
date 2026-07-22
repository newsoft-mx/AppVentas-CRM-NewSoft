import { getServerSession } from "@/lib/server-session";
import { isAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AuditoriaClient from "@/components/auditoria/AuditoriaClient";
import type { CambioCampo } from "@/lib/auditoria";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bitácora" };
export const dynamic = "force-dynamic";

// Vista GLOBAL de la bitácora: todos los módulos y todos los usuarios. Solo ADMIN — la
// bitácora de una ficha (ej. dentro de una orden) sí la ve cualquiera que pueda verla.
export default async function AuditoriaPage() {
  const session = await getServerSession();
  if (!session || !isAdmin(session)) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-12 text-center text-gray-400">
        Esta sección es solo para administradores.
      </div>
    );
  }

  const registros = await prisma.auditoriaLog.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true, entidad: true, entidad_id: true, accion: true,
      etiqueta: true, autor: true, cambios: true, created_at: true,
    },
  });

  return (
    <AuditoriaClient
      initial={registros.map((r) => ({
        ...r,
        cambios: (r.cambios as unknown as CambioCampo[]) ?? [],
        created_at: r.created_at.toISOString(),
      }))}
    />
  );
}
