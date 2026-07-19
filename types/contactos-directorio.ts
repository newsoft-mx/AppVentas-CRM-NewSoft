import type { EstatusCliente } from "@/types/crm";
import type { RolContacto, TipoActividad } from "@/types/crm";

// Directorio de contactos (Módulo Contactos v1): un contacto SIEMPRE cuelga de un cliente
// (que puede ser PROSPECTO/ACTIVO/INACTIVO). El directorio los lista a todos, con su
// organización y un resumen de participación en deals. No hay contacto "sin cliente".

/** Fila del listado: datos + resumen de deals + última actividad (agregados en server). */
export interface ContactoDirectorioItem {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  es_principal: boolean;
  cliente: { id: string; nombre: string; estatus: EstatusCliente };
  num_deals: number;
  roles: RolContacto[]; // roles distintos que tiene en sus deals
  responsables: { id: string; nombre: string }[]; // vendedores de sus deals (filtro "Responsable")
  ultima_actividad: string | null; // ISO de la actividad más reciente en sus deals
}

/** Organización elegible al crear un contacto (el contacto siempre cuelga de un cliente). */
export interface OrganizacionOpcion {
  id: string;
  nombre: string;
  estatus: EstatusCliente;
}

/** Campos editables de un contacto (crear/editar). */
export interface ContactoFormInput {
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  whatsapp: string;
}

/** Deal en el que participa el contacto (para el detalle). */
export interface ContactoDealItem {
  deal_id: string; // link DealContacto.id (para registrar actividad contra este contacto)
  id: string; // Deal.id (para navegar al detalle)
  nombre: string;
  stage: string | null;
  resultado: string;
  rol: RolContacto;
}

/** Actividad del contacto, agregada de todos sus deals (timeline del detalle). */
export interface ContactoActividadItem {
  id: string;
  tipo: TipoActividad;
  tipo_accion: string | null;
  contenido: string;
  cuando: string; // ISO: fecha_evento ?? fecha_tarea ?? created_at
  es_tarea: boolean;
  completada: boolean;
  resultado: string | null;
  deal_id: string; // Deal.id
  deal_nombre: string;
}

/** Respuesta del detalle de un contacto. */
export interface ContactoDetalle {
  contacto: ContactoDirectorioItem;
  deals: ContactoDealItem[];
  actividades: ContactoActividadItem[];
}
