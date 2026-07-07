# KPIs, Reportes y Motor de Filtros

> Comportamiento real del código en `main`.

## Conceptos base

- **Monto neto (sin IVA):** `netAmount(order)` = `subtotal_con_descuento` en moneda original; `netAmountMxn(order)` lo normaliza a MXN (×`tipo_cambio` si USD). Todos los agregados usan el neto. Ver [motor-de-montos.md](motor-de-montos.md).
- **Estatus:** `BORRADOR`, `COTIZADO`, `VENTA`.

## 1. KPIs del apartado Ventas

Dos cálculos paralelos con la misma fórmula: client-side `calcularKpis` (`lib/kpis.ts`) y server-side `GET /api/ordenes/kpis` (`app/api/ordenes/kpis/route.ts`).

| Campo | Qué calcula |
|---|---|
| `total_ordenes` | Conteo total (todos los estatus) |
| `borradores` / `cotizadas` / `ventas` | Conteo por estatus |
| `ventas_mxn` | Suma neta MXN de órdenes VENTA |
| `pipeline_mxn` | Suma neta MXN de órdenes COTIZADO |
| `tasa_conversion` | `round(ventas / total_ordenes × 100)` |
| `suma_total_mxn` / `suma_total_usd` | Suma neta por moneda original |

**Tarjetas en la UI de Ventas** (`VentasClient.tsx:189-221`):
1. **"Total órdenes · sin IVA"** = suma de `netAmountMxn` sobre **todas** las órdenes filtradas (`:161`) — incluye borradores/cotizaciones/ventas. No es `ventas_mxn`.
2. Tres contadores: **Órdenes** (`total_ordenes`), **Venta** (`ventas`), **Cotización** (`cotizadas`).

Los KPIs se recalculan desde el estado filtrado actual (`useMemo`, `:98`) → reflejan los filtros aplicados.

## 2. Reportes

Todos: requieren sesión, aplican `scopeOrdenWhere` (scoping por rol), aceptan filtros `ano/q/mes`.

| Reporte | Filtra estatus | Regla de fecha | Agrupa por |
|---|---|---|---|
| **ventas-mensuales** | `VENTA` | solo `fecha_venta` | mes calendario (compara 2 años) |
| **ventas-tipo** (distribución por línea de producto) | `VENTA` | solo `fecha_venta` | tipo de cotización, orden desc por monto |
| **ventas-vendedor** | `VENTA` | solo `fecha_venta` | vendedor (sin vendedor → "Sin vendedor"), orden desc |
| **top-clientes** | sin filtro (monto solo de VENTA) | `fecha_venta` + fallback `created_at` | cliente; descarta los de 0 ventas; `?limit=` (def. 10) |
| **pipeline** | sin filtro | `fecha_venta` + fallback | estatus (conteos + montos COTIZADO/VENTA) |
| **conversion** | sin filtro | `fecha_venta` + fallback | tipo de cotización (tasa = ventas/total) |

Todos los montos son `netAmountMxn`. `conversion` también da `ticket_promedio_mxn`, `tiempo_promedio_cierre_dias` (`fecha_venta − created_at`, mín. 0), y conteos.

## 3. Motor de filtros

### Semántica multi-selección: **AND entre tipos de filtro, OR dentro del mismo tipo**
`filtrarOrdenes` (`VentasClient.tsx:25-38`): cada tipo (estatus, cliente, tipo, vendedor, periodo) es una condición AND; dentro de cada tipo, `.includes(...)` → OR. Array vacío = "sin filtrar por este tipo". En backend: `{ in: [...] }` (OR interno) + propiedades separadas del `where` (AND).

### Backend acepta arrays — `getAllParam` (`filter-utils.ts:6-15`)
Une 3 formatos y deduplica: `?ano=2025&ano=2024`, `?ano[]=2025&ano[]=2024`, `?ano=2025,2024`. Luego se sanea (`parseNumberList` etc.) y se acota (`q∈[1,4]`, `mes∈[1,12]`, `ano∈[2020,2099]`). El cliente construye con `appendArrayParams`.

### Trimestre → meses — `selectedMonths` (`filter-utils.ts:118-131`)
Si hay `mes` → esos meses; si hay `q` → expande cada trimestre a sus 3 meses (`start=(q-1)*3+1`), ej. Q2 → [4,5,6]; si nada → 12 meses. Usado por `ventas-mensuales` para recortar el eje.

### Rango de fechas — `buildDateOrFilters` (`filter-utils.ts:89-116`)
Rangos `[gte, lt)` semiabiertos en UTC: por mes, por trimestre (3 meses), o año completo. Equivalente backend de `matchPeriod` (client-side).

### Regla fecha_venta-primero — `fechaFiltroOrden` (`filter-utils.ts:85-87`)
`orden.fecha_venta ?? orden.created_at`. En backend se expresa como OR de dos términos por rango:
```
{ fecha_venta: range }                                    // ventas
{ estatus: { not: "VENTA" }, fecha_venta: null, created_at: range }   // no-ventas sin fecha
```
Los reportes que ya filtran `estatus: "VENTA"` (mensuales, tipo, vendedor) **no** aplican fallback.

## 4. Filtros disponibles

**En Ventas** (`FiltrosBar.tsx`) — 7 MultiSelect: Años, Clientes, Tipos de cotización, Vendedores, Trimestres, Meses, Estatus. Trimestre y mes son **mutuamente excluyentes** (elegir uno limpia el otro). Botón "Limpiar todo".

**En Reportes** (`FiltrosReportes.tsx`) — solo periodo (Años, Trimestres, Meses) en panel desplegable con badge de conteo activo y chips removibles. Misma exclusión trimestre/mes.
