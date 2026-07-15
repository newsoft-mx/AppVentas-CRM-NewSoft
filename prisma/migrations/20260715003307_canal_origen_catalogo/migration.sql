-- CreateEnum
CREATE TYPE "tipo_catalogo_deal" AS ENUM ('CANAL', 'ORIGEN');

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "canal_id" UUID,
ADD COLUMN     "origen_id" UUID;

-- CreateTable
CREATE TABLE "catalogo_deal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_catalogo_deal" NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogo_deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_deal_tipo_nombre_key" ON "catalogo_deal"("tipo", "nombre");

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "catalogo_deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "catalogo_deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cada valor de texto distinto (no vacío) de canal/origen se vuelve una opción
-- del catálogo, y cada deal queda apuntando a la opción correspondiente. El texto legacy
-- se conserva (columnas canal/origen) hasta un contract futuro.
INSERT INTO "catalogo_deal" ("tipo", "nombre")
SELECT DISTINCT 'CANAL'::"tipo_catalogo_deal", trim("canal")
FROM "deal" WHERE "canal" IS NOT NULL AND trim("canal") <> '';

INSERT INTO "catalogo_deal" ("tipo", "nombre")
SELECT DISTINCT 'ORIGEN'::"tipo_catalogo_deal", trim("origen")
FROM "deal" WHERE "origen" IS NOT NULL AND trim("origen") <> '';

UPDATE "deal" d SET "canal_id" = c.id
FROM "catalogo_deal" c
WHERE c.tipo = 'CANAL' AND c.nombre = trim(d."canal") AND d."canal" IS NOT NULL AND trim(d."canal") <> '';

UPDATE "deal" d SET "origen_id" = c.id
FROM "catalogo_deal" c
WHERE c.tipo = 'ORIGEN' AND c.nombre = trim(d."origen") AND d."origen" IS NOT NULL AND trim(d."origen") <> '';
