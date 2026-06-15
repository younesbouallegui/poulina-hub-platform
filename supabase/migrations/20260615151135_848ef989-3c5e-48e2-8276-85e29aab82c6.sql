
-- 1. Enum for platform roles (reuse existing if present)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin','admin','operator','viewer','auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Zabbix mirror tables
CREATE TABLE IF NOT EXISTS public.zbx_users (
  zabbix_userid text PRIMARY KEY,
  username text NOT NULL,
  name text,
  surname text,
  email text,
  roleid text,
  type smallint,
  status smallint DEFAULT 0,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS zbx_users_username_uk ON public.zbx_users(lower(username));
CREATE INDEX IF NOT EXISTS zbx_users_auth_uid_idx ON public.zbx_users(auth_user_id);

GRANT SELECT ON public.zbx_users TO authenticated;
GRANT ALL ON public.zbx_users TO service_role;
ALTER TABLE public.zbx_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zbx_users readable by authenticated" ON public.zbx_users
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.zbx_roles (
  roleid text PRIMARY KEY,
  name text NOT NULL,
  type smallint NOT NULL,
  readonly smallint DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zbx_roles TO authenticated;
GRANT ALL ON public.zbx_roles TO service_role;
ALTER TABLE public.zbx_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zbx_roles readable by authenticated" ON public.zbx_roles
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.zbx_user_groups (
  usrgrpid text PRIMARY KEY,
  name text NOT NULL,
  gui_access smallint,
  users_status smallint,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zbx_user_groups TO authenticated;
GRANT ALL ON public.zbx_user_groups TO service_role;
ALTER TABLE public.zbx_user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zbx_user_groups readable by authenticated" ON public.zbx_user_groups
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.zbx_user_group_members (
  usrgrpid text NOT NULL REFERENCES public.zbx_user_groups(usrgrpid) ON DELETE CASCADE,
  zabbix_userid text NOT NULL REFERENCES public.zbx_users(zabbix_userid) ON DELETE CASCADE,
  PRIMARY KEY (usrgrpid, zabbix_userid)
);
GRANT SELECT ON public.zbx_user_group_members TO authenticated;
GRANT ALL ON public.zbx_user_group_members TO service_role;
ALTER TABLE public.zbx_user_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zbx_group_members readable by authenticated" ON public.zbx_user_group_members
  FOR SELECT TO authenticated USING (true);

-- 3. Role mapping: Zabbix role -> platform app_role
CREATE TABLE IF NOT EXISTS public.zbx_role_map (
  -- match on roleid (preferred) OR on role type (fallback)
  roleid text,
  role_type smallint,
  platform_role public.app_role NOT NULL,
  CONSTRAINT zbx_role_map_target CHECK (roleid IS NOT NULL OR role_type IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS zbx_role_map_roleid_uk ON public.zbx_role_map(roleid) WHERE roleid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS zbx_role_map_type_uk ON public.zbx_role_map(role_type) WHERE roleid IS NULL AND role_type IS NOT NULL;
GRANT SELECT ON public.zbx_role_map TO authenticated;
GRANT ALL ON public.zbx_role_map TO service_role;
ALTER TABLE public.zbx_role_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_map readable by authenticated" ON public.zbx_role_map
  FOR SELECT TO authenticated USING (true);

-- Seed default type mappings (idempotent)
INSERT INTO public.zbx_role_map(role_type, platform_role) VALUES
  (3, 'super_admin'::public.app_role),
  (2, 'admin'::public.app_role),
  (1, 'operator'::public.app_role)
ON CONFLICT DO NOTHING;

-- 4. Identity audit
CREATE TABLE IF NOT EXISTS public.identity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_auth_user_id uuid,
  actor_zabbix_userid text,
  actor_username text,
  action text NOT NULL,
  target_zabbix_userid text,
  target_username text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  source text DEFAULT 'platform',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_audit_created_idx ON public.identity_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS identity_audit_action_idx ON public.identity_audit(action);
CREATE INDEX IF NOT EXISTS identity_audit_target_idx ON public.identity_audit(target_zabbix_userid);
GRANT SELECT ON public.identity_audit TO authenticated;
GRANT ALL ON public.identity_audit TO service_role;
ALTER TABLE public.identity_audit ENABLE ROW LEVEL SECURITY;
-- SELECT policy uses has_role (defined below)

-- 5. Rewrite has_role() to derive platform role from linked Zabbix user
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.zbx_users zu
      LEFT JOIN public.zbx_role_map m_id ON m_id.roleid = zu.roleid
      LEFT JOIN public.zbx_role_map m_t  ON m_t.roleid IS NULL AND m_t.role_type = zu.type
     WHERE zu.auth_user_id = _user_id
       AND COALESCE(m_id.platform_role, m_t.platform_role, 'viewer'::public.app_role) = _role
  )
$$;

-- 6. Helper: get current user's platform roles (used by AuthContext)
CREATE OR REPLACE FUNCTION public.current_user_platform_roles()
RETURNS TABLE(role public.app_role, zabbix_userid text, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(m_id.platform_role, m_t.platform_role, 'viewer'::public.app_role) AS role,
    zu.zabbix_userid,
    zu.username
    FROM public.zbx_users zu
    LEFT JOIN public.zbx_role_map m_id ON m_id.roleid = zu.roleid
    LEFT JOIN public.zbx_role_map m_t  ON m_t.roleid IS NULL AND m_t.role_type = zu.type
   WHERE zu.auth_user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.current_user_platform_roles() TO authenticated;

-- Audit SELECT policy now that has_role exists
CREATE POLICY "audit readable by admins and auditors" ON public.identity_audit
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'auditor'::public.app_role)
  );

-- 7. updated_at trigger for zbx_users
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS zbx_users_touch ON public.zbx_users;
CREATE TRIGGER zbx_users_touch BEFORE UPDATE ON public.zbx_users
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
