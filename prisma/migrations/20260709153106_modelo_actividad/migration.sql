-- CreateEnum
CREATE TYPE "efecto_termometro" AS ENUM ('POSITIVO', 'NEUTRO', 'NEGATIVO');
CREATE TYPE "estado_planeacion" AS ENUM ('PLANEADA', 'REALIZADA');

-- CreateTable
CREATE TABLE "tipo_accion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(20) NOT NULL DEFAULT '#6B7A99',
    "agendable" BOOLEAN NOT NULL DEFAULT true,
    "con_resultado" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipo_accion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_accion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "efecto" "efecto_termometro" NOT NULL DEFAULT 'NEUTRO',
    "sugiere_reagendar" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resultado_accion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tipo_cotizacion" ADD COLUMN "color" VARCHAR(20) NOT NULL DEFAULT '#6B7A99';

-- AlterTable
ALTER TABLE "deal_actividad" ADD COLUMN "tipo_accion_id" UUID,
    ADD COLUMN "estado_plan" "estado_planeacion",
    ADD COLUMN "resultado_id" UUID;

-- AddForeignKey
ALTER TABLE "deal_actividad" ADD CONSTRAINT "deal_actividad_tipo_accion_id_fkey" FOREIGN KEY ("tipo_accion_id") REFERENCES "tipo_accion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_actividad" ADD CONSTRAINT "deal_actividad_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "resultado_accion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
