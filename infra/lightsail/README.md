# Terraform para Lightsail

Este stack crea una VM de Lightsail, una IP fija, una base PostgreSQL administrada y despliega la aplicacion con Docker Compose.

## Requisitos

- Terraform `>= 1.4`
- Credenciales AWS configuradas localmente
- Llave SSH existente en tu equipo
- Dockerfile y `docker-compose.prod.yml` incluidos en la raiz del proyecto

## Uso

```bash
cd infra/lightsail
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Al aplicar, Terraform empaqueta el proyecto, lo sube por SSH a `/opt/newsoft-sales`, construye las imagenes Docker, ejecuta `prisma migrate deploy` y levanta la app en el puerto `80`.

## Variables Criticas

- `database_admin_password`: password del PostgreSQL administrado.
- `session_secret`: secreto largo para firmar sesiones. Usa al menos 32 caracteres.
- `ssh_public_key_path` y `ssh_private_key_path`: llaves usadas por Lightsail y por Terraform para conectarse a la VM.
- `run_seed_on_first_deploy`: por defecto esta en `false`. Cambialo a `true` solo si quieres cargar datos iniciales demo/administrativos en el primer despliegue.

## Operacion

Para redeplegar cambios, vuelve a ejecutar:

```bash
terraform apply
```

Terraform detecta cambios del codigo por checksum, vuelve a subir el paquete, reconstruye el contenedor, aplica migraciones pendientes y reinicia la app.

## Notas

- La app queda publicada por IP en `http://<public_ip>`.
- El puerto `443` se abre si `open_https_port = true`, pero este stack no configura certificados TLS.
- El contenedor usa Node 22 y Next standalone para mantener la imagen de runtime acotada.
