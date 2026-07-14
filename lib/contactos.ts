/**
 * Servicio de contactos — Newsoft Sales (Bloque C: unificación de contactos)
 *
 * SSOT de la regla del "principal": el Contacto con es_principal=true espeja
 * Cliente.contacto/email/telefono (lo que leen PDF, detalle de orden, conversión
 * y búsqueda). Toda alta/edición/borrado de contactos o cambio de principal pasa
 * por acá para que el espejo nunca diverja y siempre haya exactamente un principal.
 *
 * Todas las funciones reciben un cliente de transacción (tx) para que el llamador
 * las componga atómicamente con el resto de su escritura.
 */

import type { Prisma, RolContacto } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

export interface ContactoInput {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  cargo?: string | null;
}

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

function normalizar(datos: ContactoInput) {
  return {
    nombre: (datos.nombre ?? "").trim(),
    email: clean(datos.email),
    telefono: clean(datos.telefono),
    whatsapp: clean(datos.whatsapp),
    cargo: clean(datos.cargo),
  };
}

/**
 * Espeja el contacto principal (activo) del cliente sobre Cliente.contacto/email/telefono.
 * Es el ÚNICO lugar donde se escriben esos campos derivados.
 */
export async function sincronizarPrincipal(tx: TxClient, clienteId: string): Promise<void> {
  const principal = await tx.contacto.findFirst({
    where: { cliente_id: clienteId, es_principal: true, activo: true },
    select: { nombre: true, email: true, telefono: true },
  });
  if (!principal) return; // se preserva el invariante en las funciones que mutan el principal
  await tx.cliente.update({
    where: { id: clienteId },
    data: { contacto: principal.nombre, email: principal.email, telefono: principal.telefono },
  });
}

/**
 * Reconciliación desde el Cliente: los formularios de Cliente (alta/edición/conversión/
 * import) siguen capturando contacto/email/telefono en la ficha. Este helper mantiene el
 * Contacto principal igual a esos campos — lo crea si el cliente aún no tiene principal.
 * Deja Cliente.* y el principal equivalentes desde cualquier lado que escriba.
 */
export async function asegurarPrincipalDesdeCliente(tx: TxClient, clienteId: string): Promise<void> {
  const cliente = await tx.cliente.findUniqueOrThrow({
    where: { id: clienteId },
    select: { contacto: true, email: true, telefono: true },
  });
  const principal = await tx.contacto.findFirst({
    where: { cliente_id: clienteId, es_principal: true, activo: true },
    select: { id: true },
  });
  const datos = { nombre: cliente.contacto, email: cliente.email, telefono: cliente.telefono };
  if (principal) {
    await tx.contacto.update({ where: { id: principal.id }, data: datos });
  } else {
    await tx.contacto.create({ data: { cliente_id: clienteId, ...datos, es_principal: true, activo: true } });
  }
}

/**
 * Crea el contacto PRINCIPAL de un cliente recién creado (prospecto/cliente nuevo).
 * Deja Cliente.* sincronizado. Asume que el cliente aún no tiene principal.
 */
export async function crearContactoPrincipal(tx: TxClient, clienteId: string, datos: ContactoInput) {
  const n = normalizar(datos);
  const contacto = await tx.contacto.create({
    data: { cliente_id: clienteId, ...n, es_principal: true, activo: true },
  });
  await sincronizarPrincipal(tx, clienteId);
  return contacto;
}

/**
 * Devuelve un Contacto activo del cliente que matchee por email (si viene) o por
 * nombre (case-insensitive); si no existe, lo crea como no-principal. Evita duplicar
 * al principal cuando el contacto del deal es la misma persona del cliente.
 */
export async function crearOEncontrarContacto(tx: TxClient, clienteId: string, datos: ContactoInput) {
  const n = normalizar(datos);
  const candidatos = await tx.contacto.findMany({
    where: { cliente_id: clienteId, activo: true },
    select: { id: true, nombre: true, email: true },
  });
  const existente =
    (n.email && candidatos.find((c) => c.email && c.email.toLowerCase() === n.email!.toLowerCase())) ||
    candidatos.find((c) => c.nombre.toLowerCase() === n.nombre.toLowerCase());
  if (existente) return tx.contacto.findUniqueOrThrow({ where: { id: existente.id } });
  return tx.contacto.create({
    data: { cliente_id: clienteId, ...n, es_principal: false, activo: true },
  });
}

/**
 * Vincula (o revincula) un contacto a un deal con su rol por-deal. Idempotente
 * gracias al @@unique(deal_id, contacto_id): si ya existe el link, actualiza el rol.
 */
export async function vincularContactoADeal(
  tx: TxClient,
  dealId: string,
  contactoId: string,
  rol: RolContacto
) {
  return tx.dealContacto.upsert({
    where: { deal_id_contacto_id: { deal_id: dealId, contacto_id: contactoId } },
    create: { deal_id: dealId, contacto_id: contactoId, rol },
    update: { rol },
  });
}

/**
 * Edita los datos de un contacto compartido. Si es el principal, re-sincroniza el
 * espejo del cliente. Devuelve el contacto actualizado.
 */
export async function editarContacto(tx: TxClient, contactoId: string, datos: ContactoInput) {
  const n = normalizar(datos);
  const contacto = await tx.contacto.update({ where: { id: contactoId }, data: n });
  if (contacto.es_principal) await sincronizarPrincipal(tx, contacto.cliente_id);
  return contacto;
}

/**
 * Marca un contacto como principal del cliente: desmarca los demás, lo marca a él,
 * y sincroniza el espejo. Garantiza exactamente-un-principal.
 */
export async function marcarPrincipal(tx: TxClient, clienteId: string, contactoId: string) {
  await tx.contacto.updateMany({
    where: { cliente_id: clienteId, es_principal: true },
    data: { es_principal: false },
  });
  await tx.contacto.update({ where: { id: contactoId }, data: { es_principal: true, activo: true } });
  await sincronizarPrincipal(tx, clienteId);
}

// Error tipado para que el endpoint devuelva 409 en vez de 500.
export class ContactoError extends Error {}

/**
 * Soft-delete de un contacto (activo=false). No se borra en duro para no romper
 * links de deals ni la bitácora. Invariante: un cliente nunca queda sin principal.
 * - Si es el único contacto activo → se bloquea (ContactoError).
 * - Si es el principal → promueve al más antiguo de los otros activos antes de bajarlo.
 */
export async function desactivarContacto(tx: TxClient, contactoId: string) {
  const contacto = await tx.contacto.findUniqueOrThrow({
    where: { id: contactoId },
    select: { id: true, cliente_id: true, es_principal: true, activo: true },
  });
  const otros = await tx.contacto.findMany({
    where: { cliente_id: contacto.cliente_id, activo: true, id: { not: contactoId } },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });
  if (otros.length === 0) {
    throw new ContactoError("No se puede eliminar el único contacto del cliente.");
  }
  if (contacto.es_principal) {
    await marcarPrincipal(tx, contacto.cliente_id, otros[0].id);
  }
  await tx.contacto.update({ where: { id: contactoId }, data: { activo: false, es_principal: false } });
}
