-- CreateEnum
CREATE TYPE "temperatura_deal" AS ENUM ('MUY_FRIO', 'FRIO', 'TIBIO', 'CALIENTE', 'MUY_CALIENTE');

-- CreateEnum
CREATE TYPE "deal_resultado" AS ENUM ('ABIERTO', 'GANADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "tipo_actividad" AS ENUM ('NOTA', 'LLAMADA', 'EMAIL', 'WHATSAPP', 'SISTEMA');

-- CreateEnum
CREATE TYPE "rol_contacto" AS ENUM ('DECISOR', 'INFLUENCIADOR', 'USUARIO', 'OTRO');

-- CreateTable
CREATE TABLE "pipeline_stage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "orden" INTEGER NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT '#9BA5BE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(200) NOT NULL,
    "cliente_id" UUID NOT NULL,
    "vendedor_id" UUID,
    "stage_id" UUID NOT NULL,
    "tipo_cotizacion_id" UUID,
    "temperatura" "temperatura_deal" NOT NULL DEFAULT 'TIBIO',
    "probabilidad" INTEGER,
    "moneda" "moneda" NOT NULL DEFAULT 'MXN',
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "setup" DECIMAL(12,2),
    "mensualidad" DECIMAL(12,2),
    "meses" INTEGER,
    "canal" VARCHAR(100),
    "origen" VARCHAR(100),
    "fecha_cierre_estimada" DATE,
    "fecha_entrada_stage" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "deal_resultado" NOT NULL DEFAULT 'ABIERTO',
    "fecha_cierre_real" DATE,
    "orden_id" UUID,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_contacto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "rol" "rol_contacto" NOT NULL DEFAULT 'OTRO',
    "email" VARCHAR(100),
    "telefono" VARCHAR(20),
    "whatsapp" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_actividad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "tipo" "tipo_actividad" NOT NULL,
    "contenido" TEXT NOT NULL,
    "autor" VARCHAR(150) NOT NULL,
    "es_tarea" BOOLEAN NOT NULL DEFAULT false,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_tarea" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_adjunto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(50),
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_analisis_ia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "transcript" TEXT,
    "resultado" JSONB NOT NULL,
    "modelo" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_analisis_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_orden_id_key" ON "deal"("orden_id");

-- CreateIndex
CREATE INDEX "deal_stage_id_idx" ON "deal"("stage_id");

-- CreateIndex
CREATE INDEX "deal_vendedor_id_idx" ON "deal"("vendedor_id");

-- CreateIndex
CREATE INDEX "deal_cliente_id_idx" ON "deal"("cliente_id");

-- CreateIndex
CREATE INDEX "deal_contacto_deal_id_idx" ON "deal_contacto"("deal_id");

-- CreateIndex
CREATE INDEX "deal_actividad_deal_id_idx" ON "deal_actividad"("deal_id");

-- CreateIndex
CREATE INDEX "deal_adjunto_deal_id_idx" ON "deal_adjunto"("deal_id");

-- CreateIndex
CREATE INDEX "deal_analisis_ia_deal_id_idx" ON "deal_analisis_ia"("deal_id");

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_tipo_cotizacion_id_fkey" FOREIGN KEY ("tipo_cotizacion_id") REFERENCES "tipo_cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "orden_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_contacto" ADD CONSTRAINT "deal_contacto_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_actividad" ADD CONSTRAINT "deal_actividad_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_adjunto" ADD CONSTRAINT "deal_adjunto_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_analisis_ia" ADD CONSTRAINT "deal_analisis_ia_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
