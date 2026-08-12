# Desarrollo local — sembrar datos para probar a escala

> Cómo probar en local las pantallas que solo se rompen con volumen, sin que un dato de prueba
> llegue nunca al repositorio ni a una base que no sea la tuya.

## El problema

La BD local tiene un puñado de filas. Varias ramas de la interfaz **solo existen con volumen** y
por lo tanto no se pueden ver antes de que las vea el cliente:

- el colapso automático de grupos en Órdenes, que se activa con **más de 10 clientes**
- el ranking por monto facturado y su desempate entre clientes con el mismo total
- cualquier paginación futura

Sembrar a mano no escala y sembrar mal es peor que no probar.

## La regla

**No entra data demo al repositorio.** La app corre sobre datos reales; `prisma/seed.ts` sin
`--demo` es solo configuración (empresa, catálogos, etapas, usuarios) y así se queda.

Por eso `scripts/local/` está en `.gitignore`: los sembradores son **tuyos y de tu máquina**. Lo
que sí queda versionado es esta página, para que el próximo no tenga que deducir el patrón —ni,
peor, reinventarlo sin las barreras.

## El patrón, y por qué cada parte

Un sembrador local se escribe en `scripts/local/` y cumple tres cosas. Las tres importan; la
tercera sin las dos primeras es una falsa sensación de seguridad.

### 1. Solo puede correr contra la base local

Antes de instanciar Prisma, valida que la conexión apunte a `localhost:5433` — el Docker de este
proyecto. Si apunta a cualquier otro lado, aborta **sin tocar nada**.

Dos detalles que parecen menores y no lo son:

- **Mirá las variables que Prisma usa de verdad.** En este repo son `POSTGRES_PRISMA_URL` y
  `POSTGRES_URL_NON_POOLING` (ver `prisma/schema.prisma`), **no** `DATABASE_URL`. Un guard que
  inspecciona una variable distinta de la que Prisma abre no protege absolutamente nada, y encima
  aborta el uso legítimo. Validá **las dos**: `directUrl` también abre una conexión real.
- **El puerto es parte del chequeo.** `localhost:5432` no es la base local: bien puede ser un
  túnel a producción. Ese es justamente el accidente a impedir.
- Al reportar el error, imprimí `host:puerto`, **nunca la URL entera** — lleva la contraseña.

Prisma lee el `.env` recién al instanciar el cliente, o sea **después** de tu barrera: si solo
mirás `process.env`, en el uso normal no vas a encontrar nada. Leé el `.env` vos mismo, dándole
prioridad a lo que ya esté exportado en el entorno (que es lo que Prisma también va a preferir).

### 2. Nunca en producción

Abortá si `NODE_ENV === "production"`. Es barato y cierra el caso de un shell mal configurado.

### 3. Todo lo que crea es reconocible y reversible

Prefijá **todo** con `ZZLOCAL-` (nombres de cliente, folios de orden) y ofrecé un `--limpiar` que
borre exclusivamente eso.

> **Ningún `deleteMany` sin filtro de prefijo.** Ni uno. Si hace falta limpiar algo que no lleva
> prefijo, el sembrador no es el lugar.

Limpiá siempre al empezar, aunque vayas a sembrar: correrlo dos veces no debe duplicar filas ni
chocar contra el índice único del folio.

## Probá las barreras antes de confiar en ellas

Un guard sin probar no es un guard. Estos cuatro casos tienen que abortar, y conviene correrlos
cada vez que toques la validación:

| Caso | Cómo simularlo |
|---|---|
| Host de producción | `POSTGRES_PRISMA_URL="postgresql://u:p@db.xxx.supabase.co:5432/postgres"` |
| Túnel local a prod | `POSTGRES_PRISMA_URL="postgresql://u:p@localhost:5432/x"` |
| La principal local **pero** `directUrl` afuera | `POSTGRES_URL_NON_POOLING="postgresql://u:p@db.xxx.supabase.co:5432/postgres"` |
| Entorno productivo | `NODE_ENV=production` |

El tercero es el traicionero: la conexión "buena" pasa el chequeo y la otra abre igual.

## Después de probar

Corré el `--limpiar` y confirmá contra la base que los conteos volvieron a los de antes, y que no
quedó ninguna fila con el prefijo:

```bash
docker exec newsoft-sales-db psql -U postgres -d newsoft_sales -c "SELECT count(*) FROM cliente WHERE nombre LIKE 'ZZLOCAL-%';"
```
