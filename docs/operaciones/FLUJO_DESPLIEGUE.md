# Flujo de despliegue

## Resumen

El despliegue no es solamente Terraform. Terraform crea o actualiza la infraestructura y tambien ejecuta pasos para empaquetar, subir y levantar la aplicacion en el servidor.

## Flujo general

1. Se trabaja desde el repositorio local de la aplicacion.
2. Se valida que el codigo este actualizado y sin cambios pendientes no deseados.
3. Se revisa que `infra/lightsail/terraform.tfvars` tenga las variables correctas.
4. Terraform empaqueta el codigo local.
5. Terraform sube el paquete al servidor Lightsail.
6. En el servidor, el codigo queda en `/opt/newsoft-sales`.
7. Docker construye la imagen de la app.
8. Docker Compose levanta el contenedor.
9. Prisma aplica migraciones contra la base de datos configurada.
10. Se valida que el contenedor quede levantado y healthy.

## Comandos base

Desde la raiz del repo:

```bash
cd /home/jesus/webpoint/AppVentas-NewSoft
```

Plan:

```bash
terraform -chdir=infra/lightsail plan -out=tfplan
```

Apply:

```bash
terraform -chdir=infra/lightsail apply tfplan
```

Si solo se quiere forzar empaquetado y despliegue de app:

```bash
terraform -chdir=infra/lightsail plan -out=tfplan \
  -replace=null_resource.package_app \
  -replace=null_resource.deploy_app
```

```bash
terraform -chdir=infra/lightsail apply tfplan
```

## Consideraciones

- No subir `.env`, `terraform.tfvars`, `terraform.tfstate` ni llaves SSH al repo.
- Si cambia Prisma, deben existir migraciones en `prisma/migrations`.
- Evitar cambios manuales en base de datos salvo casos puntuales y documentados.
- Si el deploy tarda, normalmente es por build de Docker en el servidor.
- Lightsail tiene recursos limitados; builds grandes pueden tardar varios minutos.
- Si Terraform falla a media ejecucion, revisar el estado del contenedor antes de volver a aplicar.

## Validacion posterior al deploy

```bash
ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179
```

```bash
sudo docker ps
sudo docker logs --tail=100 newsoft-sales-app
curl -I http://localhost
```

Tambien validar desde navegador:

```text
http://13.218.0.179
```

