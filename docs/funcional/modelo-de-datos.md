# Modelo de Datos — Newsoft Sales

> Referencia generada a partir del código real. Fuente: `prisma/schema.prisma`, verificado contra `prisma/migrations/`.
> Base de datos: **PostgreSQL** (`schema.prisma:10`). Cliente: `prisma-client-js`.

## Convenciones generales

- Todos los `id` son **UUID** (`@default(uuid())`), PK. En SQL se generan con `gen_random_uuid()`.
- Timestamps (`created_at`, `updated_at`) son `TIMESTAMPTZ`. `created_at` default `now()`; `updated_at` usa `@updatedAt`.
- **Soft delete** mediante flag `activo` (default `true`) en: `User`, `TipoCotizacion`, `CondicionComercial`, `Vendedor`, `Cliente`. **NO** existe en `Empresa`, `OrdenVenta` ni `Partida`.
- FK por defecto: `ON UPDATE CASCADE`; `ON DELETE RESTRICT` salvo donde se indique (`SET NULL` / `Cascade`).

---

## 1. User — tabla `user`
`schema.prisma:20-33` · roles añadidos en `20260527090000` y `20260527100000`

Autenticación y control de acceso por rol. Soft delete.

| Campo | Tipo | Opc. | Default | Notas |
|---|---|---|---|---|
| id | UUID | No | `uuid()` | `@id` |
| nombre | VARCHAR(150) | No | — | |
| email | VARCHAR(100) | No | — | **`@unique`** |
| password_hash | VARCHAR(255) | No | — | bcrypt |
| rol | `user_role` | No | `ADMIN` | |
| vendedor_id | UUID | **Sí** | — | FK → Vendedor, **`onDelete: SetNull`** |
| activo | BOOLEAN | No | `true` | Soft delete |
| created_at / updated_at | TIMESTAMPTZ | No | `now()` / `@updatedAt` | |

---

## 2. Empresa — tabla `empresa`
`schema.prisma:39-59`

Configuración global. Registro único (no se crean múltiples empresas). **Sin soft delete.**

| Campo | Tipo | Opc. | Default | Notas |
|---|---|---|---|---|
| id | UUID | No | `uuid()` | `@id` |
| nombre | VARCHAR(200) | No | — | |
| nombre_comercial | VARCHAR(200) | **Sí** | — | |
| rfc | VARCHAR(13) | No | — | |
| direccion | VARCHAR(500) | No | — | |
| email | VARCHAR(100) | No | — | |
| telefono | VARCHAR(20) | No | — | |
| prefijo_folio | VARCHAR(10) | No | — | Prefijo de folio |
| siguiente_folio | INTEGER | No | `1` | Consecutivo (zero-pad 5 dígitos) |
| vigencia_cotizacion_dias | INTEGER | No | `30` | |
| aplicar_iva | BOOLEAN | No | `true` | (ojo: `aplicar_iva` aquí vs `aplica_iva` en OrdenVenta) |
| **tasa_iva** | **DECIMAL(5,2)** | No | `16.00` | Tasa global de IVA |
| notas_documentos | TEXT | **Sí** | — | Soporta variable `{vigencia}` |

---

## 3. TipoCotizacion — tabla `tipo_cotizacion`
`schema.prisma:66-78`

Catálogo administrable (Proyecto Fijo, SEC Plan, Soporte, TrackPoint, etc.). Soft delete.

| Campo | Tipo | Opc. | Default |
|---|---|---|---|
| id | UUID | No | `uuid()` |
| nombre | VARCHAR(100) | No | — |
| descripcion | VARCHAR(300) | **Sí** | — |
| texto_contrato | TEXT | **Sí** | — |
| activo | BOOLEAN | No | `true` |

Relaciones: `ordenes` 1:N → `OrdenVenta`.

---

## 4. CondicionComercial — tabla `condicion_comercial`
`schema.prisma:85-99`

Catálogo administrable (Contado, 30 días, 50/50, etc.). Soft delete.

