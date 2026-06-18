# Documentación funcional — Newsoft Sales

Esta carpeta documenta la **lógica funcional y los motores de negocio** del sistema, extraída del código real (branch `main`). Describe lo que el código **hace**, con referencias `archivo:línea`, no comportamiento aspiracional.

> Mantener al día: si cambias una regla de negocio, actualiza el documento correspondiente en el mismo PR.

## Índice

| Documento | Contenido |
|-----------|-----------|
| [modelo-de-datos.md](modelo-de-datos.md) | Entidades, campos, tipos `Decimal`, enums, relaciones, `onDelete`, soft-delete, índices |
| [motor-de-montos.md](motor-de-montos.md) | Cálculo de subtotal / descuento / IVA / total / `total_mxn`, moneda, redondeo, regla "neto sin IVA" |
| [estados-fechas-folios.md](estados-fechas-folios.md) | Máquina de estados de órdenes, lógica de `fecha_venta`, motor de folios, duplicar orden |
| [roles-y-accesos.md](roles-y-accesos.md) | Sesión (cookie/JWT), roles, matriz de permisos, protección de rutas, login |
| [kpis-reportes-filtros.md](kpis-reportes-filtros.md) | KPIs de Ventas, cada reporte, motor de filtros (multi-selección, rangos de fecha) |

## Resumen del sistema

**Newsoft Sales** es un sistema interno de gestión de **cotizaciones y ventas** para Newsoft Technologies (reemplazo de un módulo de Odoo). Stack: Next.js 16 (App Router), TypeScript, Prisma + PostgreSQL, autenticación propia por cookie/JWT.

La entidad central es la **Orden de Venta**, que funciona como cotización o venta cerrada según su `estatus` (`BORRADOR → COTIZADO → VENTA`). Alrededor giran: catálogos (clientes, tipos de cotización, condiciones comerciales, vendedores), cálculo de montos con IVA y multimoneda, generación de PDF, reportes/KPIs y control de acceso por rol.

## Principios transversales (reglas de oro del negocio)

1. **Los montos se calculan SIEMPRE en backend** y se persisten; el frontend solo hace un *preview* visual que nunca se envía. Ver [motor-de-montos.md](motor-de-montos.md).
2. **Todos los montos agregados (tablas, dashboard, reportes) son NETOS sin IVA** (`subtotal_con_descuento`), normalizados a MXN. El desglose con IVA solo aparece en el detalle de la orden y en el PDF.
3. **Dinero siempre en `Decimal`**, nunca `Float`. Redondeo `ROUND_HALF_UP` a 2 decimales.
4. **Soft delete** en catálogos (`activo = false`); las órdenes nunca se borran por catálogo (FK `RESTRICT`).
5. **Folios** autogenerados: `prefijo` + consecutivo de 5 dígitos (ej. `NS00001`), contador en `Empresa.siguiente_folio`.
6. **Control de acceso por rol** aplicado en cada API route; el middleware (`proxy.ts`) solo verifica autenticación.

## ⚠️ Comportamiento real vs. pretendido (hallazgos a tener presentes)

Estos puntos son del **estado actual del código** y conviene conocerlos antes de construir sobre el sistema:

- **Roles rotos en login (bug):** la consulta que lee el rol en `app/api/auth/login/route.ts` compara `uuid = text` sin cast y falla en silencio → todos los usuarios reciben `ADMIN`. La matriz de permisos está bien diseñada pero hoy queda anulada hasta corregir el cast (`::uuid`). Fix preparado en PR aparte.
- **Dos caminos para cambiar estatus:** `PATCH /api/ordenes/:id/estatus` aplica la máquina de estados y exige `fecha_venta` al pasar a VENTA; el editor general `PUT /api/ordenes/:id` **no** valida la matriz ni exige fecha (puede hacer `VENTA → BORRADOR`).
- **`fecha_venta` no se limpia** al revertir una venta a COTIZADO/BORRADOR.
- **Dos estrategias de fecha en reportes:** los reportes de ventas puras usan solo `fecha_venta`; los de embudo/conversión/top-clientes usan `fecha_venta` con fallback a `created_at`. Una VENTA sin `fecha_venta` desaparece de los reportes de ventas.
- **Folio no atómico:** el contador se incrementa con read-modify-write; la integridad la garantiza el índice `@unique` sobre `folio` (sin reintento ante colisión).
