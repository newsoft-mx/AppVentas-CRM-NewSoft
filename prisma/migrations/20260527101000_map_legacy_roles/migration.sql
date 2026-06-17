UPDATE "user" SET rol = 'VENDEDOR'::user_role WHERE rol::text = 'VENTAS';
UPDATE "user" SET rol = 'ADMINISTRATIVO'::user_role WHERE rol::text = 'CONSULTA';
