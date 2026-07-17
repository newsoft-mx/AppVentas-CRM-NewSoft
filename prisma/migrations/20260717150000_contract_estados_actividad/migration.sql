-- CONTRACT de SOL-21/23 (la mitad "expand" se mergeó en #91).
--
-- DESTRUCTIVA A PROPÓSITO: el guard (scripts/guard-migrations.mjs) aborta el deploy salvo
-- ALLOW_DESTRUCTIVE_MIGRATIONS=1. Hay que activarlo para ESTE deploy y volver a sacarlo.
--
-- Por qué no se pierde nada:
--
-- * estado_accion / estado_plan: eran el MISMO concepto que `completada`, mantenidos en
--   sync a mano (TERMINADO ⟺ completada=true). No guardaban información propia. Desde #91
--   nadie los escribe, así que además ya derivaron: hoy contienen valores viejos que no
--   representan el estado real. El estado es uno y derivado (lib/tareas → estadoTarea).
--
-- * exitosa: parecía dato, pero el compositor viejo la mandaba SIEMPRE en cada llamada con
--   el checkbox tildado por default (useState(true)) — ese era el bug del "no contestó"
--   que arregló SOL-23. Así que `true` era el default, no una observación. Lo único con
--   señal era `false` (alguien destildó "¿Contestó?"), y se verificó en producción antes
--   de escribir esto: 0 filas. Lo que sí es una observación real vive ahora en
--   resultado_id (catálogo ResultadoAccion), que además mueve el termómetro.
--
-- Los enums quedan sin columnas que los usen: DROP TYPE no borra filas.
-- IF EXISTS: la BD de prod ya tiene las columnas dropeadas (el build de preview de este
-- PR corrió migrate deploy contra la BD compartida antes de mergear). Sin IF EXISTS, este
-- DROP fallaría el build de prod al intentar borrar algo que ya no está. Con IF EXISTS es
-- idempotente: funciona esté aplicada o no.
ALTER TABLE "deal_actividad" DROP COLUMN IF EXISTS "exitosa";
ALTER TABLE "deal_actividad" DROP COLUMN IF EXISTS "estado_accion";
ALTER TABLE "deal_actividad" DROP COLUMN IF EXISTS "estado_plan";

DROP TYPE IF EXISTS "estado_accion";
DROP TYPE IF EXISTS "estado_planeacion";
