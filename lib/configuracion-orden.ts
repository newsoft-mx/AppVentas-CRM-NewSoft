/**
 * Qué significa ordenar por cada columna en las tablas de Configuración.
 *
 * Vive en `lib/` por la misma razón que sus hermanos (`ventas-orden`, `contactos-orden`): jest
 * corre en `testEnvironment: node` y su `testMatch` solo toma `.ts`, así que nada que viva en un
 * `.tsx` es testeable.
 *
 * POR QUÉ "ESTADO" NO ES ORDENABLE EN NINGUNA DE LAS CUATRO
 * Las cuatro tablas parten sus filas en activos e inactivos, y ese corte ES el orden por estado.
 * El cimiento no deja que el orden cruce un límite estructural (`ordenarPorTramos`), así que
 * dentro de cada tramo todas las filas comparten el mismo estado: un encabezado "Estado"
 * ordenable no movería nada y se leería como que está roto. La partición ya lo resuelve.
 */
import type { ExtractoresOrden } from "@/lib/tabla-orden";
import type {
  CondicionComercial, TipoCotizacion, Usuario, Vendedor,
} from "@/types/configuracion";

// ── Condiciones comerciales ───────────────────────────────────

export type CampoCondicion = "nombre" | "dias_credito" | "descripcion";

export const EXTRACTORES_CONDICION: ExtractoresOrden<CondicionComercial, CampoCondicion> = {
  nombre: (c) => c.nombre,
  // `?? 0` porque la celda muestra "Contado" TANTO para `null` como para `0`: son el mismo
  // concepto de cara al usuario. Sin esto, ordenar por esta columna parte en dos las filas que
  // se leen idénticas — los `0` arriba y los `null` al final, con los 30/60 días en el medio,
  // que se ve como que el orden está roto. Se ordena por lo que se ve, no por el dato crudo.
  dias_credito: (c) => c.dias_credito ?? 0,
  descripcion: (c) => c.descripcion,
};

// ── Tipos de cotización ───────────────────────────────────────

export type CampoTipo = "nombre" | "descripcion";

export const EXTRACTORES_TIPO: ExtractoresOrden<TipoCotizacion, CampoTipo> = {
  nombre: (t) => t.nombre,
  descripcion: (t) => t.descripcion,
};

// ── Usuarios ──────────────────────────────────────────────────

export type CampoUsuario = "usuario";

export const EXTRACTORES_USUARIO: ExtractoresOrden<Usuario, CampoUsuario> = {
  // La celda muestra nombre arriba y email abajo; se ordena por el nombre, que es lo que
  // el ojo sigue al recorrer la columna.
  usuario: (u) => u.nombre,
};

// ── Vendedores ────────────────────────────────────────────────

export type CampoVendedor = "nombre" | "contacto";

export const EXTRACTORES_VENDEDOR: ExtractoresOrden<Vendedor, CampoVendedor> = {
  nombre: (v) => v.nombre,
  // La celda cae al teléfono cuando no hay correo: se ordena por lo que se ve.
  contacto: (v) => v.email ?? v.telefono,
};
