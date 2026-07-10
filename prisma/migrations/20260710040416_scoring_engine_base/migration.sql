-- ── Motor de scoring (feature/scoring-engine) — migración aditiva ─────────────

-- AlterTable
ALTER TABLE "crm_config" ADD COLUMN     "decay_por_dia" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "niveles_umbral" JSONB NOT NULL DEFAULT '[20,40,60,80]',
ADD COLUMN     "score_inicial" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "sensibilidad_prob" DECIMAL(4,2) NOT NULL DEFAULT 0.4;

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "ajuste_manual" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pipeline_stage" ADD COLUMN     "umbral_avance_score" INTEGER;

-- AlterTable
ALTER TABLE "resultado_accion" ADD COLUMN     "factor" DECIMAL(3,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tipo_accion" ADD COLUMN     "peso" INTEGER NOT NULL DEFAULT 5;

-- ── Backfill de filas existentes ──────────────────────────────────────────────
-- factor grueso desde el efecto ya cargado (fallback para resultados personalizados)
UPDATE "resultado_accion" SET "factor" = CASE "efecto"
  WHEN 'POSITIVO' THEN 1.00 WHEN 'NEGATIVO' THEN -1.00 ELSE 0.00 END;

-- umbral_avance_score desde el enum legado (piso del rango de cada nivel)
UPDATE "pipeline_stage" SET "umbral_avance_score" = CASE "umbral_avance"
  WHEN 'MUY_FRIO' THEN 0  WHEN 'FRIO' THEN 20 WHEN 'TIBIO' THEN 40
  WHEN 'CALIENTE' THEN 60 WHEN 'MUY_CALIENTE' THEN 80 ELSE NULL END
WHERE "umbral_avance" IS NOT NULL;

-- ── Catálogo estándar (config production-safe). Inserta faltantes + fija peso/factor ──
INSERT INTO "tipo_accion" (nombre, peso, orden, agendable, con_resultado, activo)
SELECT v.nombre, v.peso, v.orden, v.agendable, v.con_resultado, true
FROM (VALUES
  ('Reunión', 15, 1, true, true),
  ('Visita', 14, 2, true, true),
  ('Demo / Presentación', 14, 3, true, true),
  ('Propuesta / Cotización enviada', 12, 4, true, true),
  ('Llamada', 8, 5, true, true),
  ('Email', 5, 6, true, true),
  ('WhatsApp', 4, 7, true, true),
  ('Nota', 0, 8, false, false),
  ('Pendiente / Tarea', 0, 9, true, false)
) AS v(nombre, peso, orden, agendable, con_resultado)
WHERE NOT EXISTS (SELECT 1 FROM "tipo_accion" t WHERE t.nombre = v.nombre);

-- Fija el peso de los tipos estándar que ya existían (esta migración estrena el campo)
UPDATE "tipo_accion" AS t SET peso = v.peso
FROM (VALUES
  ('Reunión', 15), ('Visita', 14), ('Demo / Presentación', 14),
  ('Propuesta / Cotización enviada', 12), ('Llamada', 8), ('Email', 5),
  ('WhatsApp', 4), ('Nota', 0), ('Pendiente / Tarea', 0)
) AS v(nombre, peso)
WHERE t.nombre = v.nombre;

INSERT INTO "resultado_accion" (nombre, factor, efecto, orden, sugiere_reagendar, activo)
SELECT v.nombre, v.factor, v.efecto::"efecto_termometro", v.orden, v.reagenda, true
FROM (VALUES
  ('Se concretó / avanzó',       1.00,  'POSITIVO', 1, false),
  ('Muy interesado',             0.80,  'POSITIVO', 2, false),
  ('Contestó, sin avance',       0.30,  'POSITIVO', 3, false),
  ('Reagendó',                   0.00,  'NEUTRO',   4, true),
  ('No contestó',               -0.30,  'NEGATIVO', 5, true),
  ('Sin interés por ahora',     -0.60,  'NEGATIVO', 6, false),
  ('No le interesó / canceló',  -1.00,  'NEGATIVO', 7, false)
) AS v(nombre, factor, efecto, orden, reagenda)
WHERE NOT EXISTS (SELECT 1 FROM "resultado_accion" r WHERE r.nombre = v.nombre);

-- Fija el factor + efecto de los resultados estándar que ya existían
UPDATE "resultado_accion" AS r SET factor = v.factor, efecto = v.efecto::"efecto_termometro"
FROM (VALUES
  ('Se concretó / avanzó',       1.00,  'POSITIVO'),
  ('Muy interesado',             0.80,  'POSITIVO'),
  ('Contestó, sin avance',       0.30,  'POSITIVO'),
  ('Reagendó',                   0.00,  'NEUTRO'),
  ('No contestó',               -0.30,  'NEGATIVO'),
  ('Sin interés por ahora',     -0.60,  'NEGATIVO'),
  ('No le interesó / canceló',  -1.00,  'NEGATIVO')
) AS v(nombre, factor, efecto)
WHERE r.nombre = v.nombre;
