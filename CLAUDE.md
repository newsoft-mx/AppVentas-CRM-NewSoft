# CLAUDE.md — guía para trabajar en este repo

CRM de ventas de NewSoft (**AppVentas-CRM-NewSoft**). Este archivo lo lee Claude Code
automáticamente y sirve de referencia rápida para cualquier dev. El flujo Git base está
en [`docs/FLUJO-GIT.md`](docs/FLUJO-GIT.md); acá se resume y se agregan las reglas que
aprendimos rompiéndonos la cara.

## Stack

Next.js 16 (App Router) + React + Prisma + PostgreSQL. Deploy en **Vercel + Supabase**
(prod: `crm-newsoft.vercel.app`). Cada push a `main` despliega a producción y corre
`prisma migrate deploy` contra la BD real. Infra: solo Vercel + Supabase (Lightsail descartado).

## Setup local

- **DB local**: PostgreSQL en Docker (`localhost:5433`). Config en `.env`/`.env.local` (no commitear `.env*`).
- **Correr**: `npm run dev` (`localhost:3000`).
- **Sembrar**:
  - `npm run db:seed` → **solo config** (empresa, catálogos, etapas, usuarios). Seguro para prod/staging.
  - `npm run db:seed:demo` → agrega datos demo (clientes/deals/bitácora). **Solo local.**

## Comandos

| Qué | Comando |
|---|---|
| Typecheck | `npx tsc --noEmit` |
| Tests unitarios | `npm test` (Jest) |
| Tests e2e | `npm run test:e2e` (Playwright, server en 3001) |
| Migración (dev) | `npm run db:migrate` |
| Reset BD local | `npm run db:reset` |
| Lint | `npm run lint` |
| Guard de migraciones | `npm run guard:migrations` |

## Verificar ANTES de subir (obligatorio)

Todo cambio con superficie ejecutable se verifica de verdad, no solo por tests:
`tsc --noEmit` limpio **+** `npm test` verde **+** probar el flujo real en el navegador.
Si toca el schema: aplicar la migración en local y verificar el backfill. La calidad hoy
se sostiene con esta disciplina (no hay CI todavía) — no saltear pasos.

## Convenciones de código

- **SSOT** (una sola fuente de verdad): enums y listas derivadas viven en un solo lugar
  (`types/crm.ts`, `lib/`). Grep antes de escribir; no re-hardcodear ni duplicar reglas.
- **Cimientos, no parches**: arreglar de raíz y reutilizar/unificar. Un caso especial
  colgado de infra compartida suele ser señal de que el fix no es lo bastante profundo.
- **Migraciones aditivas (expand/contract)**: agregar columnas/enums con default + backfill;
  **no** hacer DROP/RENAME destructivo en la misma migración. El guard
  (`scripts/guard-migrations.mjs`) aborta el deploy ante `DROP TABLE/COLUMN/SCHEMA`/`TRUNCATE`
  salvo `ALLOW_DESTRUCTIVE_MIGRATIONS=1`. Truco útil: `@map` para conservar una columna vieja
  sin renombrarla en la BD, y dropearla en un *contract* posterior.
- **Nunca data mock/demo a `main`**: el seed sin `--demo` es solo config. La app corre sobre
  data real. Si un PR mezcla UX + `seed.ts` de demo, partirlo.
- **Seguridad**: `scopeDealWhere`/`scopeClienteWhere` (evita IDOR), `requireAuth`, el `userId`
  sale de la sesión (nunca del body), validar entradas con zod. Sin auto-escalada de rol.
- **Moneda siempre en backend** (nunca en frontend); montos de cara al usuario en vistas
  agregadas = **netos sin IVA** (`subtotal_con_descuento`). Ver `docs/FLUJO-GIT.md`.
- **Quality gate (SonarCloud, corre en el PR)**: duplicación ≤3%, líneas ≤120. Autorevisar el
  diff antes de pushear.

## Flujo Git y PRs

Base en [`docs/FLUJO-GIT.md`](docs/FLUJO-GIT.md): **nunca push directo a `main`**; rama por
requerimiento (`feature/` · `fix/` · `chore/` · `docs/`) → PR a `main`. Además:

- **Un PR a `main` por vez. No apilar PRs** (PR B con base = la rama de PR A). Al mergear la
  base a `main` y borrar su rama, los PRs hijos **no** llegan a `main` — se mergean a su rama
  base intermedia y quedan estranados. Si un cambio depende de otro no mergeado: esperar el
  merge y ramificar desde `main` (o, si hay que avanzar, el PR final apunta a `main`, nunca a
  la rama intermedia).
- **Antes de pushear un follow-up a una rama con PR, verificar que el PR siga `OPEN`**
  (`gh pr view <N> --json state`). Si ya se mergeó, la rama está "muerta": no le agregues
  commits. Ramificá desde `main` fresco; si ya pusheaste un commit suelto a la rama vieja,
  recuperalo abriendo un PR nuevo de esa rama → `main` (el diff será solo ese commit).
- Al terminar una tanda, **borrar las ramas ya mergeadas** para no dejar salsa (que nadie las
  re-mergee por error).
- PRs chicos y coherentes (una feature por PR): se revisan mejor que un mega-PR.

## Sesiones asistidas por IA (Claude Code)

- **Confirmar con el dueño del repo antes de cualquier push/PR/deploy** (local → nube). No
  subir sin OK explícito.
- Las credenciales de producción viven **solo** en las env vars de Vercel; nunca en el repo
  ni en `.env` commiteados.

## Deuda conocida / pendiente

- **Sin CI**: los tests (tsc/jest/eslint/e2e) **no** corren solos en los PRs — hoy se verifican
  a mano. Es la prioridad de robustez #1 (pasar de "vigilancia" a "automático" con branch protection).
- **Drift de migraciones en Supabase**: reconciliar el schema real de prod con las migraciones
  (ya causó un crash P2022). Migraciones a prod: siempre por el flujo de migración, nunca `db push` a mano.
