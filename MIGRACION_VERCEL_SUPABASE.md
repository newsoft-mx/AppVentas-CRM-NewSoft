# Migración a Vercel + Supabase

## Resumen

Hoy la app corre en Docker sobre AWS Lightsail (ver `FLUJO_DESPLIEGUE.md` / `OPERACION_SERVIDOR.md`), con una base Postgres administrada aparte. El destino es: hosting en Vercel, base de datos en Supabase.

Es Next.js (v16.2.4) con Prisma — compatible con Vercel de forma nativa. Ya se corrigió el único bloqueador de código real (ver abajo). Lo que queda es configuración e infraestructura, no más cambios de código.

## Ya resuelto en este repo

El endpoint `app/api/pdf/[id]/route.ts` generaba PDFs con `puppeteer-core` apuntando a un Chromium instalado en el sistema (`/usr/bin/chromium`, instalado vía `apt` en el `Dockerfile`). Ese binario no existe en las funciones serverless de Vercel, así que el PDF fallaría en producción.

Se cambió a detección automática:
- Si `CHROMIUM_PATH` está definida → se usa esa ruta (control manual).
- Si `process.env.VERCEL` está presente (Vercel lo define solo) → usa `@sparticuz/chromium` (Chromium empaquetado para serverless, ya agregado a `package.json`).
- En cualquier otro caso (Docker/Lightsail) → sigue usando `/usr/bin/chromium` como antes.

También se agregó `export const maxDuration = 60` a ese endpoint (Vercel permite hasta 300s por default en Hobby/Pro, 60s da margen de sobra para el cold start de Chromium) y se listó `@sparticuz/chromium` y `puppeteer-core` en `serverExternalPackages` de `next.config.mjs` para que Next no intente empaquetarlos mal. `vercel.json` ahora usa `next build --webpack` para que el build en Vercel sea idéntico al de Docker (antes usaba el bundler por default, inconsistente con el script `build` del `package.json`).

No se pudo correr `next build` completo dentro de este entorno porque el sandbox no tiene acceso de red a `binaries.prisma.sh` (para descargar el motor de Prisma) — eso es una restricción de este entorno de trabajo, no del código. Sí se verificó que `@sparticuz/chromium` se instala y expone `executablePath()`/`args` correctamente. Recomiendo correr `npm run build` una vez en tu máquina o dejar que Vercel lo haga en el primer deploy, y validar el endpoint `/api/pdf/[id]` después de desplegar.

## Paso 1 — Crear el proyecto en Supabase

1. En tu cuenta de Supabase, crea un proyecto nuevo (elige una región cercana a donde vayas a desplegar en Vercel, para minimizar latencia).
2. Guarda la contraseña de la base que Supabase te pide al crear el proyecto — la vas a necesitar para las connection strings.
3. En **Project Settings → Database → Connection string**, copia dos URLs:
   - **Connection pooling (Transaction mode, puerto 6543)** → esta va en `POSTGRES_PRISMA_URL`. Agrega `?pgbouncer=true` al final si Supabase no lo incluye ya.
   - **Direct connection (puerto 5432)** → esta va en `POSTGRES_URL_NON_POOLING`. Esta es la que usa `prisma migrate deploy`.

El `.env.example` del repo ya está preparado para este esquema exacto:

```
POSTGRES_PRISMA_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgresql://USER:PASSWORD@HOST:5432/postgres"
```

## Paso 2 — Aplicar el esquema en Supabase

Con las dos URLs de arriba en un `.env` local (no lo subas a git):

```bash
npm install
npx prisma migrate deploy
```

Esto aplica, en orden, todas las migraciones que ya existen en `prisma/migrations/` (la más reciente es `20260527101000_map_legacy_roles`). Al terminar, Supabase tendrá el esquema completo pero vacío.

Verifica con:

```bash
npx prisma studio
```

o revisando las tablas desde el **Table Editor** de Supabase.

## Paso 3 — Migrar los datos reales de Lightsail a Supabase

Como confirmaste que hay datos de producción reales, no basta con el esquema: hay que copiar las filas. La forma más directa es `pg_dump` desde el origen y `pg_restore`/`psql` hacia Supabase.

