-- Apply this SQL once in BOTH Supabase projects (Hub: duqxzfyuhdmsnweclnka,
-- Knowledge: yweknqfqvjkxepivuufc). It creates the nonce store used for
-- single-use SSO codes and an audit trail surfaced by /diagnostics/sso.
--
-- Run it from the Supabase SQL editor or via psql. The Lovable migration
-- system did not auto-write this file because no migration tool is exposed
-- in the current session; it is safe to run multiple times.

create table if not exists public.sso_nonces (
  nonce text primary key,
  issuer text not null,
  audience text not null,
  subject text not null,
  used_at timestamptz not null default now()
);

grant all on public.sso_nonces to service_role;
alter table public.sso_nonces enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sso_nonces'
  ) then
    create policy "sso_nonces service role only select"
      on public.sso_nonces for select to service_role using (true);
  end if;
end $$;

create index if not exists sso_nonces_used_at_idx on public.sso_nonces (used_at);

create table if not exists public.sso_audit (
  id bigserial primary key,
  direction text not null,
  actor_zabbix_userid text,
  actor_username text,
  nonce text,
  outcome text not null,
  request_id text,
  created_at timestamptz not null default now()
);

grant all on public.sso_audit to service_role;
grant select on public.sso_audit to authenticated;
alter table public.sso_audit enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sso_audit'
  ) then
    create policy "sso_audit authenticated can read"
      on public.sso_audit for select to authenticated using (true);
  end if;
end $$;

create index if not exists sso_audit_created_at_idx on public.sso_audit (created_at desc);
