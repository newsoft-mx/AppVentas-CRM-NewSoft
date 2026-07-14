-- CreateEnum
CREATE TYPE "tamano_empresa" AS ENUM ('MICRO', 'PEQUENA', 'MEDIANA', 'GRANDE');

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "tamano_empresa" "tamano_empresa",
ADD COLUMN     "website" VARCHAR(255);
