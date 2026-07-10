-- AlterTable
ALTER TABLE "deal_actividad" ADD COLUMN     "editada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editada_at" TIMESTAMPTZ(6),
ADD COLUMN     "eliminada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminada_at" TIMESTAMPTZ(6);
