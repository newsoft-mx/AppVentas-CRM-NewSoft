-- Migración inicial — Newsoft Sales
-- Crea todos los tipos, enums y tablas del esquema base

-- Enums
CREATE TYPE "estatus_orden" AS ENUM ('BORRADOR', 'COTIZADO', 'VENTA');
CREATE TYPE "moneda" AS ENUM ('MXN', 'USD');

-- Tabla: user
CREATE TABLE "user" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"        VARCHAR(150) NOT NULL,
  "email"         VARCHAR(100) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "activo"        BOOLEAN      NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- Tabla: empresa
CREATE TABLE "empresa" (
  "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"                   VARCHAR(200) NOT NULL,
  "rfc"                      VARCHAR(13)  NOT NULL,
  "direccion"                VARCHAR(500) NOT NULL,
  "email"                    VARCHAR(100) NOT NULL,
  "telefono"                 VARCHAR(20)  NOT NULL,
  "prefijo_folio"            VARCHAR(10)  NOT NULL,
  "siguiente_folio"          INTEGER      NOT NULL DEFAULT 1,
  "vigencia_cotizacion_dias" INTEGER      NOT NULL DEFAULT 30,
  "aplicar_iva"              BOOLEAN      NOT NULL DEFAULT true,
  "tasa_iva"                 DECIMAL(5,2) NOT NULL DEFAULT 16.00,
  "notas_documentos"         TEXT,
  "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- Tabla: tipo_cotizacion
CREATE TABLE "tipo_cotizacion" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"      VARCHAR(100) NOT NULL,
  "descripcion" VARCHAR(300),
  "activo"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "tipo_cotizacion_pkey" PRIMARY KEY ("id")
);

-- Tabla: condicion_comercial
CREATE TABLE "condicion_comercial" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"       VARCHAR(150) NOT NULL,
  "dias_credito" INTEGER,
  "descripcion"  TEXT,
  "activo"       BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "condicion_comercial_pkey" PRIMARY KEY ("id")
);

-- Tabla: cliente
CREATE TABLE "cliente" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "nombre"            VARCHAR(200) NOT NULL,
  "rfc"               VARCHAR(13)  NOT NULL,
  "contacto"          VARCHAR(150) NOT NULL,
  "ciudad"            VARCHAR(100) NOT NULL,
  "email"             VARCHAR(100) NOT NULL,
  "telefono"          VARCHAR(20),
  "condicion_pago_id" UUID         NOT NULL,
  "notas"             TEXT,
  "activo"            BOOLEAN      NOT NULL DEFAULT true,
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ  NOT NULL,
  CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cliente_rfc_key" ON "cliente"("rfc");
ALTER TABLE "cliente"
  ADD CONSTRAINT "cliente_condicion_pago_id_fkey"
  FOREIGN KEY ("condicion_pago_id") REFERENCES "condicion_comercial"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabla: orden_venta
CREATE TABLE "orden_venta" (
  "id"                     UUID            NOT NULL DEFAULT gen_random_uuid(),
  "folio"                  VARCHAR(20)     NOT NULL,
  "cliente_id"             UUID            NOT NULL,
  "tipo_cotizacion_id"     UUID            NOT NULL,
  "condicion_pago_id"      UUID            NOT NULL,
  "descripcion"            VARCHAR(500)    NOT NULL,
  "estatus"                "estatus_orden" NOT NULL DEFAULT 'BORRADOR',
  "moneda"                 "moneda"        NOT NULL DEFAULT 'MXN',
  "tipo_cambio"            DECIMAL(10,4),
  "fecha_venta"            DATE,
  "vigencia"               DATE,
  "aplica_iva"             BOOLEAN         NOT NULL,
  "tasa_iva"               DECIMAL(5,2),
  "descuento_porcentaje"   DECIMAL(5,2),
  "descuento_descripcion"  VARCHAR(200),
  "subtotal"               DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "monto_descuento"        DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "subtotal_con_descuento" DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "monto_iva"              DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "total"                  DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "total_mxn"              DECIMAL(12,2)   NOT NULL DEFAULT 0,
  "notas"                  TEXT,
  "duplicada_de_id"        UUID,
  "created_at"             TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ     NOT NULL,
  CONSTRAINT "orden_venta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orden_venta_folio_key" ON "orden_venta"("folio");
ALTER TABLE "orden_venta"
  ADD CONSTRAINT "orden_venta_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_venta"
  ADD CONSTRAINT "orden_venta_tipo_cotizacion_id_fkey"
  FOREIGN KEY ("tipo_cotizacion_id") REFERENCES "tipo_cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_venta"
  ADD CONSTRAINT "orden_venta_condicion_pago_id_fkey"
  FOREIGN KEY ("condicion_pago_id") REFERENCES "condicion_comercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_venta"
  ADD CONSTRAINT "orden_venta_duplicada_de_id_fkey"
  FOREIGN KEY ("duplicada_de_id") REFERENCES "orden_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla: partida
CREATE TABLE "partida" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "orden_id"        UUID         NOT NULL,
  "descripcion"     VARCHAR(500) NOT NULL,
  "cantidad"        DECIMAL(10,2) NOT NULL,
  "precio_unitario" DECIMAL(12,2) NOT NULL,
  "total_partida"   DECIMAL(12,2) NOT NULL,
  "orden_display"   INTEGER      NOT NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "partida_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "partida"
  ADD CONSTRAINT "partida_orden_id_fkey"
  FOREIGN KEY ("orden_id") REFERENCES "orden_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
