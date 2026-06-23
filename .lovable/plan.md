# Zabbix-Identity SSO Between Hub and Knowledge

## Goal
Both platforms trust the **same Zabbix user directory**. SSO carries a signed, short-lived token describing the authenticated Zabbix user. No Supabase user creation, no magic-link minting, no cross-project user sync.

## Architecture

```text
Hub (logged-in Zabbix user)
   │  click "Go to Knowledge"
   ▼
Hub edge fn: sso-token-mint
   - reads current Zabbix session (from Hub session/JWT)
   - builds payload {username, name, roles, iat, exp, nonce, iss:"hub"}
   - signs with SSO_SHARED_SECRET (HMAC-SHA256, JWS compact)
   ▼
Redirect → https://aiknowledge.younesblg.com/auth/sso?code=<jws>
   ▼
Knowledge edge fn: sso-redeem
   - verifies HMAC, exp, nonce-not-seen (nonce cache table)
   - establishes local Knowledge session keyed by Zabbix username
   - returns/redirects user into app — no login screen

Reverse: Knowledge → Hub uses identical contract, iss:"knowledge".
```

Single shared secret `SSO_SHARED_SECRET` lives in both Supabase projects.

## Token Format
Compact JWS: `base64url(header).base64url(payload).base64url(hmac)`
Header: `{"alg":"HS256","typ":"SSO"}`
Payload:
```json
{
  "iss": "hub" | "knowledge",
  "aud": "knowledge" | "hub",
  "sub": "<zabbix_userid>",
  "username": "...",
  "name": "...",
  "roles": ["..."],
  "iat": 1700000000,
  "exp": 1700000060,
  "nonce": "uuid"
}
```
TTL: 60s. Nonce stored in `sso_nonces(nonce text pk, used_at timestamptz)` to prevent replay.

## Edge Functions (Hub side)

### `sso-token-mint` (NEW, replacing the action branch in zabbix-auth)
- POST `{ target: "knowledge" }` with caller's Hub JWT → reads Zabbix identity from `user_metadata`.
- Returns `{ redirect_url: "https://aiknowledge.younesblg.com/auth/sso?code=..." }`.
- GET `?health=1` → `{status:"ok", version, env}`.

### `sso-redeem` (REWRITTEN)
- POST `{ code }` → verifies JWS with `SSO_SHARED_SECRET`, checks aud=="hub", exp, nonce.
- Inserts nonce into `sso_nonces`.
- Returns `{ identity: {username, name, roles, zabbix_userid} }` and sets a Hub-issued **signed app session cookie/JWT** that the Hub frontend stores (not a Supabase Auth session).
- GET `?health=1`.

### Frontend session model
Hub already gates routes by Zabbix login. The redeem response is stored in `localStorage` under the existing Zabbix-session key consumed by `AuthContext`/`ProtectedRoute`. No Supabase Auth `setSession` call.

## Knowledge side
Mirror: `sso-token-mint` and `sso-redeem` with swapped `iss`/`aud`. Implemented in the Knowledge project (out of this repo). This repo will ship a `KNOWLEDGE_SSO_CONTRACT.md` spec + reference TypeScript helpers in `supabase/functions/_shared/sso.ts` so the Knowledge team deploys an identical verifier.

## Database (Hub)
Migration: `sso_nonces` table + grants + RLS (service-role only).

## Frontend changes
- `KnowledgeSSOButton`: calls `sso-token-mint`, then `window.location.href = redirect_url`. No more redeem-from-Hub side.
- New route `/auth/sso` (`AuthSSO.tsx`): calls `sso-redeem` with `?code`, stores returned identity, navigates to `/`.
- Remove all Supabase-Auth `setSession`/`generateLink`/`admin.createUser` code from `sso-redeem`.
- New page `/diagnostics/sso` showing:
  - sender health (`sso-token-mint?health=1`)
  - receiver health (`sso-redeem?health=1`)
  - deployed version strings
  - last successful exchange (read from `sso_audit` table, last row)

## Deployment verification
`.github/workflows/deploy.yml`:
- Deploy `sso-token-mint`, `sso-redeem` (drop the old `zabbix-auth` SSO branch deploy).
- After deploy, curl `?health=1` for both and assert version string matches the one baked into the source (`SSO_VERSION = "sso-v1"`).
- Fail loudly if `SUPABASE_ACCESS_TOKEN` missing.

## Secrets required (Hub project)
- `SSO_SHARED_SECRET` (generate, 64 chars) — must be set identically in Knowledge project.

## Out of scope here
- Knowledge-side function code lives in the other repo; I'll provide the spec doc + shared helper for them to drop in.

## Files to add/edit
- add: `supabase/functions/sso-token-mint/index.ts`
- rewrite: `supabase/functions/sso-redeem/index.ts`
- add: `supabase/functions/_shared/sso.ts` (sign/verify helpers)
- add: `supabase/migrations/<ts>_sso_nonces.sql`
- add: `src/pages/diagnostics/SsoDiagnostics.tsx` + route
- edit: `src/pages/AuthSSO.tsx` (simpler redeem flow)
- edit: `src/components/layout/KnowledgeSSOButton.tsx` (mint+redirect only)
- edit: `.github/workflows/deploy.yml`
- edit: `supabase/config.toml` (register new function)
- add: `KNOWLEDGE_SSO_CONTRACT.md`

## Confirmations needed
1. OK to **generate** `SSO_SHARED_SECRET` now (you'll copy it into the Knowledge Supabase project manually)?
2. OK to **delete** the SSO branch inside `zabbix-auth` and rely solely on the new `sso-token-mint` function?
3. Confirm Knowledge's redirect target is exactly `https://aiknowledge.younesblg.com/auth/sso?code=...` (it is — restating to lock).
