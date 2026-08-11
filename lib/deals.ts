import { Prisma } from "@prisma/client";
import { crearContactoPrincipal, crearOEncontrarContacto, type ContactoInput } from "@/lib/contactos";
import { RESULTADOS_CERRADOS } from "@/types/crm";
import type {
  ClaseBorrado, ClaseReapertura, DealParaBorrar, DealParaReabrir, DealResultado,
  RolContacto, TamanoEmpresa,
} from "@/types/crm";

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

// Qué se hace al borrar, y por qué. **Un deal se puede borrar SIEMPRE, en cualquier etapa**:
// lo que decide la regla es *cómo* (destruir vs. marcar) y *quién* (los casos sensibles piden
// ADMIN). Nada queda bloqueado — un callejón sin salida es peor que un borrado recuperable.
//
// Los tipos viven en types/crm (que no importa nada) para que la decisión pueda viajar del
// server al cliente. Se re-exportan acá porque este módulo es el dueño de la REGLA.
export type { ClaseBorrado, DealParaBorrar } from "@/types/crm";

/**
 * La regla. Un lead del form web llega virgen (0 actividades reales: el intake solo deja un
 * registro SISTEMA) → destruirlo no pierde nada y no ensucia la BD de basura. Uno con
 * bitácora encima es trabajo de alguien: desaparece igual, pero se puede volver.
 *
 * **INVARIANTE: un deal CERRADO (ganado o perdido) nunca se destruye.** Cerrarlo es un hecho
 * del negocio que los reportes cuentan; destruirlo borraría el pasado. Antes un PERDIDO sin
 * bitácora manual caía en el caso "0 actividades" y se destruía de un clic —marcarlo perdido
 * solo deja una entrada SISTEMA, que no cuenta— así que cualquier vendedor podía borrar una
 * pérdida para siempre. Ahora se MARCA: desaparece de la operación y sigue en el histórico.
 *
 * Con orden vinculada o ya ganado, además, pide ADMIN: es plata facturada y el Deal es lo que
 * la ata al pipeline. Pero nada se bloquea — un callejón sin salida es peor que un borrado
 * recuperable.
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
  // Perdido: lo puede borrar cualquiera (no es plata facturada), pero no se destruye —
  // sigue contando en la tasa de cierre y en el desglose por motivo de pérdida.
  if (d.resultado === "PERDIDO") {
    return {
      clase: "MARCAR",
      motivo: "Está marcado como perdido: se marca (recuperable) y sigue contando en los reportes.",
      soloAdmin: false,
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

// Reapertura de un deal cerrado.
//
// Roldán: "que se me regrese a los leads... volver al estado anterior... si no se cerró o se
// pospuso, regresarlo al pipe". Volver a la etapa anterior sale gratis: `stage_id` nunca se
// toca al cerrar, así que poner ABIERTO devuelve el deal a donde estaba.
//
// Lo que sí hay que cuidar es la plata. Un deal ganado tiene una orden de venta colgada, y
// reabrirlo no la borra. La regla NO desvincula nunca: el vínculo es el único rastro de que
// esa orden nació de este deal, y es lo que impide que re-ganar cree una segunda (ver
// `handoffGanado`). Desvincular sería justamente lo que causa el duplicado.
export type { ClaseReapertura, DealParaReabrir } from "@/types/crm";

/**
 * Quién puede reabrir y qué hay que avisarle. Nada se bloquea —misma política que el
 * borrado: un callejón sin salida es peor que un estado recuperable—, pero cuanto más
 * comprometida está la plata, más arriba tiene que estar quien lo hace.
 */
export function clasificarReapertura(d: DealParaReabrir): ClaseReapertura {
  const libre: ClaseReapertura = { soloAdmin: false, pideMotivo: false, aviso: null };
  // Solo un deal CERRADO se "reabre". Reactivar uno en pausa no es una reapertura y no lleva
  // ninguna de estas reglas — si esto no mirara el resultado, un SUSPENDIDO con orden
  // vinculada le pediría ADMIN a quien quisiera reactivarlo, un bloqueo que el server ni
  // siquiera aplica. La misma función la usan el endpoint y la pantalla: si decidieran
  // distinto, la UI mostraría una regla que el backend no tiene.
  if (!RESULTADOS_CERRADOS.includes(d.resultado as DealResultado)) return libre;
  if (!d.orden) return libre;
  if (d.orden.estatus === "VENTA") {
    return {
      soloAdmin: true,
      pideMotivo: true,
      aviso:
        `La orden ${d.orden.folio} ya está registrada como venta y sigue contando como ingreso: ` +
        `reabrir el deal no la cancela. Si la venta se cayó, hay que resolverla en Ventas.`,
    };
  }
  return {
    soloAdmin: false,
    pideMotivo: false,
    aviso:
      `Tiene la orden ${d.orden.folio} (${d.orden.estatus.toLowerCase()}) vinculada. Se conserva: ` +
      `si volvés a ganar el deal, se retoma esa orden en vez de crear una nueva.`,
  };
}

/** Qué hacer después de ganar: retomar la orden que ya existe, o crear una nueva. */
export type HandoffGanado =
  | { orden_id: string }
  | { deal_id: string; cliente_id: string; vendedor_id: string | null; descripcion: string; valor: number };

/**
 * El hand-off al ganar, idempotente. **Este es el freno del ingreso duplicado.**
 *
 * Ganar dos veces el mismo deal recién es posible desde que se puede reabrir. Sin este freno,
 * la segunda victoria mandaría otra vez a "nueva orden" y quedarían DOS órdenes de venta para
 * el mismo negocio, con el ingreso contado dos veces. Acá se retoma la que ya existe.
 *
 * Es la mitad de la garantía: cubre el camino de la UI. La otra mitad está en el alta
 * (app/api/ordenes), donde el vínculo ya no exige que el deal siga GANADO — si lo exigiera,
 * reabrir durante el hand-off dejaría la orden huérfana y el problema volvería por atrás.
 *
 * Vive acá y no en cada endpoint porque /resultado y /ganar arman el mismo hand-off por
 * duplicado; si el freno estuviera en uno solo, el otro seguiría duplicando.
 */
export function handoffGanado(deal: {
  id: string;
  orden_id: string | null;
  cliente_id: string;
  vendedor_id: string | null;
  nombre: string;
  valor: unknown;
}): HandoffGanado {
  if (deal.orden_id) return { orden_id: deal.orden_id };
  return {
    deal_id: deal.id,
    cliente_id: deal.cliente_id,
    vendedor_id: deal.vendedor_id,
    descripcion: deal.nombre,
    valor: Number(deal.valor),
  };
}

/**
 * ¿Puede este rol reabrir un deal con plata ya facturada?
 *
 * La jefatura comercial y la administración, sí. Un VENDEDOR no: puede pedirlo, y lo aprueba
 * quien tiene la vista completa del negocio. No es `isAdmin` a secas a propósito — el jefe de
 * ventas es GERENTE_COMERCIAL, y con ADMIN estricto quedaba afuera justo quien pidió la función.
 */
export function puedeReabrirConVenta(rol: string): boolean {
  return rol === "ADMIN" || rol === "GERENTE_COMERCIAL";
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
