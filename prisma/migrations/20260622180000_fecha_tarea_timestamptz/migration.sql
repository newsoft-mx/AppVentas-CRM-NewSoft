-- Seguimiento con hora: fecha_tarea pasa de date a timestamptz(6)
ALTER TABLE "deal_actividad"
  ALTER COLUMN "fecha_tarea" TYPE timestamptz(6) USING "fecha_tarea"::timestamptz;
