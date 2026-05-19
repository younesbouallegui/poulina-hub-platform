## Phase 3 — Enterprise Application Monitoring Platform

This is a very large scope (a full APM + CMDB + topology + executive layer on top of the existing Zabbix UI). To ship it cleanly without breaking what already works, I'll build it **frontend-first on a typed mock data layer**, then we can wire each module to Lovable Cloud / Zabbix in follow-up phases.

### Approach

- All new code lives under a new `applications/` domain (types, mock store, hooks, pages, components) — does **not** touch existing Incidents / Infrastructure / Dashboards.
- A single in-memory store (`useApplicationsStore`) with React Query hooks simulates real-time updates (poll + jitter). Easy to swap for Cloud later.
- New routes added to `App.tsx`, new sidebar group "Applications".

### Deliverables (this phase)

**1. Data model** (`src/types/applications.ts`)
- `Application`, `AppService`, `AppComponent`, `AppJob`, `AppAPIEndpoint`, `AppDatabase`, `AppLogEntry`, `AppDependency`, `AppAlertRule`, `AppIncidentLink`
- Enums: env (prod/uat/dev), type (web/api/db/batch/worker/scheduler/middleware/k8s/vm), criticality tier (T0–T3), status (healthy/warning/degraded/critical/unknown)
- Monitoring scope flags (the ~20 checkboxes from spec)

**2. Mock data + store** (`src/data/applicationsMock.ts`, `src/stores/applications.ts`)
- ~12 realistic applications across the existing HOSTS (SAP ERP, Billing API, Customer Portal, PostgreSQL Cluster, HR Platform, Auth Service, etc.)
- Live-updating metrics (health/SLA/error rate/latency) via React Query with refetch interval
- CRUD via Zustand-style store

**3. Routes & pages**
- `/applications` — **Application Command Dashboard**: KPI strip, status grid (sortable table + card view toggle), heatmap, top failing / noisy / business-critical panels, filters (env, criticality, dept, region, status), search, fullscreen NOC mode, export CSV.
- `/applications/registry` — **Application Registry / CMDB**: list + create/edit dialog (multi-step: identity → ownership → servers → monitoring scope → SLA → tags/deps).
- `/applications/:id` — **Application Detail Cockpit** with tabs: Overview, Logs, Database, Jobs, API, Infrastructure, Incidents, Dependencies, Alerts, Settings.
- `/applications/topology` — **Service Map**: interactive SVG/Canvas graph (force layout) showing apps ↔ servers ↔ DBs ↔ APIs, blast-radius highlight on hover, severity coloring.
- `/applications/alerts` — alert rule manager (rule list, create/edit, notification channels: Email/Slack/Teams/Webhook/Zabbix).

**4. Executive integration**
- Add **"Application Operations Center"** section to `/executive`: total apps, healthy/degraded/critical donut, business-critical KPI tiles, global app SLA gauge, risk score, availability heatmap by region, top-5 risk list.

**5. Navigation & RBAC**
- Sidebar: new "Applications" group (Command, Registry, Topology, Alerts).
- `RoleGuard` on Registry write actions and Alerts (admin/operator).
- Audit log entries emitted via existing governance audit hook for create/update/delete.

**6. UX polish**
- Real-time status pulses (animated dot), severity color tokens added to `index.css` (`--status-healthy/warning/degraded/critical`).
- Dark/light themed via existing `ThemeContext`.
- Responsive, keyboard-navigable, drill-down everywhere (app row → detail; topology node → detail).

### What's explicitly deferred (call out so we agree)

- Real Zabbix item/trigger ingestion → still uses existing `zabbix-connector` shape; we'll wire the actual pull in Phase 3.5.
- OpenTelemetry / Prometheus / Loki / Tempo / Jaeger ingestion.
- WebSocket transport (we simulate with React Query polling now; swap to Supabase Realtime later).
- Persisting the registry to Postgres (currently in-memory + localStorage). I'll add the Cloud-backed schema + RLS in the immediately-following turn once you approve this UI plan.

### Technical notes

```text
src/
  types/applications.ts
  data/applicationsMock.ts
  stores/applications.ts                (zustand + persist)
  hooks/useApplications.ts              (RQ wrappers, polling)
  pages/applications/
    Command.tsx
    Registry.tsx
    Detail.tsx
    Topology.tsx
    Alerts.tsx
  components/applications/
    AppStatusBadge.tsx
    AppHealthScore.tsx
    AppGrid.tsx
    AppFilters.tsx
    AppHeatmap.tsx
    AppCreateDialog.tsx
    MonitoringScopeForm.tsx
    TopologyGraph.tsx
    detail/{Overview,Logs,Database,Jobs,Api,Infra,Incidents,Dependencies,Alerts}Tab.tsx
  components/executive/AppOpsCenter.tsx
```

### Confirm before I build

1. Frontend-first with mock store now, Cloud-backed schema + RLS in the very next step — OK?
2. Should the Topology graph use a lightweight custom SVG force layout (zero deps, fast), or do you want me to add `reactflow` / `cytoscape`?
3. Any apps/servers I should seed besides the obvious (SAP ERP, Billing API, Customer Portal, PostgreSQL, HR, Auth)?
