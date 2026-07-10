-- Retiro de columnas del motor legado (reemplazado por el scoring derivado on-read).
-- temperatura/probabilidad del deal y los params/umbral viejos ya no se leen ni escriben.
ALTER TABLE "deal" DROP COLUMN IF EXISTS "temperatura";
ALTER TABLE "deal" DROP COLUMN IF EXISTS "probabilidad";
ALTER TABLE "crm_config" DROP COLUMN IF EXISTS "puntos_actividad";
ALTER TABLE "crm_config" DROP COLUMN IF EXISTS "enfriamiento_nivel";
ALTER TABLE "pipeline_stage" DROP COLUMN IF EXISTS "umbral_avance";
