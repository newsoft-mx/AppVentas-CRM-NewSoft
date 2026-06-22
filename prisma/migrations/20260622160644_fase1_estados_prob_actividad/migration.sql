-- AlterEnum
ALTER TYPE "deal_resultado" ADD VALUE 'SUSPENDIDO';

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "comentario_perdida" TEXT,
ADD COLUMN     "razon_perdida" VARCHAR(150);

-- AlterTable
ALTER TABLE "deal_actividad" ADD COLUMN     "contacto_id" UUID,
ADD COLUMN     "exitosa" BOOLEAN,
ADD COLUMN     "fecha_evento" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "pipeline_stage" ADD COLUMN     "probabilidad_base" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "deal_actividad_contacto_id_idx" ON "deal_actividad"("contacto_id");

-- AddForeignKey
ALTER TABLE "deal_actividad" ADD CONSTRAINT "deal_actividad_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "deal_contacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
