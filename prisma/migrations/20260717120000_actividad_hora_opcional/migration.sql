-- SOL-22: la hora es opcional. fecha_evento/fecha_tarea son instantes y siempre llevan
-- hora, así que sin este dato hay que inventarle una y mostrarla como si la hubiera
-- elegido el usuario. Cuando es false, el instante guardado es el FIN del día (23:59 hora
-- de pared CDMX) y la UI muestra solo la fecha.
--
-- Aditiva: default true = "tiene hora", que es lo que hoy muestran todas las filas
-- existentes. No se puede distinguir cuáles traían hora elegida y cuáles la heredaron del
-- default viejo (09:00), así que se conservan como están: no se toca data real.
ALTER TABLE "deal_actividad" ADD COLUMN "hora_definida" BOOLEAN NOT NULL DEFAULT true;
