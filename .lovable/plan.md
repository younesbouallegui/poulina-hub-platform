# Phase 2 — Full Zabbix-Native Rebuild

This plan covers replacing every remaining mock/demo layer with live Zabbix data across 8 modules, plus backend hardening and a real interactive world map. The work is large; I'll execute it in sequenced waves so each wave lands in a working, deployable state.

## Wave 0 — Backend & Foundation (prereq for everything)

**`supabase/functions/zabbix-connector/index.ts`**
- Expand whitelist: add `event.get`, `service.get`, `sla.get`, `map.get`, `dashboard.get`, `graph.get`, `trend.get`, `usergroup.get`, `role.get`, `mediatype.get`, `user.get`, `hostinterface.get`, `acknowledge.create`-readonly variants.
- Add **privileged write router** (`action: "write"`) gated by `admin` role for: `event.acknowledge`, `user.create`, `user.update`, `user.delete`, `host.update` (inventory only).
- Add structured audit logging to a new `zabbix_audit_log` table for every write.
- Rate limit (per-user, in-memory token bucket), 15s timeout, 2x retry with exponential backoff.
- Bump `CONNECTOR_VERSION` to `2.0.0` and surface in every response so frontend can detect deploy drift.

**Database migration**
- `zabbix_audit_log (id, user_id, action, method, params jsonb, result text, created_at)`.
- `host_geo_overrides (host_id, lat, lon, source)` for manual geo enrichment.

**`src/lib/zabbix.ts`** — extend with typed hooks:
- `useZabbixEvents`, `useZabbixServices`, `useZabbixSLA`, `useZabbixDashboards`, `useZabbixMaps`, `useZabbixGraphs`, `useZabbixHistory`, `useZabbixTrends`, `useZabbixUsers`, `useZabbixUserGroups`, `useZabbixRoles`.
- All fall back to synced DB tables when connector returns "Unknown action".
- All use React Query with 30s refresh + error boundary friendly errors.

## Wave 1 — Incidents & SLA

- `src/pages/Incidents.tsx`: replace `getIncidentsForUser` with `useZabbixProblems` + `useZabbixEvents`. Real timeline, severity transitions, host correlation, MTTD/MTTR, ack via privileged write.
- `src/pages/SLA.tsx`: `useZabbixServices` + `useZabbixSLA`; per-service uptime, breach calc, real CSV/PDF export from live data.
- New widget `IncidentTimeline` rebuilt from real `event.get` history.

## Wave 2 — CMDB & Business Services

- `src/pages/cmdb/Assets.tsx`, `AssetDetail.tsx`, `Services.tsx`: use `useZabbixHosts` with full inventory (vendor, model, OS, location, owner, tags, groups, criticality from tag).
- New `src/pages/Services.tsx` (business services tree) using `service.get` recursive — parent/child topology, health rollup.

## Wave 3 — Dashboards, Analytics, Executive

- `src/pages/Dashboards.tsx`: list real Zabbix dashboards via `dashboard.get`; render each widget by type (graph, problems, hosts) using `graph.get` + `history.get`.
- `src/components/dashboards/PanelRenderer.tsx`: support live Zabbix item series (recharts).
- `src/pages/Executive.tsx`: KPI scorecards from real aggregates (total hosts, active problems by severity, SLA posture avg, top offenders, risk score = weighted sum of unresolved high/disaster).

## Wave 4 — Maps (real interactive world map)

- Add `leaflet` + `react-leaflet` + `leaflet.markercluster`.
- New `src/pages/Maps.tsx` with: OSM + ESRI satellite layer toggle, marker clustering, severity-colored markers, popup → host detail, layer for Zabbix topology maps via `map.get`.
- Geo source priority: `host.inventory.location_lat/lon` → `host_geo_overrides` → country geocoding fallback (offline country-centroid table bundled, no third-party calls).
- NOC wallboard mode (full-screen, auto-rotate hotspots).

## Wave 5 — IAM / Users / SSO

- `src/pages/governance/Users.tsx`: live `user.get` + `usergroup.get` + `role.get`.
- Admin CRUD via privileged write route; audit log viewer in `AuditLog.tsx` reading `zabbix_audit_log`.
- SSO abstraction layer (config UI only, documents SAML/OIDC/LDAP/Azure AD wiring — actual provider config is operational, not codeable here).

## Wave 6 — Cleanup

- Delete `src/data/mockData.ts` and `src/data/monitoringMock.ts` references; keep type-only exports if reused, otherwise remove.
- Add error boundaries + skeletons to every page.
- Verify build, lint, deno check on connector.

## Technical notes

- All Zabbix calls remain server-proxied; frontend never sees the token.
- Writes require `admin` role enforced both in connector AND in `RoleGuard` UI.
- Geocoding is offline (bundled country/city centroid JSON) — no external API calls, no key leakage.
- React Query: 30s refetchInterval for live data, 5min for static (roles, groups), `staleTime: 0` on critical alerts.
- Bundle impact: Leaflet + cluster ≈ 180KB gzipped — acceptable for an ops console.

## Out of scope (explicit)

- Real SAML/OIDC IdP integration (requires customer-side IdP setup).
- Writing back to Zabbix host configuration beyond inventory fields.
- Custom dashboard builder drag-and-drop (we render Zabbix-defined dashboards; building new ones stays as the existing PanelBuilder).

## Execution order

I'll ship Wave 0 + Wave 1 in the first batch (backend + Incidents + SLA wired live), then proceed wave-by-wave. Each wave leaves the app in a deployable state. Approve to start.
