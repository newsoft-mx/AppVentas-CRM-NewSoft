-- CONTRACT (Bloque C) — elimina las columnas embebidas legadas de deal_contacto.
--
-- ⚠️ Parte DESTRUCTIVA del patrón EXPAND/CONTRACT. El guard de migraciones la marca
-- destructiva → este deploy necesita ALLOW_DESTRUCTIVE_MIGRATIONS=1 (solo para este
-- deploy; quitarlo después).
--
-- Precondición: la migración EXPAND (20260713225509_contactos_unificados) ya movió los
-- datos a "contacto" (backfill), así que estas columnas ya no tienen información única.
-- El modelo (schema.prisma) ya no las declara y el código lee todo vía contacto_id.
-- Verificado con scripts/diagnostico-contactos.sql (integridad = 0 filas).
--
-- IDEMPOTENTE (DROP COLUMN IF EXISTS): en entornos donde ya no existen (Supabase) es
-- no-op y solo registra la migración; donde todavía están (local) las dropea.
--
-- Guarda: aborta si algún deal_contacto quedó sin link (no debería, contacto_id es
-- NOT NULL) — deja el intento explícito en vez de borrar a ciegas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "deal_contacto" WHERE "contacto_id" IS NULL) THEN
    RAISE EXCEPTION 'Hay deal_contacto sin contacto_id: NO se dropean columnas (revisar el backfill).';
  END IF;
END $$;

ALTER TABLE "deal_contacto" DROP COLUMN IF EXISTS "nombre";
ALTER TABLE "deal_contacto" DROP COLUMN IF EXISTS "email";
ALTER TABLE "deal_contacto" DROP COLUMN IF EXISTS "telefono";
ALTER TABLE "deal_contacto" DROP COLUMN IF EXISTS "whatsapp";
