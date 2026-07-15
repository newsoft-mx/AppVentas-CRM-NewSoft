-- Habilita RLS en todas las tablas de public (hallazgo del linter de Supabase:
-- PostgREST expone por default cualquier tabla del schema public). La app no
-- usa el cliente Supabase/PostgREST en ningún punto, solo Prisma con conexión
-- directa (rol owner), así que RLS sin políticas no afecta nada: solo cierra
-- el acceso vía la API REST autogenerada.

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_cotizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condicion_comercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivo_perdida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_accion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultado_accion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_adjunto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_analisis_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;