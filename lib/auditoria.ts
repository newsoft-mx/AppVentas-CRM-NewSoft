import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Bitácora de auditoría — SSOT de "qué se audita y cómo se compara".
//
// Principio: NO se audita todo. Solo las entidades que mueven dinero o cambian las reglas
// del negocio, y dentro de ellas solo los campos de la LISTA BLANCA de abajo. Todo lo demás
// (lecturas, navegación, campos cosméticos) no deja rastro: una bitácora con ruido no se lee.
//
// Es APPEND-ONLY: se escribe y se consulta, nunca se edita ni se borra.
//
// Visibilidad (decidida con el negocio):
//  · La bitácora DENTRO de una ficha (ej. una orden) la ve cualquiera que pueda ver la ficha:
//    si alguien de gestión o ventas entra a una orden, debe ver qué se modificó.
//  · La vista GLOBAL (todos los módulos, todos los usuarios) es solo de ADMIN.

export type EntidadAuditable = "orden_venta" | "cliente" | "configuracion" | "usuario";
export type AccionAuditable = "CREAR" | "EDITAR" | "BORRAR";

/**
 * Lista blanca: campo → etiqueta legible. Lo que no está acá, no se audita.
 * La etiqueta es la que ve el usuario en la bitácora (no el nombre técnico de la columna).
 */
export const CAMPOS_AUDITADOS: Record<EntidadAuditable, Record<string, string>> = {
  // Lo que impacta el dinero de una orden.
  orden_venta: {
    total: "Total",
    cliente: "Cliente",
    estatus: "Estatus",
    tipo: "Tipo",
    fecha_venta: "Fecha de venta",
    vigencia: "Vigencia",
  },
  // Datos que afectan facturación y relación comercial.
  cliente: {
    nombre: "Nombre",
    rfc: "RFC",
    condicion_pago: "Condición de pago",
    estatus: "Estatus",
    activo: "Activo",
  },
  // Reglas del negocio: cambian cómo se comporta el sistema para todos.
  configuracion: {
    // Genéricos de catálogo (tipos, condiciones, motivos…)
    nombre: "Nombre",
    valor: "Valor",
    activo: "Activo",
    // Parámetros del motor del CRM (scoring y avance de etapa)
    avance_modo: "Modo de avance",
    umbral_inactividad_dias: "Días de gracia",
    score_inicial: "Score inicial",
    decay_por_dia: "Enfriamiento por día",
    sensibilidad_prob: "Sensibilidad de probabilidad",
    niveles_umbral: "Cortes de nivel",
    vendedor_leads_web_id: "Buzón de leads web",
  },
  // Seguridad: quién tiene acceso a qué.
  usuario: {
    email: "Email",
    rol: "Rol",
    activo: "Activo",
    vendedor: "Vendedor asociado",
  },
};

/** Un cambio concreto, ya listo para mostrar. */
export interface CambioCampo {
  campo: string;
  label: string;
  antes: string | null;
  despues: string | null;
}

/** Normaliza un valor a texto mostrable (o null). Fechas → YYYY-MM-DD; números → string. */
export function normalizarValor(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return String(v);
  return String(v);
}

/**
 * Compara "antes" contra "después" SOLO en los campos de la lista blanca de la entidad.
 * Función pura y testeable: es el corazón de la bitácora. Devuelve [] si no cambió nada
 * relevante — en ese caso el caller NO debe escribir un registro (bitácora sin ruido).
 *
 * Los valores llegan ya resueltos para mostrar (ej. `cliente` es el NOMBRE, no el id):
 * una bitácora que dice "cliente pasó de un uuid a otro uuid" no le sirve a nadie.
 */
export function diffCampos(
  entidad: EntidadAuditable,
  antes: Record<string, unknown>,
  despues: Record<string, unknown>
): CambioCampo[] {
  const campos = CAMPOS_AUDITADOS[entidad];
  const cambios: CambioCampo[] = [];
  for (const [campo, label] of Object.entries(campos)) {
    // Solo se evalúa lo que el caller mandó en "después" (un PATCH parcial no toca el resto).
    if (!(campo in despues)) continue;
    const a = normalizarValor(antes[campo]);
    const d = normalizarValor(despues[campo]);
    if (a !== d) cambios.push({ campo, label, antes: a, despues: d });
  }
  return cambios;
}

/**
 * Escribe una entrada de la bitácora. No lanza: la auditoría NUNCA debe tumbar la operación
 * que la originó (si falla, se registra en el log del server y la operación sigue).
 */
export async function registrarAuditoria(entrada: {
  entidad: EntidadAuditable;
  entidad_id: string;
  accion: AccionAuditable;
  /** Etiqueta legible del registro (ej. folio de la orden). */
  etiqueta?: string | null;
  autor: string;
  user_id?: string | null;
  cambios: CambioCampo[];
}): Promise<void> {
  // Un EDITAR que no cambió ningún campo auditado no se registra (evita ruido).
  if (entrada.accion === "EDITAR" && entrada.cambios.length === 0) return;
  try {
    await prisma.auditoriaLog.create({
      data: {
        entidad: entrada.entidad,
        entidad_id: entrada.entidad_id,
        accion: entrada.accion,
        etiqueta: entrada.etiqueta ?? null,
        autor: entrada.autor,
        user_id: entrada.user_id ?? null,
        cambios: entrada.cambios as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Nunca romper la operación de negocio por un fallo de auditoría.
    console.error("[auditoria] no se pudo registrar la entrada", err);
  }
}
