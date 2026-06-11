
ALTER TABLE public.monitoring_providers
  ADD COLUMN health_score INTEGER,
  ADD COLUMN sync_interval_minutes INTEGER;

ALTER TABLE public.monitoring_sync_logs
  ADD COLUMN result TEXT,
  ADD COLUMN records_ingested INTEGER,
  ADD COLUMN duration_ms INTEGER,
  ADD COLUMN message TEXT;

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten audit_log insert policy
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
CREATE POLICY "Authenticated insert own audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id IS NULL OR actor_id = auth.uid());
