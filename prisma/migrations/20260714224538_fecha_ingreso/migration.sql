-- AlterTable: fecha_ingreso (dato de negocio, editable). created_at queda inmutable.
ALTER TABLE "deal" ADD COLUMN     "fecha_ingreso" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: los deals existentes ingresaron cuando se crearon (no "hoy").
UPDATE "deal" SET "fecha_ingreso" = "created_at";
