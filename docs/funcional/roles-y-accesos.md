# Roles y Control de Acceso

> Autenticación, roles y permisos. Comportamiento real del código en `main`.

## 1. Mecánica de sesión

JWT firmado en cookie httpOnly. No hay sesión en BD; el token es autocontenido.

| Aspecto | Valor | Fuente |
|---|---|---|
| Cookie | `ns-auth` | `lib/session.ts:4` |
| Duración | 7 días | `lib/session.ts:5` |
| Firma | `jose` `SignJWT`/`jwtVerify`, **HS256** | `lib/session.ts:1,32` |
| Secreto | `process.env.SESSION_SECRET` (error si falta) | `lib/session.ts:24-28` |
| Cookie attrs | `httpOnly`, `secure` (si HTTPS), `sameSite:"lax"`, `maxAge:7d`, `path:"/"` | `app/api/auth/login/route.ts:62-68` |

**Payload** (`SessionPayload`, `lib/session.ts:9-14`): `{ userId, email, rol, vendedorId }` + `iat`/`exp`.

**Validación por request:** `verifySession` (`lib/session.ts:38-52`) verifica firma/expiración; si falla → `null`. Normaliza el rol con `normalizeRole`.

**Helpers:** `requireAuth(req)`, `requireRole(req, roles)` (API); `getServerSession()` (Server Components, `lib/server-session.ts`).

**`normalizeRole`** (`lib/session.ts:18-22`): mapea legacy `VENTAS → GERENTE_COMERCIAL`, `CONSULTA → ADMINISTRATIVO`; **fallback a `ADMIN`** si el valor es desconocido/nulo.

## 2. Roles (`user_role`, `schema.prisma:170-177`)

| Rol | Representa | Etiqueta UI |
|---|---|---|
| `ADMIN` | Acceso total: configuración, usuarios, vendedores, catálogos, todas las órdenes y clientes | Administrador |
| `GERENTE_COMERCIAL` | Ve/modifica todas las órdenes y clientes; **sin** Configuración | Gerente comercial |
| `VENDEDOR` | Solo sus propias órdenes (su `vendedorId`); no gestiona clientes | Vendedor |
| `ADMINISTRATIVO` | Solo órdenes `VENTA`; gestiona clientes; no crea/edita órdenes | Administrativo |

## 3. Matriz de permisos

Predicados base: `canWrite` = ADMIN/GERENTE_COMERCIAL/VENDEDOR (`session.ts:66-68`); `isAdmin` = solo ADMIN; `canManageClients` = ADMIN/GERENTE_COMERCIAL/ADMINISTRATIVO; `canViewReports` = cualquier autenticado. Scoping de órdenes en `lib/access-control.ts`.

| Acción | ADMIN | GERENTE | VENDEDOR | ADMVO |
|---|:--:|:--:|:--:|:--:|
| Órdenes — listar | Todas | Todas | Solo suyas | Solo `VENTA` |
| Órdenes — ver una | Sí | Sí | Solo suyas | Solo `VENTA` |
| Órdenes — crear | Sí | Sí | Sí (vendedor forzado al suyo) | **No** |
| Órdenes — editar / borrar / estatus / fecha / duplicar | Sí | Sí | Solo suyas | **No** |
| Órdenes — importar | Sí | Sí | Sí | **No** |
| Clientes — listar | Sí | Sí | Sí | Sí |
| Clientes — crear / editar / desactivar / importar | Sí | Sí | **No** | Sí |
| Reportes (todos) | Sí | Sí | Sí (scoped) | Sí (scoped a VENTA) |
| Configuración (empresa, usuarios, vendedores, tipos, condiciones) | Sí | **No** | **No** | **No** |

**Scoping (`lib/access-control.ts`):**
- `scopeOrdenWhere` (`:10-22`): `VENDEDOR` → filtra `vendedor_id = session.vendedorId`; `ADMINISTRATIVO` → fuerza `estatus = "VENTA"`; ADMIN/GERENTE → sin filtro.
- `canMutateOrden` (`:31-39`): ADMIN/GERENTE siempre; VENDEDOR solo si la orden es suya; otros → no.
- `assignedVendedorId` (`:41-43`): un VENDEDOR siempre crea a su propio nombre (ignora el solicitado).

## 4. Protección de rutas (`proxy.ts`)

Middleware sobre todas las rutas (matcher excluye `_next`, favicon, etc.). Prefijos públicos: `/login`, `/api/auth`, `/_next`, assets de logo. Para el resto: lee cookie `ns-auth`, valida; si no hay sesión → **redirige a `/login?callbackUrl=<ruta>`**.

> El middleware solo verifica **autenticación**, no rol. La autorización por rol se aplica en cada API route y en páginas server-side. Defensa extra: `app/(dashboard)/layout.tsx:14-15` (redirect si no hay sesión) y `configuracion/page.tsx:14-15` (redirect a `/ventas` si `rol !== "ADMIN"`); el Sidebar oculta `/configuracion` a no-admin.

## 5. Login (`app/api/auth/login/route.ts`)

1. Exige `email` + `password` (400 si faltan).
2. Busca usuario por email normalizado; si no existe o `activo === false` → 401.
3. `bcrypt.compare` contra `password_hash`; si no coincide → 401.
4. Lee rol/vendedor del usuario; firma el JWT con `signSession({ userId, email, rol, vendedorId })`.
5. Setea cookie `ns-auth` y responde `{ ok: true }`.

## ⚠️ Bug conocido — el login cae a `ADMIN`

El paso 4 usa un `$queryRaw` que compara `uuid = text` sin cast (`...WHERE id = ${user.id}`, `login/route.ts:46`). PostgreSQL rechaza la comparación, la consulta lanza, y el `catch` deja el rol sin leer → `normalizeRole(undefined)` devuelve `ADMIN`. **Resultado: todos los usuarios reciben `ADMIN`**, anulando en la práctica la matriz de permisos.

Este documento describe el **comportamiento pretendido** del diseño de roles. El fix (cast `::uuid`) está preparado en PR aparte; el `INSERT`/`UPDATE` de usuarios sí castea correctamente (`configuracion/usuarios/route.ts:48-52`), confirmando que el faltante está en el login.
