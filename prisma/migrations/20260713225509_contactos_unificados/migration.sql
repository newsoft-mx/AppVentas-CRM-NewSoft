-- Bloque C — Unificación de contactos
-- Contacto pasa a ser dueño del Cliente; DealContacto se convierte en link (contacto_id).
-- Migración aditiva con backfill (sin pérdida): principal por cliente + dedup de
-- contactos de deals. Todo corre dentro de la transacción de la migración.

-- 1. Tabla Contacto (dueño = Cliente)
CREATE TABLE "contacto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "email" VARCHAR(100),
    "telefono" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "cargo" VARCHAR(100),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "contacto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contacto_cliente_id_idx" ON "contacto"("cliente_id");

ALTER TABLE "contacto" ADD CONSTRAINT "contacto_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Principal por cliente (migra Cliente.contacto/email/telefono).
--    Cada cliente queda con exactamente un contacto es_principal=true.
INSERT INTO "contacto" ("cliente_id", "nombre", "email", "telefono", "es_principal", "activo")
SELECT "id", "contacto", "email", "telefono", true, true
FROM "cliente";

-- 3. DealContacto: nueva columna de link (nullable durante el backfill).
ALTER TABLE "deal_contacto" ADD COLUMN "contacto_id" UUID;

-- 4. Linkear al PRINCIPAL cuando el contacto del deal coincide con el del cliente.
--    En este punto cada cliente tiene un solo Contacto (el principal), así que el
--    match por email o nombre es determinista.
UPDATE "deal_contacto" dc
SET "contacto_id" = c."id"
FROM "deal" d, "contacto" c
WHERE dc."deal_id" = d."id"
  AND c."cliente_id" = d."cliente_id"
  AND dc."contacto_id" IS NULL
  AND (
        (dc."email" IS NOT NULL AND lower(c."email") = lower(dc."email"))
     OR (dc."email" IS NULL AND lower(c."nombre") = lower(dc."nombre"))
  );

-- 5. Crear un Contacto (no principal) por cada contacto de deal que NO coincidió,
--    deduplicando por (cliente, nombre) para que el mismo contacto en varios deals
--    del mismo cliente sea una sola fila.
INSERT INTO "contacto" ("cliente_id", "nombre", "email", "telefono", "whatsapp", "es_principal", "activo")
SELECT DISTINCT ON (d."cliente_id", lower(dc."nombre"))
       d."cliente_id", dc."nombre", dc."email", dc."telefono", dc."whatsapp", false, true
FROM "deal_contacto" dc
JOIN "deal" d ON d."id" = dc."deal_id"
WHERE dc."contacto_id" IS NULL
ORDER BY d."cliente_id", lower(dc."nombre"), dc."created_at" ASC;

-- 6. Linkear los restantes a su Contacto recién creado (por cliente + nombre).
UPDATE "deal_contacto" dc
SET "contacto_id" = c."id"
FROM "deal" d, "contacto" c
WHERE dc."deal_id" = d."id"
  AND c."cliente_id" = d."cliente_id"
  AND c."es_principal" = false
  AND lower(c."nombre") = lower(dc."nombre")
  AND dc."contacto_id" IS NULL;

-- 7. Colapsar links duplicados dentro de un mismo deal (violarían el @@unique).
--    Reasignar la bitácora al link que se conserva (el más antiguo).
WITH ranked AS (
  SELECT "id",
         row_number() OVER (PARTITION BY "deal_id", "contacto_id" ORDER BY "created_at" ASC) AS rn,
         first_value("id") OVER (PARTITION BY "deal_id", "contacto_id" ORDER BY "created_at" ASC) AS keep_id
  FROM "deal_contacto"
)
UPDATE "deal_actividad" a
SET "contacto_id" = r.keep_id
FROM ranked r
WHERE a."contacto_id" = r."id" AND r.rn > 1;

DELETE FROM "deal_contacto" dc
USING (
  SELECT "id",
         row_number() OVER (PARTITION BY "deal_id", "contacto_id" ORDER BY "created_at" ASC) AS rn
  FROM "deal_contacto"
) r
WHERE dc."id" = r."id" AND r.rn > 1;

-- 8. Cerrar el link: NOT NULL + FK + unique + index.
ALTER TABLE "deal_contacto" ALTER COLUMN "contacto_id" SET NOT NULL;

ALTER TABLE "deal_contacto" ADD CONSTRAINT "deal_contacto_contacto_id_fkey"
    FOREIGN KEY ("contacto_id") REFERENCES "contacto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "deal_contacto_deal_id_contacto_id_key" ON "deal_contacto"("deal_id", "contacto_id");
CREATE INDEX "deal_contacto_contacto_id_idx" ON "deal_contacto"("contacto_id");

-- 9. FASE EXPAND (segura): NO se dropean las columnas embebidas todavía.
--    Los datos ya viven en "contacto" (pasos 2/5), pero se conservan acá como red de
--    seguridad para poder auditar/recuperar tras el deploy. Como los inserts nuevos ya
--    no las escriben (el alta usa contacto_id), se relaja el NOT NULL de "nombre".
--    El DROP definitivo va en una migración de CONTRACT posterior, una vez verificado
--    en datos reales (ver prisma/pending-migrations/).
ALTER TABLE "deal_contacto" ALTER COLUMN "nombre" DROP NOT NULL;
