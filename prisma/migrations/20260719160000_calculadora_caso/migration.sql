-- CreateTable
CREATE TABLE "calculadora_caso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "datos" JSONB NOT NULL,
    "user_id" UUID NOT NULL,
    "deal_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calculadora_caso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calculadora_caso_user_id_idx" ON "calculadora_caso"("user_id");

-- CreateIndex
CREATE INDEX "calculadora_caso_deal_id_idx" ON "calculadora_caso"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "calculadora_caso_user_id_nombre_key" ON "calculadora_caso"("user_id", "nombre");

-- AddForeignKey
ALTER TABLE "calculadora_caso" ADD CONSTRAINT "calculadora_caso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculadora_caso" ADD CONSTRAINT "calculadora_caso_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
