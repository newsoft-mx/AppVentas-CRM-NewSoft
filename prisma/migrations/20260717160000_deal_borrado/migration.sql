-- Borrado de leads. Del form web entra basura y hay que poder sacarla.
--
-- ADITIVA: columnas nuevas con default. No toca data existente (todos los deals de hoy
-- quedan eliminada=false, o sea visibles, que es como se ven ahora).
--
-- Qué se destruye y qué se marca lo decide lib/deals → clasificarBorrado(): un lead virgen
-- (sin actividad real) se borra FÍSICO —no hay nada que recuperar— y uno trabajado se
-- marca. El índice parcial es porque el 99% de las queries filtran eliminada=false
-- (el candado vive en scopeDealWhere).
ALTER TABLE "deal" ADD COLUMN "eliminada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "deal" ADD COLUMN "eliminada_at" TIMESTAMPTZ(6);
ALTER TABLE "deal" ADD COLUMN "eliminada_por" VARCHAR(150);
ALTER TABLE "deal" ADD COLUMN "motivo_eliminacion" VARCHAR(200);

CREATE INDEX "deal_eliminada_idx" ON "deal" ("eliminada") WHERE "eliminada" = false;
