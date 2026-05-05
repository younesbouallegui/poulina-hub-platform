
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('admin', 'operator', 'viewer', 'auditor');
create type public.asset_type as enum ('server', 'container', 'k8s_cluster', 'application', 'router', 'switch', 'database', 'load_balancer', 'storage');
create type public.asset_status as enum ('active', 'maintenance', 'decommissioned', 'planned');
create type public.criticality as enum ('low', 'medium', 'high', 'critical');
create type public.environment as enum ('production', 'staging', 'development', 'dr');
create type public.dependency_type as enum ('depends_on', 'runs_on', 'connects_to', 'replicates_to');

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  department_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========================================================
-- DEPARTMENTS
-- =========================================================
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  manager_id uuid references auth.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.departments enable row level security;

alter table public.profiles
  add constraint profiles_department_fk foreign key (department_id) references public.departments(id) on delete set null;

-- =========================================================
-- USER ROLES (separate table — never on profiles)
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer to avoid recursive RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- =========================================================
-- BUSINESS SERVICES
-- =========================================================
create table public.business_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  criticality public.criticality not null default 'medium',
  sla_target numeric(5,2) not null default 99.9,
  owner_id uuid references auth.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_services enable row level security;

-- =========================================================
-- ASSETS (CMDB)
-- =========================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hostname text,
  asset_type public.asset_type not null,
  status public.asset_status not null default 'active',
  criticality public.criticality not null default 'medium',
  environment public.environment not null default 'production',
  ip_address text,
  os text,
  location text,
  owner_id uuid references auth.users(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  tags text[] default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assets enable row level security;
create index assets_dept_idx on public.assets(department_id);
create index assets_owner_idx on public.assets(owner_id);
create index assets_type_idx on public.assets(asset_type);

-- =========================================================
-- ASSET DEPENDENCIES
-- =========================================================
create table public.asset_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_asset_id uuid not null references public.assets(id) on delete cascade,
  target_asset_id uuid not null references public.assets(id) on delete cascade,
  dependency_type public.dependency_type not null default 'depends_on',
  created_at timestamptz not null default now(),
  unique (source_asset_id, target_asset_id, dependency_type),
  check (source_asset_id <> target_asset_id)
);
alter table public.asset_dependencies enable row level security;

-- =========================================================
-- SERVICE <-> ASSET MAP
-- =========================================================
create table public.service_assets (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.business_services(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  unique (service_id, asset_id)
);
alter table public.service_assets enable row level security;

-- =========================================================
-- AUDIT LOG
-- =========================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);

-- =========================================================
-- TIMESTAMP TRIGGER
-- =========================================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger tr_profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger tr_departments_updated before update on public.departments for each row execute function public.update_updated_at_column();
create trigger tr_services_updated before update on public.business_services for each row execute function public.update_updated_at_column();
create trigger tr_assets_updated before update on public.assets for each row execute function public.update_updated_at_column();

-- =========================================================
-- AUDIT TRIGGER
-- =========================================================
create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
begin
  select email into v_email from auth.users where id = v_actor;
  insert into public.audit_log(actor_id, actor_email, action, entity_type, entity_id, before, after)
  values (
    v_actor, v_email, tg_op, tg_table_name,
    coalesce((new).id, (old).id),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end; $$;

create trigger tr_audit_assets after insert or update or delete on public.assets for each row execute function public.write_audit();
create trigger tr_audit_services after insert or update or delete on public.business_services for each row execute function public.write_audit();
create trigger tr_audit_departments after insert or update or delete on public.departments for each row execute function public.write_audit();
create trigger tr_audit_roles after insert or update or delete on public.user_roles for each row execute function public.write_audit();
create trigger tr_audit_deps after insert or update or delete on public.asset_dependencies for each row execute function public.write_audit();

-- =========================================================
-- AUTO-PROFILE + DEFAULT ROLE ON SIGNUP
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, email, full_name, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;

  insert into public.user_roles(user_id, role) values (new.id, 'viewer')
  on conflict do nothing;

  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- Profiles: own update; everyone signed in can read
create policy "profiles_select_authed" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = user_id);

-- User roles: anyone authed can read; only admins write
create policy "roles_select_authed" on public.user_roles for select to authenticated using (true);
create policy "roles_admin_all" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Departments: read all authed, write admin
create policy "dept_select_authed" on public.departments for select to authenticated using (true);
create policy "dept_admin_all" on public.departments for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Business services
create policy "svc_select_authed" on public.business_services for select to authenticated using (true);
create policy "svc_admin_all" on public.business_services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Assets
create policy "assets_select_authed" on public.assets for select to authenticated using (true);
create policy "assets_admin_all" on public.assets for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "assets_operator_update_own" on public.assets for update to authenticated
  using (public.has_role(auth.uid(),'operator') and (owner_id = auth.uid() or department_id in (select department_id from public.profiles where user_id = auth.uid())))
  with check (public.has_role(auth.uid(),'operator'));

-- Dependencies
create policy "deps_select_authed" on public.asset_dependencies for select to authenticated using (true);
create policy "deps_admin_all" on public.asset_dependencies for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Service assets
create policy "sa_select_authed" on public.service_assets for select to authenticated using (true);
create policy "sa_admin_all" on public.service_assets for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Audit log: read authed, no writes from clients (only triggers)
create policy "audit_select_authed" on public.audit_log for select to authenticated using (true);
