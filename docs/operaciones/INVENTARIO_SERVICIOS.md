# Inventario de servicios y cuentas

## AWS Lightsail

Uso:

- Servidor de aplicacion.
- IP publica/estatica.
- Base de datos administrada.

Datos conocidos:

- IP publica: `13.218.0.179`
- Usuario SSH: `ubuntu`
- Aplicacion en servidor: `/opt/newsoft-sales`
- Contenedor: `newsoft-sales-app`

Responsable/cuenta:

- Confirmar con el equipo propietario de la cuenta AWS.

## GitHub

Uso:

- Repositorio de codigo fuente.

Repositorio:

```text
https://github.com/lisandromartin-newsoft/AppVentas-NewSoft.git
```

## Docker

Uso:

- Construccion y ejecucion de la aplicacion en el servidor.

## Terraform

Uso:

- Aprovisionamiento y despliegue de infraestructura/app.

Ruta:

```text
infra/lightsail
```

## Dominio / DNS

Estado actual:

- No hay dominio conectado.
- La aplicacion sigue operando por IP publica.

## Vercel / Supabase

Estado actual:

- No forman parte del despliegue productivo si la aplicacion corre en Lightsail.
- Confirmar si existe algun uso historico o cuenta asociada.

## API keys adicionales

Estado actual:

- Revisar variables reales en `terraform.tfvars` / entorno del servidor.
- No incluir secretos en el repo ni en este paquete.

