# NewSoft Sales

Sistema interno de ventas y CRM de NewSoft. Este documento cubre tanto la parte de
**desarrollo** (stack, comandos, estructura) como la de **operación/entrega** del
despliegue actual.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma ORM** + **PostgreSQL** (AWS Lightsail en producción, Neon en staging — migración a Vercel + Supabase en curso, ver `MIGRACION_VERCEL_SUPABASE.md`)
- **Autenticación propia por cookie/JWT** (firmada con `jose`) — ver `lib/session.ts` y `lib/access-control.ts`
- **recharts** (gráficas) · **puppeteer-core** (generación de PDF; usa `@sparticuz/chromium` en Vercel serverless, Chromium del sistema en Docker)
- **Jest** (pruebas) · **Docker** + **Terraform** (despliegue en AWS Lightsail)

## Estado actual (operación)

- La aplicación está desplegada en AWS Lightsail.
- El acceso público actualmente es por IP, no por dominio.
- La aplicación corre en Docker dentro del servidor.
- El código desplegado se deja en el servidor en `/opt/newsoft-sales`.
- La infraestructura principal se administra con Terraform desde `infra/lightsail`.
- Migración a Vercel + Supabase en curso — ver `MIGRACION_VERCEL_SUPABASE.md`.

## Archivos de referencia (entrega/operación)

Toda la documentación de operación vive en [`docs/operaciones/`](docs/operaciones/README.md):

- `docs/operaciones/FLUJO_DESPLIEGUE.md`: explica el flujo completo de despliegue.
- `docs/operaciones/OPERACION_SERVIDOR.md`: comandos útiles para SSH, Docker, logs y validación.
- `docs/operaciones/INVENTARIO_SERVICIOS.md`: servicios/cuentas involucrados.
- `docs/operaciones/MIGRACION_VERCEL_SUPABASE.md`: plan de migración a Vercel + Supabase (incluye troubleshooting del 500 por migraciones no aplicadas).
- `docs/operaciones/checklists/ARCHIVOS_SENSIBLES.md`: lista de archivos que NO deben ir por Slack/correo.
- `docs/operaciones/checklists/VALIDACION_PRE_DEPLOY.md`: checklist antes de ejecutar despliegue.
- `terraform_lightsail_sin_secretos/`: copia de Terraform sin estado, variables sensibles, planes ni builds.
- `sensibles_no_incluir/`: carpeta placeholder para recordar que los sensibles se comparten aparte por canal seguro.

## Importante

Nunca se sube a git ni se comparte por canales inseguros:

- `terraform.tfvars`
- `terraform.tfstate`
- backups de estado Terraform
- llaves SSH privadas
- `.env`
- paquetes de build
- credenciales o secretos

Esos archivos deben compartirse solo por canal seguro o revisarse en una reunión.

## Acceso SSH (Lightsail)

La configuración usada por Terraform apunta a:

```hcl
ssh_public_key_path  = "~/.ssh/newsoft_lightsail.pub"
ssh_private_key_path = "~/.ssh/newsoft_lightsail"
ssh_user             = "ubuntu"
```

Comando de referencia:

```bash
ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179
```

## Servidor actual

- IP pública: `13.218.0.179`
- Usuario SSH: `ubuntu`
- Ruta app: `/opt/newsoft-sales`
- Contenedor principal: `newsoft-sales-app`
- Puerto público: `80`

## Desarrollo local

### Variables de entorno

Edita `.env.local` con tus credenciales. La app (Next.js runtime) usa estas variables:

| Variable | Descripción |
|---|---|
| `POSTGRES_PRISMA_URL` | URL pooled (pgbouncer, puerto 6543, `?pgbouncer=true`) |
| `POSTGRES_URL_NON_POOLING` | URL directa (puerto 5432), usada por las migraciones |
| `SESSION_SECRET` | Secreto para firmar la sesión JWT. Generar con `openssl rand -base64 32` (mín. 32 chars) |

> **Importante (CLI de Prisma):** `prisma migrate`, `prisma studio`, etc. solo leen `.env`
> (no `.env.local`). El `schema.prisma` espera `POSTGRES_PRISMA_URL` y `POSTGRES_URL_NON_POOLING`,
> así que define esos mismos nombres también en `.env` para que la CLI funcione.

### Migraciones y datos iniciales

```bash
npm run db:migrate    # aplica migraciones en desarrollo
npm run db:seed       # usuarios, empresa y catálogos (production-safe, sin datos demo)
npm run db:seed:demo  # + datos demo (clientes, órdenes, deals, bitácora)
```

### Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001) (ver `.claude/launch.json` para el puerto configurado) → redirige a `/login`.

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción (prisma generate + migrate deploy + next build)
npm run lint         # ESLint
npm test             # Pruebas (Jest)
npm run db:generate  # Regenerar cliente Prisma tras cambios de schema
npm run db:migrate   # Nueva migración en desarrollo
npm run db:seed      # Seed de configuración (production-safe)
npm run db:seed:demo # Seed de configuración + datos demo
npm run db:studio    # Prisma Studio (explorador visual de la BD)
npm run db:reset     # Reset completo (destructivo)
npm run user:role    # Asignar rol a un usuario (scripts/set-user-role.ts)
```

---

## Ambientes

| Ambiente | Dónde | Base de datos | Cómo se actualiza |
|---|---|---|---|
| **Local** | `localhost:3001` (Docker) | PostgreSQL en Docker (`localhost:5433`) | `npm run dev` |
| **Staging / demo** | Vercel (ver `MIGRACION_VERCEL_SUPABASE.md`) | Supabase (migración en curso) / Neon (legado) | Automático en cada push / PR |
| **Producción** | AWS Lightsail (`13.218.0.179`) — migración a Vercel en curso | Lightsail Managed PostgreSQL | Manual: `terraform apply` (mientras dure la migración) |

## Despliegue a producción (Lightsail — vigente hasta completar la migración a Vercel)

```bash
# 1. Asegurarse de estar en main y sin cambios pendientes
git checkout main && git pull

# 2. Plan (ver qué cambia sin aplicar)
C:\Users\Usuario\bin\terraform.exe -chdir=infra/lightsail plan -out=tfplan

# 3. Aplicar (empaqueta repo → SSH → Docker build → prisma migrate deploy)
C:\Users\Usuario\bin\terraform.exe -chdir=infra/lightsail apply tfplan

# 4. Verificar
ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179 "sudo -n docker ps && sudo -n docker logs --tail=20 newsoft-sales-app"
```

Requiere: credenciales AWS en `~/.aws/credentials`, `terraform.tfvars` y `terraform.tfstate`
en `infra/lightsail/` (gitignored — ver `C:\Users\Usuario\newsoft-handoff\`).

## Despliegue a staging/producción (Vercel)

Ver `MIGRACION_VERCEL_SUPABASE.md` para el plan completo. En resumen: el build de Vercel
corre `prisma generate && prisma migrate deploy && next build --webpack` — las migraciones
se aplican solas en cada deploy. Variables de entorno en
**Vercel → Project → Settings → Environment Variables**:
`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `SESSION_SECRET`.

---

## Flujo de trabajo

`main` está **protegido**: no se hace push directo. Todo cambio entra por Pull Request
desde una rama `feature/`, `fix/` o `chore/`.

---

## Estructura del proyecto

```
app/
  (dashboard)/      # Rutas protegidas (ventas, clientes, reportes, pipeline CRM, configuración)
  api/              # Route handlers (incl. import, reportes, configuración, crm)
  login/            # Página de inicio de sesión
components/
  layout/           # Sidebar
  ordenes/          # Formularios y tablas de órdenes
  clientes/         # Gestión de clientes
  reportes/         # Gráficas y tablas de reportes (ventas + funnel del pipeline)
  pipeline/         # Kanban, detalle de deal, próximas acciones
  configuracion/    # Tabs (empresa, tipos, condiciones, usuarios, vendedores, pipeline)
  ui/               # Componentes reutilizables (SearchableSelect, Modal, Toast, etc.)
lib/
  session.ts        # Sesión por cookie/JWT
  access-control.ts # Roles, permisos y scoping por vendedor
  net-amounts.ts    # Cálculo de montos netos sin IVA
  filter-utils.ts   # Helpers de filtros y rangos de fecha
  atencion.ts        # Estado de atención del deal (stand-by/vencido)
  termometro.ts      # Lógica del termómetro del deal
  reportes-funnel.ts # Helpers de periodo/scope para reportes de funnel
  prisma.ts         # Singleton Prisma Client
prisma/
  schema.prisma     # Modelos de datos
  migrations/       # Historial de migraciones SQL
  seed.ts           # Datos iniciales (config + demo opcional)
__tests__/          # Pruebas (Jest)
infra/lightsail/    # Terraform para despliegue en AWS Lightsail
types/              # Tipos TypeScript compartidos
```
