-- CreateEnum
CREATE TYPE "avance_modo" AS ENUM ('SUGERIR', 'AUTOMATICO');

-- AlterTable
ALTER TABLE "deal_actividad" ADD COLUMN     "destacada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enlace_url" VARCHAR(500);

-- AlterTable
ALTER TABLE "pipeline_stage" ADD COLUMN     "umbral_avance" "temperatura_deal";

-- CreateTable
CREATE TABLE "crm_config" (
    "id" TEXT NOT NULL DEFAULT 'crm',
    "umbral_inactividad_dias" INTEGER NOT NULL DEFAULT 7,
    "avance_modo" "avance_modo" NOT NULL DEFAULT 'SUGERIR',
    "puntos_actividad" JSONB NOT NULL DEFAULT '{"LLAMADA":1,"EMAIL":1,"WHATSAPP":1,"NOTA":0}',
    "enfriamiento_nivel" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "crm_config_pkey" PRIMARY KEY ("id")
);

-- Singleton: fila única de configuración con los valores por defecto
INSERT INTO "crm_config" ("id", "updated_at") VALUES ('crm', now())
ON CONFLICT ("id") DO NOTHING;

-- Umbral de avance por defecto: las etapas medias/altas sugieren avanzar al ponerse calientes.
-- Roldán puede ajustarlo luego en Configuración.
UPDATE "pipeline_stage" SET "umbral_avance" = 'CALIENTE' WHERE "orden" >= 2;
