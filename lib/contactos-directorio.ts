import type { Prisma } from "@prisma/client";
import type { ContactoDirectorioItem } from "@/types/contactos-directorio";
import type { RolContacto } from "@/types/crm";

// SSOT de la forma en que un Contacto (con sus relaciones) se resume para el directorio.
// Lo comparten la página del listado y el endpoint de detalle: una sola definición del
// include + del mapeo, para que el resumen no diverja entre pantallas.

// Include mínimo para armar una fila del directorio: cliente (organización) + los links a
// deals con la última actividad de cada uno (para derivar #deals, roles y última actividad).
export const CONTACTO_DIRECTORIO_INCLUDE = {
  cliente: { select: { id: true, nombre: true, estatus: true } },
  deal_links: {
    select: {
      rol: true,
      deal: { select: { vendedor: { select: { id: true, nombre: true } } } },
      actividades: {
        where: { eliminada: false },
        orderBy: { created_at: "desc" },
        take: 1,
        select: { created_at: true, fecha_evento: true, fecha_tarea: true },
      },
    },
  },
} satisfies Prisma.ContactoInclude;

type ContactoConLinks = Prisma.ContactoGetPayload<{ include: typeof CONTACTO_DIRECTORIO_INCLUDE }>;

// El instante "más reciente" de una actividad: preferimos cuándo ocurrió/se agendó; si no,
// cuándo se registró. Devuelve ms epoch (0 si no hay).
function instanteActividad(a: { created_at: Date; fecha_evento: Date | null; fecha_tarea: Date | null }): number {
  return (a.fecha_evento ?? a.fecha_tarea ?? a.created_at).getTime();
}

export function toDirectorioItem(c: ContactoConLinks): ContactoDirectorioItem {
  const roles = [...new Set(c.deal_links.map((l) => l.rol as RolContacto))];
  // Responsables = vendedores distintos de sus deals (para el filtro "Responsable").
  const responsables = [
    ...new Map(
      c.deal_links
        .map((l) => l.deal.vendedor)
        .filter((v): v is { id: string; nombre: string } => v != null)
        .map((v) => [v.id, v])
    ).values(),
  ];
  const ultimaMs = Math.max(
    0,
    ...c.deal_links.flatMap((l) => l.actividades.map(instanteActividad))
  );
  return {
    id: c.id,
    nombre: c.nombre,
    cargo: c.cargo,
    email: c.email,
    telefono: c.telefono,
    whatsapp: c.whatsapp,
    es_principal: c.es_principal,
    cliente: { id: c.cliente.id, nombre: c.cliente.nombre, estatus: c.cliente.estatus },
    num_deals: c.deal_links.length,
    roles,
    responsables,
    ultima_actividad: ultimaMs > 0 ? new Date(ultimaMs).toISOString() : null,
  };
}
