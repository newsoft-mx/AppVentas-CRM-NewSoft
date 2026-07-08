# Operacion del servidor

## Conexion SSH

```bash
ssh -i ~/.ssh/newsoft_lightsail ubuntu@13.218.0.179
```

## Ruta de la aplicacion

```bash
cd /opt/newsoft-sales
```

## Docker

Listar contenedores:

```bash
sudo docker ps
```

Ver logs:

```bash
sudo docker logs --tail=200 newsoft-sales-app
```

Seguir logs en vivo:

```bash
sudo docker logs -f newsoft-sales-app
```

Entrar al contenedor:

```bash
sudo docker exec -it newsoft-sales-app sh
```

Validar variables disponibles dentro del contenedor:

```bash
sudo docker exec -it newsoft-sales-app printenv
```

## Prisma

Ejecutar migraciones desde el contenedor:

```bash
sudo docker exec -it newsoft-sales-app npx prisma migrate deploy
```

Ejecutar SQL puntual con Prisma:

```bash
sudo docker exec -i newsoft-sales-app sh -c 'cat | npx prisma db execute --stdin' <<'SQL'
SELECT 1;
SQL
```

## Reinicio del contenedor

```bash
sudo docker restart newsoft-sales-app
```

## Validacion HTTP local

```bash
curl -I http://localhost
```

## Validacion HTTP publica

```bash
curl -I http://13.218.0.179
```

