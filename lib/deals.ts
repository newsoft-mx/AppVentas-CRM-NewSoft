import { Prisma } from "@prisma/client";
import { crearContactoPrincipal, crearOEncontrarContacto, type ContactoInput } from "@/lib/contactos";
import type { RolContacto, TamanoEmpresa } from "@/types/crm";

// Error de validación dentro de la transacción de alta → se traduce a HTTP con campo.
export class HttpError extends Error {
  constructor(public status: number, message: string, public campo?: string) {
    super(message);
  }
}

// Datos normalizados para dar de alta un deal. Lo arman los callers (route interno con
// sesión, o intake público desde web): la lógica de creación vive acá una sola vez (SSOT).
export interface CrearDealInput {
  nombre: string;
  cliente_id?: string; // si viene un cliente existente, se usa
  prospecto?: { nombre: string; website?: string | null; tamano_empresa?: TamanoEmpresa | null };
  contacto: ContactoInput;
  contactoRol: RolContacto;
  stage_id: string;
  vendedor_id?: string | null;
  tipo_cotizacion_id?: string | null;
  moneda?: string;
  valor?: number;
  setup?: number | null;
  mensualidad?: number | null;
  meses?: number | null;
  canal_id?: string | null;
  origen_id?: string | null;
  fecha_cierre_estimada?: Date | null;
  notas?: string | null;
}

// Alta atómica de un deal (a correr DENTRO de una transacción `tx`): crea el prospecto si
// no hay cliente existente + su contacto principal + el deal + el link al contacto + el
// evento de entrada a la primera etapa. Devuelve el deal con includes para el resumen.
export async function crearDealTx(tx: Prisma.TransactionClient, input: CrearDealInput) {
  let clienteId = input.cliente_id ?? "";

  if (!clienteId && input.prospecto?.nombre) {
    const cond = await tx.condicionComercial.findFirst({
      where: { activo: true },
      orderBy: { dias_credito: "asc" },
      select: { id: true },
    });
    if (!cond) throw new HttpError(422, "No hay condiciones de pago configuradas");
    const prospecto = await tx.cliente.create({
      data: {
        nombre: input.prospecto.nombre,
        contacto: input.contacto.nombre,
        ciudad: "",
        email: input.contacto.email ?? null,
        telefono: input.contacto.telefono ?? null,
        website: input.prospecto.website ?? null,
        tamano_empresa: input.prospecto.tamano_empresa ?? null,
        condicion_pago_id: cond.id,
        estatus: "PROSPECTO",
      },
      select: { id: true },
    });
    clienteId = prospecto.id;
  }

  const cliente = await tx.cliente.findFirst({ where: { id: clienteId, activo: true }, select: { id: true } });
  if (!cliente) throw new HttpError(422, "Cliente inválido", "cliente_id");

  // El contacto del deal: para un prospecto nuevo es su PRINCIPAL; para un cliente
  // existente se reutiliza (o crea) sin duplicar al principal.
  const existePrincipal = await tx.contacto.count({
    where: { cliente_id: clienteId, es_principal: true, activo: true },
  });
  const contacto =
    existePrincipal === 0
      ? await crearContactoPrincipal(tx, clienteId, input.contacto)
      : await crearOEncontrarContacto(tx, clienteId, input.contacto);

  return tx.deal.create({
    data: {
      nombre: input.nombre,
      cliente_id: clienteId,
      stage_id: input.stage_id,
      vendedor_id: input.vendedor_id ?? null,
      tipo_cotizacion_id: input.tipo_cotizacion_id ?? null,
      // temperatura/probabilidad se DERIVAN del score (dealScoreView); no se persisten.
      moneda: input.moneda === "USD" ? "USD" : "MXN",
      valor: input.valor ?? 0,
      setup: input.setup ?? null,
      mensualidad: input.mensualidad ?? null,
      meses: input.meses != null ? Math.round(input.meses) : null,
      canal_id: input.canal_id ?? null,
      origen_id: input.origen_id ?? null,
      fecha_cierre_estimada: input.fecha_cierre_estimada ?? null,
      notas: input.notas ?? null,
      contactos: {
        create: [{ contacto_id: contacto.id, rol: input.contactoRol as Prisma.DealContactoCreateInput["rol"] }],
      },
      stage_events: { create: [{ to_stage_id: input.stage_id }] },
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      vendedor: { select: { id: true, nombre: true } },
      tipo_cotizacion: { select: { id: true, nombre: true } },
      contactos: { select: { contacto: { select: { nombre: true } } } },
    },
  });
}