| Campo | Tipo | Opc. | Default | Notas |
|---|---|---|---|---|
| id | UUID | No | `uuid()` | |
| nombre | VARCHAR(150) | No | — | |
| dias_credito | INTEGER | **Sí** | — | `null` = contado |
| descripcion | TEXT | **Sí** | — | |
| activo | BOOLEAN | No | `true` | |

Relaciones: `clientes` 1:N → `Cliente`; `ordenes` 1:N → `OrdenVenta`.

---

## 5. Vendedor — tabla `vendedor`
`schema.prisma:106-119` · `migrations/20260512190000_add_vendedores`

Catálogo comercial, **independiente de los usuarios del sistema**. Soft delete.

| Campo | Tipo | Opc. | Default |
|---|---|---|---|
| id | UUID (`@db.Uuid`) | No | `uuid()` |
| nombre | VARCHAR(150) | No | — |
| email | VARCHAR(100) | **Sí** | — |
| telefono | VARCHAR(20) | **Sí** | — |
| activo | BOOLEAN | No | `true` |

Relaciones: `ordenes` 1:N → `OrdenVenta`; `usuarios` 1:N → `User`.

---

## 6. Cliente — tabla `cliente`
`schema.prisma:126-147` · `rfc`/`email` opcionales desde `20260428170000`/`20260429130000`

Soft delete. RFC único.

| Campo | Tipo | Opc. | Default | Notas |
|---|---|---|---|---|
| id | UUID | No | `uuid()` | |
| nombre | VARCHAR(200) | No | — | |
| rfc | VARCHAR(13) | **Sí** | — | **`@unique`** |
| contacto | VARCHAR(150) | No | — | |
| ciudad | VARCHAR(100) | No | — | |
| email | VARCHAR(100) | **Sí** | — | |
| telefono | VARCHAR(20) | **Sí** | — | |
| condicion_pago_id | UUID | No | — | FK → CondicionComercial (default del cliente), `RESTRICT` |
| notas | TEXT | **Sí** | — | |
| activo | BOOLEAN | No | `true` | Soft delete |

Relaciones: `condicion_pago` N:1 → CondicionComercial; `ordenes` 1:N → OrdenVenta.

---

## 7. OrdenVenta — tabla `orden_venta`
`schema.prisma:184-248` · `vendedor_id` añadido en `20260512190000`

Entidad central (cotización o venta cerrada). Los campos "Calc." se **recalculan en backend**. **Sin `activo`** (no usa soft delete).

| Campo | Tipo | Opc. | Default | Notas |
|---|---|---|---|---|
| id | UUID | No | `uuid()` | |
| folio | VARCHAR(20) | No | — | **`@unique`**, autogenerado |
| cliente_id | UUID | No | — | FK → Cliente, `RESTRICT` |
| tipo_cotizacion_id | UUID | No | — | FK → TipoCotizacion, `RESTRICT` |
| condicion_pago_id | UUID | No | — | FK → CondicionComercial, `RESTRICT` (puede diferir del default del cliente) |
| vendedor_id | UUID | **Sí** | — | FK → Vendedor, **`SetNull`** |
| descripcion | VARCHAR(500) | No | — | |
| estatus | `estatus_orden` | No | `BORRADOR` | |
| moneda | `moneda` | No | `MXN` | |
| **tipo_cambio** | **DECIMAL(10,4)** | **Sí** | — | Obligatorio (validación) si moneda = USD |
| fecha_venta | DATE | **Sí** | — | Editable retroactivamente |
| vigencia | DATE | **Sí** | — | Calculada: `created_at + vigencia_cotizacion_dias` |
| aplica_iva | BOOLEAN | No | — (sin default) | Hereda de Empresa pero editable por orden |
| **tasa_iva** | **DECIMAL(5,2)** | **Sí** | — | |
| **descuento_porcentaje** | **DECIMAL(5,2)** | **Sí** | — | Descuento global opcional |
| descuento_descripcion | VARCHAR(200) | **Sí** | — | |
| **subtotal** | **DECIMAL(12,2)** | No | `0` | Calc.: Σ(cantidad × precio) |
| **monto_descuento** | **DECIMAL(12,2)** | No | `0` | Calc. |
| **subtotal_con_descuento** | **DECIMAL(12,2)** | No | `0` | Calc. (= el "neto") |
| **monto_iva** | **DECIMAL(12,2)** | No | `0` | Calc. |
| **total** | **DECIMAL(12,2)** | No | `0` | Calc. (moneda original) |
| **total_mxn** | **DECIMAL(12,2)** | No | `0` | Calc. (convertido a MXN) |
| notas | TEXT | **Sí** | — | |
| duplicada_de_id | UUID | **Sí** | — | Autorreferencia (orden original), `SetNull` |
| created_at / updated_at | TIMESTAMPTZ | No | `now()` / `@updatedAt` | |

