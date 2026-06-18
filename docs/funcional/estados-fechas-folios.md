# Estados, Fechas y Folios

> Tres motores de negocio de la Orden de Venta. Comportamiento real del código en `main`.

## A) Máquina de estados

Enum `EstatusOrden` (`schema.prisma:154-160`): `BORRADOR` (en elaboración) · `COTIZADO` (enviado al cliente) · `VENTA` (ganado/cerrado). Default al crear: `BORRADOR`.

### Matriz de transiciones (`lib/utils.ts:186-190`)

```ts
TRANSICIONES_PERMITIDAS = {
  BORRADOR: ["COTIZADO", "VENTA"],
  COTIZADO: ["VENTA", "BORRADOR"],
  VENTA:    ["COTIZADO"],
};
```

| Desde \ Hacia | BORRADOR | COTIZADO | VENTA |
|---------------|:--------:|:--------:|:-----:|
| **BORRADOR**  | — | ✅ | ✅ |
| **COTIZADO**  | ✅ | — | ✅ |
| **VENTA**     | ❌ | ✅ | — |

- `BORRADOR → VENTA` (venta directa) **permitido**.
- `VENTA → BORRADOR` **prohibido**; una venta solo se revierte a `COTIZADO`.

### Endpoint que aplica la máquina: `PATCH /api/ordenes/:id/estatus`
`app/api/ordenes/[id]/estatus/route.ts`

1. Auth + `canWrite` + `canMutateOrden` (`:16-18,47-49`).
2. Valida payload (`EstatusUpdateSchema`).
3. **Transición** (`:51-61`): si el destino no está permitido → **409** `Transición no permitida`.
4. **fecha_venta** (`:63-69`): si destino es `VENTA` y no se envió `fecha_venta` → **422**.

**Efectos:** solo escribe `estatus`; **solo** al pasar a `VENTA` con fecha escribe `fecha_venta` (`:75-77`). En cualquier otra transición **no toca `fecha_venta`** — al revertir VENTA→COTIZADO **conserva** la fecha anterior. No hay recálculo de montos, auditoría ni notificaciones.

### ⚠️ Vía alternativa que NO aplica la máquina: `PUT /api/ordenes/:id`
`app/api/ordenes/[id]/route.ts:50-195` permite editar la orden completa, incluido `estatus` y `fecha_venta`, **sin** validar la matriz ni exigir fecha. Puede hacer `VENTA → BORRADOR` y crear ventas sin fecha. La máquina de estados solo se garantiza por el endpoint dedicado.

### Creación directa
`POST /api/ordenes` acepta `estatus` inicial; `OrdenCreateSchema` exige `fecha_venta` si `estatus === "VENTA"` (`validations/ordenes.ts:109-116`).

---

## B) Lógica de fechas

Campos (`schema.prisma:206-210`): `fecha_venta DATE?` (editable retroactivamente), `created_at` (inmutable), `vigencia DATE?` (calculada al crear = `created_at + vigencia_cotizacion_dias`).

**Cuándo se setea `fecha_venta`:**
- Al crear: solo si el body la trae (`route.ts:172`).
- Al pasar a VENTA vía PATCH: obligatoria.
- Al editar (PUT): se escribe si viene en el payload (`undefined` la deja, `null` la limpia).

**Regla de visualización / orden — `fecha_venta ?? created_at`** (`fechaFiltroOrden`, `lib/filter-utils.ts:85-87`): la fecha "efectiva" de una orden es `fecha_venta` si existe, si no `created_at`. Usada para ordenar la tabla (`TablaOrdenes.tsx:49`) y filtrar en cliente (`VentasClient.tsx:34`). `matchPeriod` evalúa año/mes/trimestre en **UTC**.

**Rango de fechas para BD — `buildDateOrFilters`** (`filter-utils.ts:89-116`): construye rangos `[gte, lt)` en UTC por año, y dentro por mes, o por trimestre, o año completo.

**Dos patrones en reportes:**
1. **Con fallback** (`fecha_venta` o, si null, `created_at`) — listados, KPIs, pipeline, top-clientes, conversion. El término de fallback restringe a `estatus != VENTA`.
2. **Solo `fecha_venta`** — reportes de ventas puras (ventas-mensuales, ventas-tipo, ventas-vendedor). **Consecuencia:** una VENTA sin `fecha_venta` no aparece en ningún periodo de estos reportes.

---

## C) Motor de folios

**Formato** (`generarFolio`, `lib/utils.ts:141-143`): `prefijo + padStart(consecutivo, 5, "0")`. Ej.: `NS` + `1` → `NS00001`. Campo `folio` es `@unique @db.VarChar(20)`.

**Contador:** vive en el registro único `Empresa` → `prefijo_folio` y `siguiente_folio` (default `1`).

**Incremento** (en `POST /api/ordenes`, dentro de `prisma.$transaction`, `route.ts:144-158`):
1. Lee `Empresa`.
2. Genera folio con `siguiente_folio`.
3. Incrementa: `siguiente_folio + 1` (read-modify-write en JS, no `{ increment }` atómico).
4. Crea la orden.

> **Concurrencia:** el incremento no es atómico a nivel de contador. La integridad contra duplicados la garantiza el índice **`@unique` sobre `folio`** (una colisión hace fallar el segundo `create` → 500, sin reintento automático).

---

## D) Duplicar orden — `POST /api/ordenes/:id/duplicar`
`app/api/ordenes/[id]/duplicar/route.ts`

**Copia:** cliente, tipo, condición, descripción, moneda, tipo_cambio, vigencia, IVA, descuento, notas y **todas las partidas**. Los **montos se recalculan** con `calcularOrden` (no se copian).

**Difiere en la copia:**
- `folio`: nuevo (mismo motor que POST).
- `estatus`: **siempre `BORRADOR`**.
- `fecha_venta`: **`null`**.
- `duplicada_de_id`: apunta a la original (autorrelación `Duplicaciones`).
- `vendedor_id`: si el usuario es `VENDEDOR`, se asigna el suyo; si no, conserva el original.

Devuelve **201** con la copia serializada.
