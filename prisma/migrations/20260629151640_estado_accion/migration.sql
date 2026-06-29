-- CreateEnum
CREATE TYPE "estado_accion" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'TERMINADO');

-- AlterTable
ALTER TABLE "deal_actividad" ADD COLUMN     "estado_accion" "estado_accion" NOT NULL DEFAULT 'PENDIENTE';

-- Backfill: las tareas ya completadas pasan a TERMINADO (sync con completada)
UPDATE "deal_actividad" SET "estado_accion" = 'TERMINADO' WHERE "completada" = true;
