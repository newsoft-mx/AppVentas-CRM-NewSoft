ALTER TABLE "empresa"
ADD COLUMN "nombre_comercial" VARCHAR(200);

UPDATE "empresa"
SET "nombre_comercial" = 'Newsoft'
WHERE "nombre_comercial" IS NULL;
