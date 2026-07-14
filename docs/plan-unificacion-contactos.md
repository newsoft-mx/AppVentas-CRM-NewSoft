# Plan — Unificación de contactos (cliente ↔ deal)

> Estado: **plan para revisar antes de implementar**. Es un cambio de **esquema con migración** (Víctor la corre en Supabase, como la del scoring). Cierra SOL-15 (editar contacto desde el deal) y agrega múltiples contactos por cliente.

## Problema

Hoy los contactos viven en **dos lugares desconectados**:
- `Cliente.contacto/email/telefono` — **un** contacto embebido en el cliente (lo usan PDF, detalle de orden, conversión, búsqueda).
- `DealContacto` — **varios** por deal, pero con **datos embebidos y sueltos** (no apuntan al cliente).

Al dar de alta un deal con prospecto se crea el **mismo contacto dos veces** (en `Cliente.contacto` y en un `DealContacto`), y si se edita uno, el otro no se entera. Al convertir el prospecto a cliente, se reutiliza el de `Cliente` — no el que el vendedor ve/edita en el deal.

## Estado actual (auditoría del alta de deal)

El modal de alta captura campos de **3 entidades** mezcladas: Deal, Cliente y Contacto. Hallazgos:

- **Doble guardado del contacto**: `contacto_nombre/email/telefono` van a `Cliente.contacto/*` (si prospecto) **y** a un `DealContacto`. Coinciden al alta, **divergen al editar cualquiera**.
- **Cliente existente = contacto huérfano**: si se elige un cliente existente y se tipea un contacto, se crea un `DealContacto` nuevo pero **el `Cliente` no se toca ni se reutiliza su contacto**. → dos contactos sin relación.
- **WhatsApp se pierde a nivel cliente**: `Cliente` no tiene campo whatsapp; solo vive en `DealContacto`.
- **Temperatura muerta**: el form la captura y envía, pero el POST la ignora (se deriva del score). Sacar del alta o marcar informativa.
- **Placeholders del prospecto** (`deals/route.ts`): `ciudad: ""`, `condicion_pago_id: <primera activa>`, `rfc/notas: null`. OK como mínimos (se completan al convertir), pero la UI debería decirlo.

Estos 4 problemas son lo que la unificación resuelve (el whatsapp perdido y el contacto huérfano se suman al alcance).

## Objetivo

Un solo contacto por persona, **dueño = Cliente**; el deal **referencia** cuáles participan (con su rol por-deal). Editar desde el deal edita el contacto compartido. Como el Cliente es el ancla estable (prospecto → activo → órdenes), el contacto se reutiliza solo, sin duplicación.

## Diagrama objetivo

```
CondicionComercial ─1:N─> Cliente ─1:N─> Contacto  (es_principal ⟶ espeja Cliente.contacto)
                            │ (ancla)        ▲
                            ├─1:N─> Deal ─1:N─> DealContacto { rol }   ← link (antes datos embebidos)
                            │                        ▲ contacto_id (SetNull)
                            │                    DealActividad         ← "¿con quién fue la acción?"
                            └─1:N─> OrdenVenta   (PDF lee Cliente.contacto, sincronizado)
```

## Modelo de datos

### Nueva tabla `Contacto` (dueño = Cliente)
| campo | tipo | nota |
|---|---|---|
| `id` | uuid | |
| `cliente_id` | uuid FK → Cliente | `onDelete: Cascade` |
| `nombre` | varchar(150) | requerido |
| `email` | varchar(100)? | |
| `telefono` | varchar(20)? | |
| `whatsapp` | varchar(20)? | |
| `cargo` | varchar(100)? | opcional (puesto) |
| `es_principal` | boolean | **exactamente uno = true por cliente** |
| `activo` | boolean | soft-delete |
| `created_at` | timestamptz | |

`@@index([cliente_id])`.

### `DealContacto` pasa de datos embebidos a **link**
- **Se van** los campos `nombre/email/telefono/whatsapp`.
- **Quedan**: `id`, `deal_id`, `rol` (por-deal), `created_at`.
- **Se agrega**: `contacto_id` (FK → `Contacto`).
- `DealActividad.contacto_id` **sigue apuntando a `DealContacto`** (el link) — la bitácora no se toca.

### `Cliente.contacto/email/telefono` — se mantienen (decisión cerrada)
Espejan **siempre** al `Contacto` con `es_principal = true`. Así PDF, detalle de orden, conversión y búsqueda **no se tocan**. La sincronización se hace en el servicio de contactos (nivel app, un solo lugar), no con trigger de BD.

**Regla de sincronía (SSOT del principal):** al crear/editar/eliminar contactos o cambiar el principal → `Cliente.contacto = principal.nombre`, `Cliente.email = principal.email`, `Cliente.telefono = principal.telefono`. Nunca puede quedar un cliente sin principal.

## Migración (aditiva + backfill, sin pérdida)

