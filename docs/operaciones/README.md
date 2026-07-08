# Operaciones — Newsoft Sales

Documentación de cómo se despliega y opera el sistema. Basada en la entrega de Jesús
(traspaso 2026-06-23) y verificada por acceso directo al servidor.

## Entornos

| Entorno | Dónde | Base de datos | Para qué |
|---|---|---|---|
| **Local** | Tu máquina | PostgreSQL en Docker | Desarrollo |
| **Staging** | Vercel | PostgreSQL de staging (separada) | Pruebas / demos al cliente |
| **Producción** | AWS Lightsail | PostgreSQL gestionado de Lightsail | Clientes reales |

## Producción (datos verificados 2026-06-23)

- **Servidor:** AWS Lightsail — IP pública `13.218.0.179`, puerto `80`.
- **App:** corre en Docker, contenedor `newsoft-sales-app`.
- **Ruta real en el servidor:** `/opt/appventas-newsoft`.
- **Acceso:** `ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179`.
- **Deploy:** manual con Terraform desde `infra/lightsail` (no hay CI/CD). Mergear a `main`
  **no** despliega por sí solo.

## Índice

- **[FLUJO_DESPLIEGUE.md](FLUJO_DESPLIEGUE.md)** — flujo completo de despliegue con Terraform.
- **[OPERACION_SERVIDOR.md](OPERACION_SERVIDOR.md)** — comandos de SSH, Docker, logs y Prisma.
- **[INVENTARIO_SERVICIOS.md](INVENTARIO_SERVICIOS.md)** — servicios y cuentas en uso.
- **[MIGRACION_VERCEL_SUPABASE.md](MIGRACION_VERCEL_SUPABASE.md)** — plan de migración a Vercel + Supabase, con troubleshooting del 500 por migraciones no aplicadas.
- **[checklists/VALIDACION_PRE_DEPLOY.md](checklists/VALIDACION_PRE_DEPLOY.md)** — checklist antes de desplegar.
- **[checklists/ARCHIVOS_SENSIBLES.md](checklists/ARCHIVOS_SENSIBLES.md)** — archivos que nunca van al repo.

## Seguridad

- Los secretos (`terraform.tfvars`, `terraform.tfstate`, `.env`, llaves SSH) **nunca** se commitean
  (ver `.gitignore`). Se guardan fuera del repo y se comparten solo por canal seguro.
- Tras el traspaso conviene **rotar** llave SSH, contraseña de la base y `SESSION_SECRET`.
