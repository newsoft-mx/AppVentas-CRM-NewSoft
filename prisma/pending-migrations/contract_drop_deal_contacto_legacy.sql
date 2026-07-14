-- CONTRACT (Bloque C) — eliminar las columnas embebidas de deal_contacto.
--
-- ⚠️ Esta es la parte DESTRUCTIVA. NO va en el PR de contactos. Se aplica DESPUÉS de:
--   1. Haber deployado la migración EXPAND (20260713225509_contactos_unificados),
--      que es 100% aditiva (crea "contacto", backfillea y agrega el link, SIN dropear).
--   2. Haber verificado en datos reales (staging/prod) con scripts/diagnostico-contactos.sql
--      que todos los clientes tienen principal y todos los deal_contacto están linkeados.
--
-- Cómo convertirla en migración real (en el PR de follow-up):
--   npx prisma migrate dev --create-only --name contactos_contract
--   (pegar este SQL en el migration.sql generado, quitando las columnas del schema)
--
-- Guardas de seguridad: aborta si algún deal_contacto quedó sin link (no debería, es
-- NOT NULL, pero deja el intento explícito y ruidoso).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "deal_contacto" WHERE "contacto_id" IS NULL) THEN
    RAISE EXCEPTION 'Hay deal_contacto sin contacto_id: NO se dropean columnas (revisar el backfill).';
  END IF;
END $$;

ALTER TABLE "deal_contacto" DROP COLUMN "nombre";
ALTER TABLE "deal_contacto" DROP COLUMN "email";
ALTER TABLE "deal_contacto" DROP COLUMN "telefono";
ALTER TABLE "deal_contacto" DROP COLUMN "whatsapp";
