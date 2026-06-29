-- CreateEnum
CREATE TYPE "estatus_cliente" AS ENUM ('PROSPECTO', 'ACTIVO', 'INACTIVO');

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "estatus" "estatus_cliente" NOT NULL DEFAULT 'ACTIVO';
