-- Bloque S — SSOT y ontología

-- 1. Enum muerto: TemperaturaDeal ya no lo usa ningún campo (la temperatura se
--    deriva on-read del score). Se elimina el tipo.
DROP TYPE IF EXISTS "temperatura_deal";

-- 2. MotivoPerdida → FK: Deal.razon_perdida (string libre) queda como etiqueta
--    denormalizada; se agrega el link al catálogo para integridad.
ALTER TABLE "deal" ADD COLUMN "motivo_perdida_id" UUID;

-- Backfill: enlazar por nombre (case-insensitive) los perdidos existentes.
UPDATE "deal" d
SET "motivo_perdida_id" = m."id"
FROM "motivo_perdida" m
WHERE d."razon_perdida" IS NOT NULL
  AND lower(m."nombre") = lower(d."razon_perdida");

CREATE INDEX "deal_motivo_perdida_id_idx" ON "deal"("motivo_perdida_id");

ALTER TABLE "deal" ADD CONSTRAINT "deal_motivo_perdida_id_fkey"
    FOREIGN KEY ("motivo_perdida_id") REFERENCES "motivo_perdida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
