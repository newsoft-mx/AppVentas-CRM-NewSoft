# Migraciones pendientes (aplicación manual controlada)

Estas NO se aplican en el deploy automático. Son pasos destructivos que se ejecutan
a mano, después de verificar el estado en datos reales.

## Bloque C — contactos: patrón EXPAND / CONTRACT

Para que el primer deploy de contactos **no pueda perder datos**, se partió en dos:

1. **EXPAND** (ya en el PR de contactos, migración `20260713225509_contactos_unificados`):
   crea `contacto`, backfillea (principal por cliente + contactos de deals) y agrega el
   link `deal_contacto.contacto_id`. **Aditiva**: no dropea nada; las columnas embebidas
   (`nombre/email/telefono/whatsapp`) quedan como red de seguridad y `nombre` pasa a
   nullable. El código ya lee todo vía `contacto_id`, así que esas columnas quedan sin uso.

2. **CONTRACT** (`contract_drop_deal_contacto_legacy.sql`): dropea esas columnas. Se aplica
   **solo después** de verificar en staging/prod.

### Pasos de rollout

1. Deployar el PR de contactos (corre EXPAND, sin flag — no es destructiva).
2. Correr `scripts/diagnostico-contactos.sql` (solo SELECT) en Supabase (y luego en prod):
   los chequeos de integridad (sección 2) deben dar **0 filas**. Revisar la sección 3
   (posibles fusiones por homónimos) con el equipo.
3. Si todo OK, convertir `contract_drop_deal_contacto_legacy.sql` en una migración real
   (`prisma migrate dev --create-only --name contactos_contract`, pegar el SQL, y quitar
   las 4 columnas del modelo `DealContacto` en `schema.prisma`) y mergear ese PR.
4. Ese deploy sí es destructivo → necesita `ALLOW_DESTRUCTIVE_MIGRATIONS=1` (gate del Bloque B).

Ventaja: entre el paso 1 y el 3 los datos viejos siguen físicamente en la BD, así que
cualquier error de lógica del backfill (p. ej. un dedup que fusionó homónimos) es
**recuperable**, no una pérdida definitiva.
