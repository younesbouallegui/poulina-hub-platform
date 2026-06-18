# Zabbix Identity Integration & Governance

Replace the current Supabase email/Google auth with Zabbix as the source of truth for identity. The platform becomes a Zabbix admin console with full user CRUD, role mirroring, and a dual audit trail.

> ⚠️ Heads-up: this is a breaking change. Existing Supabase logins (including Google) will stop working after rollout. Only users that exist in Zabbix will be able to sign in. Make sure your Zabbix admin account is ready before we deploy.

---

## 1. Architecture

```text
 ┌──────────┐   email+password   ┌────────────────────┐   user.login    ┌─────────┐
 │ Browser  │ ─────────────────▶ │ edge: zabbix-auth  │ ──────────────▶ │ Zabbix  │
 └──────────┘                    └────────────────────┘                 └─────────┘
      ▲                                   │                                 │
      │ Supabase session (custom JWT       │ user.get + role.get +          │
      │ minted from Zabbix profile)        │ usergroup.get                  │
      │                                    ▼                                │
      │                          ┌────────────────────┐                     │
      └────────────────────────  │  identity cache &  │  ◀──── sync job ────┘
                                 │  audit (Postgres)  │      (every 15 min)
                                 └────────────────────┘
```

- **Login**: user submits Zabbix username + password → edge function `zabbix-auth` calls `user.login`, fetches profile/roles/groups, then provisions/updates a matching Supabase auth user (deterministic email `zbx-{userid}@zabbix.local` or real email when present) and returns a session.
- **Session**: still a Supabase JWT (so `supabase.auth` works everywhere) but the user's roles come from the mirrored Zabbix data, not from `user_roles`.
- **Sync**: a scheduled edge function reconciles `zbx_users / zbx_roles / zbx_user_groups` tables every 15 min and on-demand from the Users page.
- **Writes**: every create/edit/disable/reset/group/role action calls the Zabbix API first, then updates the mirror, then writes audit.

---

## 2. Database (one migration)

New tables in `public`, all with proper GRANTs + RLS:

- `zbx_users` — `zabbix_userid` (PK), `username`, `name`, `surname`, `email`, `roleid`, `status` (enabled/disabled), `last_synced_at`, `auth_user_id` (FK to `auth.users`, nullable).
- `zbx_roles` — `roleid` (PK), `name`, `type` (1 user / 2 admin / 3 super admin), `readonly`.
- `zbx_user_groups` — `usrgrpid` (PK), `name`, `gui_access`, `users_status`.
- `zbx_user_group_members` — (`usrgrpid`, `zabbix_userid`) composite PK.
- `identity_audit` — `actor_zabbix_userid`, `actor_username`, `action` (enum: login, user.create, user.update, user.disable, user.delete, password.reset, role.assign, group.assign), `target_zabbix_userid`, `before` jsonb, `after` jsonb, `created_at`.

Policies:
- `zbx_*` tables: `SELECT` for `authenticated`; writes only via service role (edge functions).
- `identity_audit`: `INSERT` from edge functions (service role); `SELECT` only for admins/auditors (uses `has_role`).

`has_role()` is rewritten to look up the caller's `zbx_users` row → derived platform role from Zabbix `role.type` + custom-role name mapping.

---

## 3. Edge functions

All call Zabbix through the existing token (no per-user Zabbix tokens stored client-side).

1. **`zabbix-auth`** (`verify_jwt = false`) — POST `{username, password}` → calls Zabbix `user.login` to validate, then fetches `user.get` + `role.get` + `usergroup.get`, upserts mirror tables, ensures a Supabase auth user exists (admin API with service role), signs them in (server-side `admin.generateLink` → returns access+refresh tokens), writes `identity_audit{action: login}`.
2. **`zabbix-users`** — authenticated CRUD endpoints:
   - `POST /create` → `user.create` then mirror upsert + audit
   - `PATCH /update` → `user.update` (also handles enable/disable via `users_status`) + audit with before/after
   - `POST /reset-password` → `user.update` with new password + audit (value redacted)
   - `DELETE /delete` → `user.delete` + mirror delete + audit
   - `POST /assign-groups` / `POST /assign-role` → `user.update` + audit
   - Requires platform role `super_admin` or `admin`.
3. **`zabbix-sync`** — pulls `user.get`/`role.get`/`usergroup.get` and reconciles mirror tables. Triggered (a) every 15 min via `pg_cron`+`pg_net`, (b) on demand from Users page “Sync now” button.

Roles map:
- Zabbix type 3 (Super admin) → `super_admin`
- Zabbix type 2 (Admin) → `admin`
- Zabbix type 1 (User) → `operator`
- Custom roles → `operator` by default, overridable via a small `zbx_role_map` table (added in same migration) so admins can re-map without code changes.

---

## 4. Frontend

- **`AuthContext`** — replace email/Google login with Zabbix username/password. `loadRoles` now reads from `zbx_users` joined to `zbx_role_map`. Google button + signup removed; “Forgot password” becomes “Contact your Zabbix administrator”.
- **`Login.tsx`** — relabel email→username, drop Google CTA, add help text “Use your Zabbix credentials”.
- **`/governance/users`** — rebuilt as a Zabbix admin console:
  - Table fed by `zbx_users` (joined with roles/groups), with “Sync now”, search, role/group filters.
  - Row actions: edit, reset password, enable/disable, delete, assign groups, assign role — each calls the `zabbix-users` edge function and refreshes the row.
  - “Create user” dialog with username/name/surname/email/password/role/groups.
- **`/governance/audit-log`** — extended to show `identity_audit` entries with before/after diff viewer.
- **`/governance/departments`** — repointed to Zabbix user groups (read-only in this iteration, with a note).

Permission enforcement (RBAC) stays as-is in `RoleGuard`/sidebar, but the roles now flow from Zabbix.

---

## 5. Audit (both stores)

- Platform writes every identity event to `identity_audit`.
- Zabbix records its own audit natively for every API call we make on its side (no extra work needed there). Audit Log page gets a tab “Zabbix audit” that fetches `auditlog.get` via the proxy for cross-checks.

---

## 6. Out of scope for this iteration

- SSO providers (LDAP/AD/SAML/OIDC/Azure AD/Keycloak) — skipped per your answer.
- Media types editing — deferred (read-only).
- Conflict resolution UI for sync — sync is last-write-wins from Zabbix; conflicts are surfaced as toast on the Users page.

---

## 7. Rollout order

1. Migration (tables, grants, RLS, role-map seed, `has_role` rewrite).
2. Edge functions `zabbix-auth`, `zabbix-users`, `zabbix-sync` + `pg_cron` schedule.
3. `AuthContext` + `Login.tsx` rewrite.
4. Users page rebuild + Audit Log extension.
5. Smoke test: log in with a Zabbix super-admin, create a test user, disable it, reset password, verify mirror + audit + Zabbix UI all agree.

Reply **approve** to start, or tell me what to change.