Índice: `orden_venta_vendedor_id_idx`. Relación `partidas` 1:N → `Partida` (`Cascade`).

---

## 8. Partida — tabla `partida`
`schema.prisma:255-270`

Línea de orden. Mínimo 1 por orden. Se elimina físicamente en cascada con la orden.

| Campo | Tipo | Opc. | Notas |
|---|---|---|---|
| id | UUID | No | |
| orden_id | UUID | No | FK → OrdenVenta, **`onDelete: Cascade`** |
| descripcion | VARCHAR(500) | No | |
| **cantidad** | **DECIMAL(10,2)** | No | |
| **precio_unitario** | **DECIMAL(12,2)** | No | |
| **total_partida** | **DECIMAL(12,2)** | No | Calc.: cantidad × precio |
| orden_display | INTEGER | No | Posición/ordenamiento |

---

## Enums

- **EstatusOrden** (`estatus_orden`): `BORRADOR` · `COTIZADO` · `VENTA`. Default `BORRADOR`.
- **Moneda** (`moneda`): `MXN` · `USD`. Default `MXN`.
- **UserRole** (`user_role`): `ADMIN` · `GERENTE_COMERCIAL` · `VENDEDOR` · `ADMINISTRATIVO`. Default `ADMIN`. (Migración `20260527101000` remapeó legacy `VENTAS → VENDEDOR`, `CONSULTA → ADMINISTRATIVO`.)

## Resumen de campos Decimal

| Modelo | Campo | Precisión |
|---|---|---|
| Empresa | tasa_iva | (5,2) |
| OrdenVenta | tipo_cambio | (10,4) |
| OrdenVenta | tasa_iva, descuento_porcentaje | (5,2) |
| OrdenVenta | subtotal, monto_descuento, subtotal_con_descuento, monto_iva, total, total_mxn | (12,2) |
| Partida | cantidad | (10,2) |
| Partida | precio_unitario, total_partida | (12,2) |

**Patrón:** dinero `(12,2)`; tasas/porcentajes `(5,2)`; tipo de cambio `(10,4)`.

## Relaciones y `onDelete`

| Relación (hijo → padre) | onDelete |
|---|---|
| User.vendedor → Vendedor | **SetNull** |
| Cliente.condicion_pago → CondicionComercial | RESTRICT |
| OrdenVenta.cliente → Cliente | RESTRICT |
| OrdenVenta.tipo_cotizacion → TipoCotizacion | RESTRICT |
| OrdenVenta.condicion_pago → CondicionComercial | RESTRICT |
| OrdenVenta.vendedor → Vendedor | **SetNull** |
| OrdenVenta.duplicada_de → OrdenVenta | **SetNull** |
| Partida.orden → OrdenVenta | **Cascade** |

## Constraints únicos e índices

| Tabla | Tipo | Columnas |
|---|---|---|
| user | UNIQUE | email |
| cliente | UNIQUE | rfc |
| orden_venta | UNIQUE | folio |
| orden_venta | INDEX | vendedor_id |
