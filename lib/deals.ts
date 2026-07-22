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

// Borrado de leads.
//
// SSOT de "qué pasa cuando borrás un deal". El usuario hace UN gesto (Borrar) y no elige
// mecanismo: lo decide el costo del error.

/**
 * Qué se hace al borrar, y por qué. **Un deal se puede borrar SIEMPRE, en cualquier etapa**:
 * lo que decide la regla es *cómo* (destruir vs. marcar) y *quién* (los casos sensibles piden
 * ADMIN). Nada queda bloqueado — un callejón sin salida es peor que un borrado recuperable.
 */
export interface ClaseBorrado {
  /** FISICO: se destruye (no hay nada que recuperar). MARCAR: desaparece pero es recuperable. */
  clase: "FISICO" | "MARCAR";
  motivo: string;
  /** Casos sensibles (ganado / con orden de venta): solo un ADMIN puede borrarlos. */
  soloAdmin: boolean;
}

/** Lo mínimo para decidir. `actividades_reales` excluye las entradas SISTEMA (ver abajo). */
export interface DealParaBorrar {
  resultado: string;
  orden_id: string | null;
  actividades_reales: number;
  contactos: number;
}

/**
 * La regla. Un lead del form web llega virgen (0 actividades reales: el intake solo deja un
 * registro SISTEMA) → destruirlo no pierde nada y no ensucia la BD de basura. Uno con
 * bitácora encima es trabajo de alguien: desaparece igual, pero se puede volver.
 *
 * Con orden vinculada o ya ganado NO se destruye: es plata facturada y el Deal es lo que la
 * ata al pipeline. Pero tampoco se bloquea — se MARCA (recuperable) y se pide ADMIN. Antes
 * esto devolvía BLOQUEADO con el texto "cambiale el estado", y esa salida no existía:
 * GANADO es terminal en la máquina de estados → era un callejón sin salida.
 *
 * Por encima de todo esto, un ADMIN puede forzar la destrucción de cualquier cosa (última
 * instancia); eso lo resuelve el endpoint con `forzar`, no esta función.
 */
export function clasificarBorrado(d: DealParaBorrar): ClaseBorrado {
  if (d.orden_id) {
    return {
      clase: "MARCAR",
      motivo: "Tiene una orden de venta vinculada: se marca (recuperable) para no romper la trazabilidad del ingreso.",
      soloAdmin: true,
    };
  }
  if (d.resultado === "GANADO") {
    return {
      clase: "MARCAR",
      motivo: "Está marcado como ganado: se marca (recuperable), no se destruye.",
      soloAdmin: true,
    };
  }
  if (d.actividades_reales === 0) {
    return { clase: "FISICO", motivo: "Nadie registró actividad: no hay trabajo que conservar.", soloAdmin: false };
  }
  return {
    clase: "MARCAR",
    motivo: `Tiene ${d.actividades_reales} ${d.actividades_reales === 1 ? "actividad" : "actividades"} registradas.`,
    soloAdmin: false,
  };
}

/** ¿Puede este rol borrar deals? El VENDEDOR solo los suyos — eso lo aplica scopeDealWhere. */
export function puedeBorrarDeals(rol: string): boolean {
  return rol === "ADMIN" || rol === "GERENTE_COMERCIAL" || rol === "VENDEDOR";
}

/**
 * Forzar la destrucción de un deal YA trabajado es solo de ADMIN.
 *
 * Un vendedor borrando su propio trabajo para que no se vea es justo el escenario que el
 * soft-delete previene; dejarlo forzar el destruido lo reabre.
 */
export function puedeForzarDestruccion(rol: string): boolean {
  return rol === "ADMIN";
}
