-- Cuándo se pausó un deal (resultado = SUSPENDIDO). Sin este dato, "¿cuántos se
-- pausaron este mes?" solo se respondía contando tarjetas a mano en el kanban
-- (pedido de Gaby/Roldán, reunión 2026-09-02).
--
-- ADITIVA (expand): columna nullable + backfill; no borra ni renombra nada.
ALTER TABLE "deal" ADD COLUMN IF NOT EXISTS "fecha_suspension" TIMESTAMPTZ(6);

-- Backfill: para los deals HOY pausados, la fecha sale de la última actividad de
-- sistema que registró la suspensión (la bitácora ya guardaba el evento aunque el
-- deal no). Si un deal pausado no tiene esa traza (datos migrados a mano), cae a
-- fecha_entrada_stage: es el mejor "desde cuándo está así" disponible.
UPDATE "deal" d
SET "fecha_suspension" = COALESCE(
  (
    SELECT MAX(a."created_at")
    FROM "deal_actividad" a
    WHERE a."deal_id" = d."id"
      AND a."tipo" = 'SISTEMA'
      AND a."contenido" LIKE 'Deal marcado como SUSPENDIDO%'
  ),
  d."fecha_entrada_stage"
)
WHERE d."resultado" = 'SUSPENDIDO' AND d."fecha_suspension" IS NULL;
