# Archivos sensibles

Estos archivos no deben enviarse por Slack, correo abierto ni subirse al repositorio.

## Terraform

Ruta local:

```text
infra/lightsail
```

Sensibles:

```text
terraform.tfvars
terraform.tfstate
terraform.tfstate.backup
terraform.tfstate.*.backup
tfplan
build/
```

Motivo:

- `terraform.tfvars` puede contener passwords, nombres de usuario y configuracion privada.
- `terraform.tfstate` puede contener datos sensibles de recursos reales.
- `tfplan` y `build/` son artefactos locales de despliegue.

## SSH

Rutas locales:

```text
~/.ssh/newsoft_lightsail
~/.ssh/newsoft_lightsail.pub
```

La llave privada `~/.ssh/newsoft_lightsail` debe compartirse solo por canal seguro.

## Entorno de aplicacion

No compartir:

```text
.env
.env.local
.env.production.local
```

## Recomendacion de entrega

Compartir este paquete por Slack/correo si se desea, pero los archivos sensibles deben compartirse aparte:

- en una reunion,
- usando gestor de secretos,
- usando enlace seguro con expiracion,
- o rotando credenciales despues de la entrega.