1. Consigue la connection string **directa** (no pooled) de la base actual en Lightsail (la misma que usa hoy `POSTGRES_URL_NON_POOLING` en el servidor — revisa el `.env` del contenedor con `sudo docker exec -it newsoft-sales-app printenv` según `OPERACION_SERVIDOR.md`).

2. Exporta solo los datos (el esquema ya lo creaste con Prisma en el paso 2, así que evita duplicar tipos/constraints):

```bash
pg_dump "postgresql://USER:PASSWORD@LIGHTSAIL_HOST:5432/DBNAME" \
  --data-only \
  --disable-triggers \
  --no-owner --no-privileges \
  -f dump_datos.sql
```

3. Importa a Supabase usando la connection string **directa** (puerto 5432, no la 6543 con pgbouncer — los dumps grandes no funcionan bien a través del pooler):

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/postgres" -f dump_datos.sql
```

4. Si el orden de las tablas por llaves foráneas da problemas, corre el import con `SET session_replication_role = replica;` al inicio del `.sql` (desactiva triggers/FK temporalmente) o usa `pg_dump --data-only --column-inserts` y ajusta el orden manualmente. Dado que este esquema tiene relaciones (Usuario → Vendedor, OrdenVenta → Cliente, etc.), `--disable-triggers` suele ser suficiente.

5. Verifica conteos de filas en las tablas clave (`user`, `cliente`, `orden_venta`, etc.) comparando origen y destino antes de dar por buena la migración.

**Recomendación:** haz esto primero contra un proyecto de Supabase de prueba (o simplemente valida los conteos con cuidado) antes de apuntar producción ahí definitivamente — es la parte más delicada de toda la migración porque no es reversible fácilmente si algo se corrompe en el camino.

## Paso 4 — Configurar el proyecto en Vercel

Como ya tienes cuenta de Vercel:

1. **Add New → Project** e importa el repo `newsoft-mx/AppVentas-CRM-NewSoft` desde GitHub (o el remoto que uses).
2. Vercel detecta Next.js automáticamente. El `vercel.json` del repo ya define el build command correcto (`prisma generate && next build --webpack`), no necesitas tocar nada ahí.
3. En **Environment Variables**, agrega (para Production, y también Preview si vas a probar ahí):
   - `POSTGRES_PRISMA_URL` → la pooled de Supabase
   - `POSTGRES_URL_NON_POOLING` → la directa de Supabase
   - `SESSION_SECRET` → genera uno nuevo con `openssl rand -base64 32` (no reutilices el de Lightsail si quieres invalidar sesiones viejas al migrar)
   - `NODE_ENV` → `production` (Vercel ya lo pone por default, pero no está de más)
4. Deploy. El primer deploy va a correr `npm install` (instala `@sparticuz/chromium`) y el build.

## Paso 5 — Validar antes del cutover

Sobre el deployment de preview/producción en Vercel:

- Login funciona (cookie de sesión con `SESSION_SECRET`).
- Las pantallas que leen de la base muestran los datos migrados de Supabase.
- **Genera un PDF desde `/api/pdf/[id]`** — es la prueba real de que `@sparticuz/chromium` funciona en el entorno serverless. Si falla, revisa los logs de la función en Vercel (Dashboard → Deployments → Functions) para ver el error de Puppeteer/Chromium.
- Corre `npx prisma migrate deploy` no vuelva a ejecutarse por accidente contra Lightsail una vez que cambiaste tu `.env` local a Supabase.

## Paso 6 — Cutover

1. Si tienes dominio, apúntalo a Vercel (Project → Settings → Domains) en vez de a la IP de Lightsail.
2. Deja el contenedor de Lightsail apagado pero no lo borres de inmediato — sirve como respaldo por unos días si algo no cuadra en Supabase/Vercel.
3. Una vez confirmado que todo corre bien en Vercel por unos días, puedes desmontar la infraestructura de Lightsail/Terraform (`infra/lightsail`) y dar de baja esa base de datos.

## Notas sueltas

- `next.config.mjs` sigue teniendo `output: "standalone"` — es necesario para el `Dockerfile` (por si quieres mantener Lightsail como respaldo) y no afecta el build en Vercel, que ignora esa opción y usa su propio empaquetado.
- El `Dockerfile` y `docker-compose.prod*.yml` quedaron intactos — si decides no dar de baja Lightsail de inmediato, ese flujo sigue funcionando igual que antes.
