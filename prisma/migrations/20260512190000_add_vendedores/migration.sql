CREATE TABLE "vendedor" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     VARCHAR(150) NOT NULL,
  "email"      VARCHAR(100),
  "telefono"   VARCHAR(20),
  "activo"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "vendedor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orden_venta" ADD COLUMN "vendedor_id" UUID;

CREATE INDEX "orden_venta_vendedor_id_idx" ON "orden_venta"("vendedor_id");

ALTER TABLE "orden_venta"
  ADD CONSTRAINT "orden_venta_vendedor_id_fkey"
  FOREIGN KEY ("vendedor_id") REFERENCES "vendedor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
