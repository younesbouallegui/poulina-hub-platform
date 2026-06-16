
CREATE TABLE IF NOT EXISTS public.monitoring_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unconfigured',
  secret_ref text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_score integer NOT NULL DEFAULT 0,
  sync_interval_minutes integer NOT NULL DEFAULT 5,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_providers TO authenticated;
GRANT ALL ON public.monitoring_providers TO service_role;
ALTER TABLE public.monitoring_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers read" ON public.monitoring_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers write admin" ON public.monitoring_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.monitoring_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monitoring_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.monitoring_providers(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text NOT NULL DEFAULT 'running',
  duration_ms integer,
  records_ingested integer NOT NULL DEFAULT 0,
  message text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_sync_logs TO authenticated;
GRANT ALL ON public.monitoring_sync_logs TO service_role;
ALTER TABLE public.monitoring_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs read" ON public.monitoring_sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs write admin" ON public.monitoring_sync_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.monitoring_host_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.monitoring_providers(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_host_groups TO authenticated;
GRANT ALL ON public.monitoring_host_groups TO service_role;
ALTER TABLE public.monitoring_host_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups read" ON public.monitoring_host_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups write admin" ON public.monitoring_host_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.monitoring_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.monitoring_providers(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  hostname text,
  ip_address text,
  available boolean DEFAULT false,
  status text,
  tags jsonb DEFAULT '[]'::jsonb,
  raw jsonb,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_hosts TO authenticated;
GRANT ALL ON public.monitoring_hosts TO service_role;
ALTER TABLE public.monitoring_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosts read" ON public.monitoring_hosts FOR SELECT TO authenticated USING (true);
CREATE POLICY "hosts write admin" ON public.monitoring_hosts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mh_updated BEFORE UPDATE ON public.monitoring_hosts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.monitoring_providers(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  host_id uuid REFERENCES public.monitoring_hosts(id) ON DELETE SET NULL,
  severity text,
  status text,
  title text,
  description text,
  triggered_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_alerts TO authenticated;
GRANT ALL ON public.monitoring_alerts TO service_role;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts read" ON public.monitoring_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "alerts write admin" ON public.monitoring_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.monitoring_providers(id) ON DELETE CASCADE,
  health_score integer,
  latency_ms integer,
  status text,
  message text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_health TO authenticated;
GRANT ALL ON public.provider_health TO service_role;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health read" ON public.provider_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "health write admin" ON public.provider_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
