-- CreateTable
CREATE TABLE "auditoria_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" VARCHAR(64) NOT NULL,
    "accion" VARCHAR(20) NOT NULL,
    "etiqueta" VARCHAR(200),
    "autor" VARCHAR(150) NOT NULL,
    "user_id" UUID,
    "cambios" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_log_entidad_entidad_id_idx" ON "auditoria_log"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_log_created_at_idx" ON "auditoria_log"("created_at");

-- AddForeignKey
ALTER TABLE "auditoria_log" ADD CONSTRAINT "auditoria_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
