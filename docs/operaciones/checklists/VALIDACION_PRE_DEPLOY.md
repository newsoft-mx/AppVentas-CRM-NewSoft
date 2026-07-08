# Checklist pre deploy

Antes de ejecutar Terraform o redeploy:

- Confirmar rama correcta del repo.
- Confirmar que no hay cambios locales accidentales.
- Confirmar que `.env`, `terraform.tfvars`, `terraform.tfstate` y llaves SSH no estan stageados en Git.
- Confirmar que las migraciones Prisma necesarias existen en `prisma/migrations`.
- Confirmar que `terraform.tfvars` apunta al servidor/base correctos.
- Confirmar que se tiene acceso SSH al servidor.
- Confirmar que Docker esta disponible en el servidor.
- Confirmar espacio disponible en disco si el build previo fallo.

Comandos utiles:

```bash
git status --short
git branch --show-current
terraform -chdir=infra/lightsail plan -out=tfplan
```

Despues del deploy:

```bash
ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179
sudo docker ps
sudo docker logs --tail=100 newsoft-sales-app
curl -I http://localhost
```

