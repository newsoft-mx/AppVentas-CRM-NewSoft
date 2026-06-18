# Flujo de trabajo Git — NewSoft Sales (AppVentas-NewSoft)

Este documento define cómo trabajamos cambios en este repositorio para no romper producción.

## Regla de oro

**Nunca se trabaja ni se hace push directo a `main`.** La rama `main` está protegida:
cada push a `main` despliega automáticamente a **producción en Vercel**
(`app-ventas-new-soft.vercel.app`) y ejecuta las migraciones de Prisma contra la base
de datos real. Todo cambio entra por Pull Request.

## Dónde despliega

| Entorno | Plataforma | Cómo se actualiza |
|---------|-----------|-------------------|
| **Producción** | Vercel (`app-ventas-new-soft.vercel.app`) | Automático al mergear a `main` |
| **Preview** | Vercel | Automático en cada rama/PR (URL propia para probar) |
| AWS Lightsail | `infra/lightsail/` (Terraform) | Preparado pero **no en uso** — despliegue manual |

## Ciclo de un cambio

```bash
# 1. Partir SIEMPRE de main actualizado
git checkout main
git pull origin main

# 2. Crear la rama del requerimiento
git checkout -b feature/descripcion-corta

# 3. Trabajar y probar en local
npm run dev

# 4. Commit + push
git add <archivos>
git commit -m "feat: descripción del cambio"
git push -u origin feature/descripcion-corta

# 5. Abrir PR hacia main (por web o con gh)
gh pr create --fill --base main
```

## Convención de ramas

| Prefijo | Para qué |
|---------|----------|
| `feature/` | Nueva funcionalidad |
| `fix/` | Corrección de bug |
| `chore/` | Mantenimiento, config, limpieza |
| `docs/` | Solo documentación |

Ejemplo: `feature/exportacion-excel-csv`, `fix/remover-layout-excel-clientes`.

## Antes de mergear

1. Probar en **local** (`npm run dev`).
2. Revisar el **preview deployment** de Vercel que se genera para la rama.
3. Resolver las conversaciones del PR.
4. Mergear a `main` → Vercel despliega a producción solo.

## Reglas técnicas del proyecto

- Cálculos de moneda **siempre en backend**, nunca en frontend.
- Montos de cara al usuario en vistas agregadas: **netos sin IVA** (se usa el campo
  `subtotal_con_descuento`, no se divide entre 1.16).
- Cambios al schema de Prisma **siempre** con su migración (`npm run db:migrate`).
- No commitear archivos `.env*` ni secretos.
