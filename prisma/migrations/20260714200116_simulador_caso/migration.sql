-- CreateTable
CREATE TABLE "simulador_caso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "datos" JSONB NOT NULL,
    "user_id" UUID NOT NULL,
    "deal_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "simulador_caso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulador_caso_user_id_idx" ON "simulador_caso"("user_id");

-- CreateIndex
CREATE INDEX "simulador_caso_deal_id_idx" ON "simulador_caso"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "simulador_caso_user_id_nombre_key" ON "simulador_caso"("user_id", "nombre");

-- AddForeignKey
ALTER TABLE "simulador_caso" ADD CONSTRAINT "simulador_caso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulador_caso" ADD CONSTRAINT "simulador_caso_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
