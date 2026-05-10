# Real Zabbix Integration — Phased Rollout Plan

You're asking for a full enterprise rebuild (ServiceNow + Datadog + Grafana + Zabbix fusion). That's genuinely 2–3 weeks of focused work — not a single turn. Trying to do it all at once will produce broken half-features across every page. Here's a realistic phased plan that delivers working real-data modules incrementally.

## What already exists

- `supabase/functions/zabbix-connector` — secure edge function with token server-side, supports `test`, `sync`, `call` actions
- Zabbix 7.2+ Bearer auth handled correctly
- Tables for `monitoring_hosts`, `monitoring_host_groups`, `monitoring_problems`

## What's missing (the gap)

- Token + URL secrets not yet set in Lovable Cloud
- Frontend pages (Alerts, Incidents, Infrastructure, SLA, Dashboards, Assets, Services, Executive, Maps, Users) all read from `mockData.ts` / `monitoringMock.ts`
- No bidirectional user sync (platform user ↔ Zabbix user)
- No real-time auto-refresh layer
- No graph/history/item drill-down using real Zabbix item IDs
- No SLA service tree from `service.get`
- No host inventory → CMDB mapping
- No geo map from inventory location fields

## Phase 1 — Foundation (this turn)

1. **Store secrets server-side**: prompt to add `ZABBIX_URL` and `ZABBIX_API_TOKEN` to Lovable Cloud
2. **Extend connector** with read-only RPCs the frontend needs:
   - `hosts` (host.get + interfaces + inventory + groups + tags)
   - `problems` (problem.get + trigger.get joined)
   - `events` (event.get with acknowledgment)
   - `items` (item.get for a host)
   - `history` (history.get for charting)
   - `services` (service.get for SLA)
   - `sla` (sla.get + sla.getsli)
3. **Add typed React Query client** `src/lib/zabbix.ts` that calls the edge function
4. **Wire Alerts page** to real `problem.get` data with auto-refresh (30s)
5. **Wire Infrastructure page** to real `host.get` with availability + interfaces

## Phase 2 — Core operational modules

- Incidents page → `event.get` history + acknowledgment actions
- Dashboard / Executive → real aggregated counts from problems + hosts
- Asset Registry (CMDB) → host.get with inventory fields
- SLA & Reports → service.get + sla.get
- Real graphs in dashboard panels using `history.get` + recharts

## Phase 3 — Maps + advanced

- Geo world map placing hosts by inventory `location_lat`/`location_lon`
- Zabbix native maps via `map.get` + iframe or SVG render
- NOC wall mode (full-screen rotating dashboards)

## Phase 4 — User governance (bidirectional)

- `user.create/update/delete` + `usergroup.get/update` from platform Users page
- Mirror Zabbix roles into local `user_roles` table
- Host-group ACL enforcement
- Audit log for every Zabbix write

## Phase 5 — SSO

- SAML/OIDC via Supabase Auth + Zabbix SAML config alignment
- LDAP/Azure AD documented setup

## Technical notes

- All Zabbix calls go through the edge function — token never touches the browser
- React Query for caching + auto-refresh (`refetchInterval: 30000`)
- Rate limiting via in-memory token bucket per user in the edge function
- Audit logging into a new `zabbix_audit_log` table for every write action
- Graceful fallback UI ("Zabbix unreachable — last known data 2m ago") instead of blank states

## What I'll ship in this turn (Phase 1 only)

A working foundation: secrets prompt, extended connector with `hosts` + `problems` + `events` actions, React Query hook, and the **Alerts** + **Infrastructure** pages reading live Zabbix data with auto-refresh. Everything else stays on mock data until subsequent turns — clearly marked so you know what's real vs pending.

Approve this plan and I'll start by requesting the secrets and shipping Phase 1.