1. **Crear** tabla `Contacto`.
2. **Principal por cliente**: por cada `Cliente`, `INSERT Contacto` con `nombre=cliente.contacto`, `email=cliente.email`, `telefono=cliente.telefono`, `es_principal=true`, `activo=true`.
3. **Contactos de deals** (dedup): por cada `DealContacto`, buscar un `Contacto` del **cliente del deal** que matchee por **email** (si tiene) o si no por **nombre** (case-insensitive):
   - si existe → reusar ese `contacto_id` (evita duplicar al principal cuando el 1er contacto del deal es el mismo del cliente).
   - si no existe → `INSERT Contacto` bajo ese cliente (`es_principal=false`) con los datos del `DealContacto`.
4. **Convertir `DealContacto` en link**: set `contacto_id` (del paso 3), `DROP` las columnas embebidas.
5. `Cliente.contacto/email/telefono` **se dejan** (ya son el espejo del principal).

> Riesgo controlado: el dedup por email/nombre puede fusionar dos personas homónimas del mismo cliente; es aceptable (raro) y se puede depurar luego desde la gestión de contactos. Todo el paso corre en una transacción.

## Sitios a tocar

**Backend**
- `Contacto` — nuevos endpoints: listar por cliente, crear, editar, eliminar, marcar principal (con la sincronía al `Cliente`).
- `deals` (alta): en vez de crear `DealContacto` con datos, **crear-o-encontrar** un `Contacto` en el cliente + crear el link `DealContacto`. En prospecto nuevo, ese contacto es el **principal**.
- `deals/[id]/actividades` y detalle del deal: cargar los contactos vía link; **editar** edita el `Contacto` compartido; **agregar** elige de los contactos del cliente o crea uno; el **rol** es del link.
- `clientes` (crear/convertir/editar): escriben el `Contacto` principal (reusan la sincronía).
- PDF / detalle de orden / búsqueda: **sin cambios** (leen `Cliente.contacto` sincronizado).

**Frontend**
- **Detalle del deal**: la sección Contactos pasa a: lista de contactos del deal (del link) · editar cada uno (edita el compartido) · agregar (de los del cliente o nuevo) · setear rol. Cierra "editar contacto desde el deal".
- **Cliente** (ficha/form): **listado de contactos** para navegar/gestionar varios (add/edit/delete, marcar principal).
- **NuevoDealModal**: el contacto inicial crea el principal del prospecto, o elige de los contactos del cliente existente.

## Qué pasa con los datos existentes

- Cada cliente queda con **≥1 contacto** (su principal, migrado de `Cliente.contacto`).
- Los contactos de deals quedan **linkeados** a un `Contacto` del cliente (reusando el principal cuando coinciden).
- La bitácora (`DealActividad.contacto_id`) sigue válida (apunta al mismo `DealContacto`).
- PDF/órdenes siguen mostrando el mismo contacto (el principal sincronizado).

## Casos borde

- **Cliente sin contactos**: imposible por invariante (siempre hay principal). Al borrar el último/único, se bloquea o se marca otro como principal.
- **Borrar un `Contacto` usado por deals**: `DealContacto.contacto_id` con `onDelete`… → mejor **soft-delete** (`activo=false`) para no romper links/bitácora; se oculta de las listas pero el histórico queda.
- **Cambiar el principal**: re-sincroniza `Cliente.*`.
- **Mismo contacto en varios deals del cliente**: es lo esperado (un `Contacto`, varios links).

## Verificación

- Migración local (Docker) + `prisma migrate reset` con seed → todos los clientes con principal, deals linkeados.
- `tsc` + Jest + **E2E**: SOL-15 (contacto accionable) sigue verde; agregar caso "editar contacto desde el deal se refleja en el cliente".
- Invariante a testear: **editar el contacto en el deal ⇒ el cliente ve el mismo dato** (y viceversa).

## Rollout

- Feature única (la migración es atómica: `DealContacto` no se puede migrar a medias).
- **Víctor corre la migración en Supabase** (`prisma migrate deploy`, conexión directa 5432), como la del scoring. Coordinar orden si hay otros PRs en vuelo.
- Independiente de #61/#62 (rediseño), que siguen en revisión.

## Decisiones — estado

- ✅ **Modelo**: unificado (Contacto dueño del cliente; el deal linkea con rol por-deal).
- ✅ **`Cliente.contacto/email/telefono`**: se mantienen, sincronizados con el principal.
- ✅ **`DealActividad.contacto_id`**: sigue apuntando a `DealContacto` (link).
- ⬜ **Alcance de UI del cliente**: ¿gestión completa de contactos (add/edit/delete/principal) ya, o empezar con listar + editar y dejar el resto para después? — *a confirmar al implementar.*
- ⬜ **Borrado de contacto**: soft-delete (recomendado) vs bloquear si está en uso — *a confirmar.*
