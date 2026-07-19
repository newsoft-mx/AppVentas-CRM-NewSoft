export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { scopeClienteWhere } from "@/lib/access-control";
import { CONTACTO_DIRECTORIO_INCLUDE, toDirectorioItem } from "@/lib/contactos-directorio";
import type { ContactoActividadItem, ContactoDealItem, ContactoDetalle } from "@/types/contactos-directorio";
import type { RolContacto, TipoActividad } from "@/types/crm";

// GET /api/contactos/[id] — detalle del contacto para el drawer del directorio: sus deals y el
// timeline de acciones agregado de todos ellos. Scoping por rol vía scopeClienteWhere (un
// VENDEDOR no puede leer un contacto fuera de sus clientes/deals → 404).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const contacto = await prisma.contacto.findFirst({
    where: { id, activo: true, cliente: scopeClienteWhere(session, { activo: true }) },
    include: {
      ...CONTACTO_DIRECTORIO_INCLUDE,
      deal_links: {
        select: {
          id: true,
          rol: true,
          deal: {
            select: {
              id: true, nombre: true, resultado: true,
              stage: { select: { nombre: true } },
              vendedor: { select: { id: true, nombre: true } },
            },
          },
          actividades: {
            where: { eliminada: false },
            orderBy: { created_at: "desc" },
            select: {
              id: true, tipo: true, contenido: true, es_tarea: true, completada: true,
              fecha_evento: true, fecha_tarea: true, created_at: true,
              tipo_accion: { select: { nombre: true } },
              resultado: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });
  if (!contacto) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  const deals: ContactoDealItem[] = contacto.deal_links.map((l) => ({
    deal_id: l.id,
    id: l.deal.id,
    nombre: l.deal.nombre,
    stage: l.deal.stage?.nombre ?? null,
    resultado: l.deal.resultado,
    rol: l.rol as RolContacto,
  }));

  const actividades: ContactoActividadItem[] = contacto.deal_links
    .flatMap((l) =>
      l.actividades.map((a) => ({
        id: a.id,
        tipo: a.tipo as TipoActividad,
        tipo_accion: a.tipo_accion?.nombre ?? null,
        contenido: a.contenido,
        cuando: (a.fecha_evento ?? a.fecha_tarea ?? a.created_at).toISOString(),
        es_tarea: a.es_tarea,
        completada: a.completada,
        resultado: a.resultado?.nombre ?? null,
        deal_id: l.deal.id,
        deal_nombre: l.deal.nombre,
      }))
    )
    .sort((a, b) => b.cuando.localeCompare(a.cuando));

  const detalle: ContactoDetalle = { contacto: toDirectorioItem(contacto), deals, actividades };
  return NextResponse.json(detalle);
}
