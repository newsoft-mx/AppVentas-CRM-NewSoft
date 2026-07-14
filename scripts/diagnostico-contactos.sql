-- ============================================================================
-- Diagnóstico del backfill de contactos (Bloque C) — SOLO LECTURA (SELECT).
-- No modifica nada. Correr en Supabase (staging) y/o prod DESPUÉS de aplicar la
-- migración EXPAND (20260713225509_contactos_unificados) y ANTES del CONTRACT
-- (drop de columnas). Si todo da 0 en los chequeos de integridad, el drop es seguro.
-- ============================================================================

-- 1) Resumen general
SELECT
  (SELECT count(*) FROM cliente)                                         AS clientes,
  (SELECT count(*) FROM contacto)                                        AS contactos,
  (SELECT count(*) FROM contacto WHERE es_principal)                     AS principales,
  (SELECT count(*) FROM deal_contacto)                                   AS links_deal_contacto;

-- 2) ⚠️ INTEGRIDAD — todas deben dar 0 filas:

-- 2a) Clientes SIN contacto principal (invariante: exactamente 1 por cliente)
SELECT c.id, c.nombre
FROM cliente c
LEFT JOIN contacto k ON k.cliente_id = c.id AND k.es_principal AND k.activo
WHERE k.id IS NULL;

-- 2b) Clientes con MÁS de un principal (no debería pasar nunca)
SELECT cliente_id, count(*) AS principales
FROM contacto
WHERE es_principal AND activo
GROUP BY cliente_id
HAVING count(*) > 1;

-- 2c) Links deal_contacto sin contacto_id (romperían el CONTRACT)
SELECT id, deal_id FROM deal_contacto WHERE contacto_id IS NULL;

-- 2d) Datos embebidos que NO quedaron representados en su contacto linkeado
--     (por nombre o email). Si aparece algo acá, el backfill perdió información:
--     revisar ANTES de dropear las columnas.
--     Solo se miran filas con embebido NO nulo: las creadas después del deploy son
--     link-only (embebido NULL) y no aplican — no son un problema.
SELECT dc.id AS deal_contacto_id, dc.deal_id, dc.nombre AS nombre_embebido,
       dc.email AS email_embebido, k.nombre AS nombre_contacto, k.email AS email_contacto
FROM deal_contacto dc
JOIN contacto k ON k.id = dc.contacto_id
WHERE (dc.nombre IS NOT NULL AND lower(dc.nombre) <> lower(coalesce(k.nombre, '')))
   OR (dc.email  IS NOT NULL AND lower(dc.email)  <> lower(coalesce(k.email, '')));

-- 3) ℹ️ INFORMATIVO — posibles fusiones por dedup (homónimos del mismo cliente).
--    No es un error, pero conviene que el equipo confirme que son la misma persona.
SELECT k.cliente_id, k.nombre, count(*) AS veces_referenciado
FROM deal_contacto dc
JOIN contacto k ON k.id = dc.contacto_id
GROUP BY k.cliente_id, k.nombre
HAVING count(*) > 1
ORDER BY veces_referenciado DESC;
