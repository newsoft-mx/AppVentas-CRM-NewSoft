# Entrega operativa - NewSoft Sales

Este paquete contiene la informacion necesaria para que otra persona pueda entender y operar el despliegue actual de NewSoft Sales.

## Estado actual

- La aplicacion esta desplegada en AWS Lightsail.
- El acceso publico actualmente es por IP, no por dominio.
- La aplicacion corre en Docker dentro del servidor.
- El codigo desplegado se deja en el servidor en `/opt/newsoft-sales`.
- La infraestructura principal se administra con Terraform desde `infra/lightsail`.

## Archivos incluidos

- `FLUJO_DESPLIEGUE.md`: explica el flujo completo de despliegue.
- `OPERACION_SERVIDOR.md`: comandos utiles para SSH, Docker, logs y validacion.
- `INVENTARIO_SERVICIOS.md`: servicios/cuentas involucrados.
- `checklists/ARCHIVOS_SENSIBLES.md`: lista de archivos que NO deben ir por Slack/correo.
- `checklists/VALIDACION_PRE_DEPLOY.md`: checklist antes de ejecutar despliegue.
- `terraform_lightsail_sin_secretos/`: copia de Terraform sin estado, variables sensibles, planes ni builds.
- `sensibles_no_incluir/`: carpeta placeholder para recordar que los sensibles se comparten aparte por canal seguro.

## Importante

Este paquete no incluye:

- `terraform.tfvars`
- `terraform.tfstate`
- backups de estado Terraform
- llaves SSH privadas
- `.env`
- paquetes de build
- credenciales o secretos

Esos archivos deben compartirse solo por canal seguro o revisarse en una reunion.

## Acceso SSH

La configuracion usada por Terraform apunta a:

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

- IP publica: `13.218.0.179`
- Usuario SSH: `ubuntu`
- Ruta app: `/opt/newsoft-sales`
- Contenedor principal: `newsoft-sales-app`
- Puerto publico: `80`

