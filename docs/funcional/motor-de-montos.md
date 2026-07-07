# Motor de cálculo de montos

> Comportamiento real del código en `main`. Cálculo de subtotal, descuento, IVA, total, conversión de moneda y "neto".

## Flujo general

| Etapa | Dónde | Función |
|-------|-------|---------|
| Preview en vivo (mientras se edita) | Cliente | `calcularPreview` — `components/ordenes/OrdenForm.tsx:59` |
| **Cálculo persistido (fuente de verdad)** | Backend | `calcularOrden` — `lib/utils.ts:71` |
| Almacenamiento | PostgreSQL | columnas `subtotal`, `monto_descuento`, `subtotal_con_descuento`, `monto_iva`, `total`, `total_mxn` |
| Serialización a JSON | Backend | `serializeOrden` — `lib/serializers.ts:79` |
| "Neto" para tablas/KPIs/reportes | Cliente + Backend | `netAmount` / `netAmountMxn` — `lib/net-amounts.ts` |
| Desglose con IVA | PDF / detalle | `CotizacionPDF.tsx`, `app/api/pdf/[id]/route.ts` |

**Regla clave:** el backend **recalcula siempre** todos los montos en cada create y update; nunca confía en montos enviados por el cliente. El preview del frontend es solo visual y **no se envía** en el payload.

## Fórmulas exactas (backend — `calcularOrden`, `lib/utils.ts:71-131`)

Todo se opera con **Decimal.js** configurado a `precision: 20, rounding: ROUND_HALF_UP` (`lib/utils.ts:9`).

```
total_partida          = redondea2( cantidad × precio_unitario )      // por partida (route.ts:203)
subtotal               = Σ ( cantidad_i × precio_unitario_i )          // sin redondear cada término (utils.ts:82-86)
monto_descuento        = redondea2( subtotal × (descuento_porcentaje ?? 0) / 100 )   // utils.ts:89-97
subtotal_con_descuento = subtotal − monto_descuento                    // utils.ts:99  ← EL "NETO"
tasa                   = (aplica_iva && tasa_iva != null) ? tasa_iva : 0
monto_iva              = redondea2( subtotal_con_descuento × tasa / 100 )   // utils.ts:102-109  (IVA sobre el subtotal YA descontado)
total                  = redondea2( subtotal_con_descuento + monto_iva )    // utils.ts:112  (moneda original)
total_mxn              = (moneda == USD && tipo_cambio) ? redondea2(total × tipo_cambio) : total   // utils.ts:115-121
```

> **Matiz de precisión:** `subtotal` suma los productos sin redondear cada término, mientras que `total_partida` (lo que muestra el PDF por renglón) sí redondea cada partida a 2 decimales. Con muchas fracciones puede haber diferencia de centavos entre la "suma visual de la columna Total" y el "Subtotal".

## Regla "neto" (sin IVA) — `lib/net-amounts.ts`

El "neto" **no recalcula nada**: lee el campo ya persistido `subtotal_con_descuento`.

```ts
netAmount(order)    = toNumber(order.subtotal_con_descuento)              // net-amounts.ts:14-16 (moneda original)
netAmountMxn(order) = order.moneda === "USD"                             // net-amounts.ts:18-21
                        ? netAmount(order) × (tipo_cambio || 1)
                        : netAmount(order)
```

**Cómo se respetan las órdenes "sin IVA":** no hay rama especial para `aplica_iva = false`. El neto siempre parte de `subtotal_con_descuento`, que **por definición no contiene IVA** (el IVA solo entra en `total`/`total_mxn`). Por eso el neto es comparable entre órdenes con y sin IVA, y es la base de todos los agregados. El flag `aplica_iva` solo afecta `monto_iva`/`total`, nunca el neto. **No se divide entre 1.16** — se usa el campo neto almacenado, lo cual es más preciso.

## Moneda y tipo de cambio

- Monedas: `MXN | USD` (`lib/validations/ordenes.ts:42`).
- `tipo_cambio` **obligatorio si `moneda === "USD"`** (Zod `superRefine`, `validations/ordenes.ts:94-100`; validación cliente `OrdenForm.tsx:220-221`).
- Se aplica en `total_mxn` (`utils.ts:116-118`) y en `netAmountMxn` (`net-amounts.ts:20`).
- En MXN: `total_mxn === total` y `netAmountMxn === netAmount` (el TC no se usa). Al cambiar a MXN, el form limpia el TC (`OrdenForm.tsx:435`).

## Dónde se calcula

- **Create `POST /api/ordenes`**: `calcularOrden(...)` (`route.ts:134-141`) y escribe los 6 montos (`route.ts:181-186`).
- **Update `PUT /api/ordenes/:id`**: **siempre recalcula** (`[id]/route.ts:113-120`). Para campos no enviados hace merge con la orden existente (`data.X ?? ordenExistente.X`). Si llegan partidas, **borra todas y las recrea** (`[id]/route.ts:124-135`).
- **Frontend**: `calcularPreview` (`OrdenForm.tsx:59-88`) solo para la sección "Resumen". El payload del submit **no incluye ningún monto** (`OrdenForm.tsx:254-276`) — evita manipulación desde el cliente.

> El preview usa aritmética nativa con un redondeo distinto (`Math.round(subtotal*pct)/100`, `OrdenForm.tsx:76,80`) que **puede diferir del backend por centavos**. El valor que vale es siempre el del backend.

## Dónde se muestra NETO vs. desglose con IVA

- **Neto (sin IVA)** — tablas, dashboard, reportes: `TablaOrdenes.tsx` (`:167,194,254-258,317-321`), `VentasClient.tsx:161`, `lib/kpis.ts`, `app/api/ordenes/kpis/route.ts`, `app/api/reportes/*`, página de clientes. Todos agregan con `netAmount`/`netAmountMxn`.
- **Desglose completo con IVA** (`Subtotal → Descuento → Subtotal c/desc → IVA → Total → Equivalente MXN`) — solo en el preview del formulario (`OrdenForm.tsx:705-744`) y en los dos generadores de PDF: react-pdf (`CotizacionPDF.tsx:707-768`) y HTML/Puppeteer (`app/api/pdf/[id]/route.ts:329-340`, este último es el invocado por `GET /api/pdf/:id`). Los PDF leen los montos ya persistidos, no recalculan.

## Validaciones relevantes (`lib/validations/ordenes.ts`)

- `tipo_cambio`: > 0, ≤ 99999, requerido si USD.
- `aplica_iva`: boolean obligatorio; si `true`, `tasa_iva` > 0. `tasa_iva` ∈ [0,100].
- `descuento_porcentaje`: ∈ [0,100].
- Partidas: `cantidad` > 0 (≤ 999999), `precio_unitario` ≥ 0 (≤ 99,999,999); **mínimo 1 partida**.
- En update todos los campos son opcionales (habilita el merge en el recálculo).
