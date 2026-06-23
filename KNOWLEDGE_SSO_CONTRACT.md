# Zabbix-Identity SSO Contract — Poulina AI Hub ↔ Poulina AI Knowledge

This document is the single source of truth for the SSO handshake between
**Poulina AI Hub** (`https://poulinaihub.younesblg.com`) and **Poulina AI
Knowledge** (`https://aiknowledge.younesblg.com`). Both platforms authenticate
users against the **same Zabbix user directory**. No cross-platform Supabase
user synchronization is performed.

## Shared secret

Both Supabase projects must hold the same value in the `SSO_SHARED_SECRET`
environment variable (used by `sso-token-mint` and `sso-redeem`). The Hub
secret was generated with `secrets.generate_secret` — copy it into the
Knowledge project's edge-function secrets under the same name.

## Token format

Compact JWS, HMAC-SHA256:

```
base64url(header) . base64url(payload) . base64url(hmac)
```

Header: `{"alg":"HS256","typ":"SSO","ver":"sso-v1"}`

Payload:

```json
{
  "iss": "hub" | "knowledge",
  "aud": "knowledge" | "hub",
  "sub": "<zabbix_userid>",
  "username": "<zabbix_username>",
  "name": "<display_name>",
  "roles": ["..."],
  "iat": <unix_seconds>,
  "exp": <unix_seconds, iat + 60>,
  "nonce": "<uuid>"
}
```

TTL is **60 seconds**. Nonces are single-use and stored server-side to block
replay.

## Endpoints

| Direction          | Sender mints at                                        | Receiver verifies at                                                   |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Hub → Knowledge    | Hub `sso-token-mint`                                    | Knowledge `sso-redeem` (this repo's contract; deploy in Knowledge)     |
| Knowledge → Hub    | Knowledge `sso-token-mint` (deploy in Knowledge)        | Hub `sso-redeem`                                                       |

Receiver URLs:

- Knowledge: `https://aiknowledge.younesblg.com/auth/sso?code=<jws>&from=hub`
- Hub: `https://poulinaihub.younesblg.com/auth/sso?code=<jws>&from=knowledge`

The frontend on the receiving side POSTs `{ code }` to its own `sso-redeem`
edge function and establishes the local session from the response.

## Reference implementation

The Hub ships canonical sign/verify helpers at
`supabase/functions/_shared/sso.ts`. Copy that file verbatim into the
Knowledge Supabase project under the same path. Both `sso-token-mint` and
`sso-redeem` on both sides must import from it so signing stays bit-for-bit
identical.

## Required database objects (each project)

```sql
create table public.sso_nonces (
  nonce text primary key,
  issuer text not null,
  audience text not null,
  subject text not null,
  used_at timestamptz not null default now()
);

create table public.sso_audit (
  id bigserial primary key,
  direction text not null,
  actor_zabbix_userid text,
  actor_username text,
  nonce text,
  outcome text not null,
  request_id text,
  created_at timestamptz not null default now()
);
```

Both tables are written by the service role only; no anon/authenticated
access required.

## Health endpoints

Every SSO function exposes `GET ?health=1`, returning:

```json
{ "status": "ok", "function": "...", "version": "sso-v1", "env": { ... } }
```

The Hub Diagnostics page (`/diagnostics/sso`) polls these endpoints on both
sides and surfaces deployed versions plus the last successful exchange.

## Failure semantics

| Condition                                | HTTP |
| ---------------------------------------- | ---- |
| Invalid signature                        | 401  |
| Expired or not-yet-valid token           | 401  |
| Audience or issuer mismatch              | 401  |
| Nonce already used (replay)              | 409  |
| Missing `SSO_SHARED_SECRET`              | 500  |

Receivers must NOT fall back to other auth flows on failure; the frontend
should surface the error and route the user to the standard login page.
