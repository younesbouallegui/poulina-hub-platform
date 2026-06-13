/**
 * Zabbix client — calls the secure `zabbix-connector` edge function.
 * Token never touches the browser. All reads go through the `query` action
 * (whitelisted read-only RPC methods); admin-only writes go through `call`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ZSeverity =
  | "not_classified" | "info" | "warning" | "average" | "high" | "disaster";

export interface ZHost {
  hostid: string;
  host: string;
  name: string;
  status: string;       // "0" enabled, "1" disabled
  available?: string;   // "0" unknown, "1" available, "2" unavailable
  interfaces?: Array<{ ip?: string; dns?: string; type?: string }>;
  inventory?: Record<string, string> | [];
  groups?: Array<{ groupid: string; name: string }>;
  tags?: Array<{ tag: string; value: string }>;
}

export interface ZProblem {
  eventid: string;
  objectid: string;          // triggerid
  name: string;
  severity: string;          // "0".."5"
  acknowledged: string;      // "0" | "1"
  clock: string;             // unix seconds
  opdata?: string;
  hosts?: Array<{ hostid: string; name: string; host: string }>;
  // hydrated client-side:
  hostName?: string;
}

type MonitoringHostRow = {
  id: string;
  external_id: string;
  name: string;
  hostname: string | null;
  ip_address: string | null;
  available: boolean | null;
  status: string | null;
  tags: unknown;
  raw: unknown;
};

type MonitoringAlertRow = {
  id: string;
  external_id: string;
  host_id: string | null;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  triggered_at: string;
  raw: unknown;
  monitoring_hosts?: { external_id: string; name: string; hostname: string | null } | null;
};

const SEVERITY_NAMES: Record<string, ZSeverity> = {
  "0": "not_classified",
  "1": "info",
  "2": "warning",
  "3": "average",
  "4": "high",
  "5": "disaster",
};

export const severityName = (s: string | number): ZSeverity =>
  SEVERITY_NAMES[String(s)] ?? "warning";

/** Map Zabbix severity → app's 4-tier (critical/high/medium/low). */
export const severityTier = (s: string | number): "critical" | "high" | "medium" | "low" => {
  const named = String(s).toLowerCase();
  if (named === "disaster" || named === "critical") return "critical";
  if (named === "high") return "high";
  if (named === "average" || named === "warning") return "medium";
  if (named === "info" || named === "not_classified") return "low";
  const n = typeof s === "number" ? s : parseInt(s, 10);
  if (n >= 5) return "critical";
  if (n === 4) return "high";
  if (n === 3 || n === 2) return "medium";
  return "low";
};

const severityNumber = (s?: string | null) => {
  const name = String(s ?? "warning").toLowerCase();
  if (name === "disaster" || name === "critical") return "5";
  if (name === "high") return "4";
  if (name === "average") return "3";
  if (name === "warning") return "2";
  if (name === "info") return "1";
  return "0";
};

interface QueryArgs {
  method: string;
  params?: unknown;
}

export async function zabbixQuery<T = unknown>(args: QueryArgs): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zabbix-connector", {
    body: { action: "query", ...args },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    const body = context ? await context.clone().json().catch(() => null) : null;
    throw new Error(body?.error ? `${error.message}: ${body.error}` : error.message ?? "Zabbix request failed");
  }
  if (!data?.ok) throw new Error(data?.error ?? "Zabbix returned an error");
  return data.result as T;
}

async function syncedHosts(): Promise<ZHost[]> {
  const { data, error } = await (supabase as any)
    .from("monitoring_hosts")
    .select("id, external_id, name, hostname, ip_address, available, status, tags, raw")
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MonitoringHostRow[]).map((h) => {
    const raw = (h.raw && typeof h.raw === "object" ? h.raw : {}) as Partial<ZHost>;
    return {
      hostid: h.external_id,
      host: h.hostname ?? raw.host ?? h.name,
      name: h.name,
      status: h.status === "disabled" ? "1" : "0",
      available: h.available === true ? "1" : h.available === false ? "2" : raw.available ?? "0",
      interfaces: raw.interfaces ?? [{ ip: h.ip_address ?? undefined }],
      inventory: raw.inventory ?? {},
      groups: raw.groups ?? [],
      tags: Array.isArray(h.tags) ? h.tags as ZHost["tags"] : raw.tags ?? [],
    };
  });
}

async function syncedProblems(): Promise<ZProblem[]> {
  const { data, error } = await (supabase as any)
    .from("monitoring_alerts")
    .select("id, external_id, host_id, severity, status, title, description, triggered_at, raw, monitoring_hosts(external_id, name, hostname)")
    .in("status", ["open", "acknowledged", "assigned", "escalated"])
    .order("triggered_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as MonitoringAlertRow[]).map((a) => {
    const raw = (a.raw && typeof a.raw === "object" ? a.raw : {}) as Partial<ZProblem>;
    const host = a.monitoring_hosts;
    const clock = raw.clock ?? String(Math.floor(new Date(a.triggered_at).getTime() / 1000));
    return {
      ...raw,
      eventid: a.external_id,
      objectid: raw.objectid ?? a.id,
      name: a.title,
      severity: raw.severity ?? severityNumber(a.severity),
      acknowledged: a.status === "acknowledged" ? "1" : "0",
      clock,
      opdata: a.description ?? raw.opdata,
      hosts: host ? [{ hostid: host.external_id, name: host.name, host: host.hostname ?? host.name }] : raw.hosts ?? [],
      hostName: host?.name ?? raw.hostName ?? "—",
    };
  });
}

// ---------- Hooks ----------

export function useZabbixVersion() {
  return useQuery({
    queryKey: ["zabbix", "version"],
    queryFn: () => zabbixQuery<string>({ method: "apiinfo.version" }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useZabbixHosts() {
  return useQuery<ZHost[]>({
    queryKey: ["zabbix", "hosts"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZHost[]>({
          method: "host.get",
          params: {
            output: ["hostid", "host", "name", "status", "available"],
            selectInterfaces: ["ip", "dns", "type"],
            selectGroups: ["groupid", "name"],
            selectTags: "extend",
            selectInventory: ["location", "location_lat", "location_lon", "os", "type", "vendor", "model"],
            sortfield: "name",
            limit: 500,
          },
        });
      } catch (e) {
        console.warn("[zabbix] hosts live query failed, using synced data:", e);
        return syncedHosts();
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useZabbixProblems() {
  return useQuery({
    queryKey: ["zabbix", "problems"],
    queryFn: async () => {
      let problems: ZProblem[];
      try {
        problems = await zabbixQuery<ZProblem[]>({
          method: "problem.get",
          params: {
            output: "extend",
            recent: false,
            sortfield: ["eventid"],
            sortorder: "DESC",
            limit: 200,
          },
        });
      } catch (e) {
        console.warn("[zabbix] problems live query failed, using synced data:", e);
        return syncedProblems();
      }
      // Hydrate host names via trigger.get
      const triggerIds = Array.from(new Set(problems.map((p) => p.objectid).filter(Boolean)));
      if (triggerIds.length === 0) return problems;
      const triggers = await zabbixQuery<Array<{ triggerid: string; hosts: Array<{ hostid: string; name: string; host: string }> }>>({
        method: "trigger.get",
        params: { triggerids: triggerIds, selectHosts: ["hostid", "name", "host"], output: ["triggerid"] },
      });
      const map = new Map(triggers.map((t) => [t.triggerid, t.hosts?.[0]]));
      return problems.map((p) => {
        const h = map.get(p.objectid);
        return { ...p, hosts: h ? [h] : [], hostName: h?.name ?? h?.host ?? "—" };
      });
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}

// ---------- Events / Incident timeline ----------

export interface ZEvent {
  eventid: string;
  source: string;
  object: string;
  objectid: string;
  clock: string;        // unix seconds
  ns?: string;
  value: string;        // "0" recovered, "1" problem
  acknowledged?: string;
  name?: string;
  severity?: string;
  hosts?: Array<{ hostid: string; name: string; host: string }>;
  acknowledges?: Array<{ acknowledgeid: string; userid: string; message: string; clock: string; action?: string }>;
  r_eventid?: string;
}

export function useZabbixEvents(opts?: { triggerIds?: string[]; limit?: number; timeFrom?: number }) {
  const { triggerIds, limit = 200, timeFrom } = opts ?? {};
  return useQuery<ZEvent[]>({
    queryKey: ["zabbix", "events", triggerIds?.join(",") ?? "all", limit, timeFrom ?? 0],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        output: "extend",
        select_acknowledges: "extend",
        selectHosts: ["hostid", "name", "host"],
        sortfield: ["clock", "eventid"],
        sortorder: "DESC",
        value: 1,
        limit,
      };
      if (triggerIds?.length) params.objectids = triggerIds;
      if (timeFrom) params.time_from = timeFrom;
      try {
        return await zabbixQuery<ZEvent[]>({ method: "event.get", params });
      } catch {
        return [];
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export async function zabbixWrite<T = unknown>(method: string, params: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zabbix-connector", {
    body: { action: "write", method, params },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.clone().json().catch(() => null) : null;
    throw new Error(body?.error ? `${error.message}: ${body.error}` : error.message ?? "Zabbix write failed");
  }
  if (!data?.ok) throw new Error(data?.error ?? "Zabbix returned an error");
  return data.result as T;
}

export const acknowledgeEvent = (eventId: string, message: string) =>
  zabbixWrite("event.acknowledge", { eventids: eventId, action: 6, message });

// ---------- Business services / SLA ----------

export interface ZService {
  serviceid: string;
  name: string;
  status: string;
  algorithm?: string;
  sortorder?: string;
  description?: string;
  parents?: Array<{ serviceid: string }>;
  children?: Array<{ serviceid: string; name?: string }>;
  problem_tags?: Array<{ tag: string; value: string }>;
}

export function useZabbixServices() {
  return useQuery<ZService[]>({
    queryKey: ["zabbix", "services"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZService[]>({
          method: "service.get",
          params: {
            output: "extend",
            selectParents: ["serviceid"],
            selectChildren: ["serviceid", "name"],
            selectProblemTags: "extend",
          },
        });
      } catch {
        return [];
      }
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    retry: 1,
  });
}

export interface ZSLA {
  slaid: string;
  name: string;
  period: string;
  slo: string;
  status: string;
}

export function useZabbixSLAs() {
  return useQuery<ZSLA[]>({
    queryKey: ["zabbix", "slas"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZSLA[]>({ method: "sla.get", params: { output: "extend" } });
      } catch {
        return [];
      }
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------- Dashboards / Maps ----------

export interface ZDashboard {
  dashboardid: string;
  name: string;
  display_period?: string;
  pages?: Array<{ name?: string; widgets?: Array<{ type: string; name?: string; x: number; y: number; width: number; height: number; fields?: unknown[] }> }>;
}

export function useZabbixDashboards() {
  return useQuery<ZDashboard[]>({
    queryKey: ["zabbix", "dashboards"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZDashboard[]>({
          method: "dashboard.get",
          params: { output: "extend", selectPages: "extend" },
        });
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export interface ZMap {
  sysmapid: string;
  name: string;
  width?: string;
  height?: string;
  selements?: Array<{ selementid: string; label?: string; elementtype?: string; x?: string; y?: string; elements?: Array<{ hostid?: string }> }>;
  links?: Array<{ linkid: string; selementid1: string; selementid2: string; color?: string }>;
}

export function useZabbixMaps() {
  return useQuery<ZMap[]>({
    queryKey: ["zabbix", "maps"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZMap[]>({
          method: "map.get",
          params: { output: "extend", selectSelements: "extend", selectLinks: "extend" },
        });
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

// ---------- Users / IAM ----------

export interface ZUser {
  userid: string;
  username: string;
  name?: string;
  surname?: string;
  roleid?: string;
  url?: string;
  autologin?: string;
  usrgrps?: Array<{ usrgrpid: string; name?: string }>;
}
export interface ZUserGroup { usrgrpid: string; name: string; users_status?: string; gui_access?: string; }
export interface ZRole { roleid: string; name: string; type?: string; readonly?: string; }

export function useZabbixUsers() {
  return useQuery<ZUser[]>({
    queryKey: ["zabbix", "users"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZUser[]>({
          method: "user.get",
          params: { output: "extend", selectUsrgrps: ["usrgrpid", "name"] },
        });
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useZabbixUserGroups() {
  return useQuery<ZUserGroup[]>({
    queryKey: ["zabbix", "usergroups"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZUserGroup[]>({ method: "usergroup.get", params: { output: "extend" } });
      } catch {
        return [];
      }
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useZabbixRoles() {
  return useQuery<ZRole[]>({
    queryKey: ["zabbix", "roles"],
    queryFn: async () => {
      try {
        return await zabbixQuery<ZRole[]>({ method: "role.get", params: { output: "extend" } });
      } catch {
        return [];
      }
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

// ---------- Helpers ----------

export const severityColor = (s: string | number): string => {
  const t = severityTier(s);
  if (t === "critical") return "#dc2626";
  if (t === "high") return "#ea580c";
  if (t === "medium") return "#eab308";
  return "#22c55e";
};

/** Resolve a host's lat/lon from inventory or fallback country centroid. */
export function hostCoords(h: ZHost): { lat: number; lon: number } | null {
  const inv = (h.inventory && !Array.isArray(h.inventory) ? h.inventory : {}) as Record<string, string>;
  const lat = parseFloat(inv.location_lat ?? "");
  const lon = parseFloat(inv.location_lon ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) return { lat, lon };
  // Country centroid fallback by tag value `country` or inventory location.
  const country = (h.tags?.find((t) => t.tag.toLowerCase() === "country")?.value ?? "").toLowerCase();
  const loc = (inv.location ?? "").toLowerCase();
  const key = country || loc;
  for (const [name, c] of Object.entries(COUNTRY_CENTROIDS)) {
    if (key.includes(name)) return c;
  }
  return null;
}

// Compact built-in country centroid table for offline geocoding fallback.
export const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  tunisia: { lat: 33.89, lon: 9.54 },
  tunis: { lat: 36.81, lon: 10.18 },
  france: { lat: 46.23, lon: 2.21 },
  paris: { lat: 48.85, lon: 2.35 },
  germany: { lat: 51.17, lon: 10.45 },
  berlin: { lat: 52.52, lon: 13.40 },
  "united kingdom": { lat: 55.38, lon: -3.43 },
  uk: { lat: 55.38, lon: -3.43 },
  london: { lat: 51.51, lon: -0.13 },
  "united states": { lat: 39.83, lon: -98.58 },
  usa: { lat: 39.83, lon: -98.58 },
  spain: { lat: 40.46, lon: -3.74 },
  italy: { lat: 41.87, lon: 12.57 },
  morocco: { lat: 31.79, lon: -7.09 },
  algeria: { lat: 28.03, lon: 1.66 },
  egypt: { lat: 26.82, lon: 30.80 },
  "saudi arabia": { lat: 23.89, lon: 45.08 },
  uae: { lat: 23.42, lon: 53.85 },
  india: { lat: 20.59, lon: 78.96 },
  china: { lat: 35.86, lon: 104.20 },
  japan: { lat: 36.20, lon: 138.25 },
  brazil: { lat: -14.24, lon: -51.93 },
  canada: { lat: 56.13, lon: -106.35 },
  australia: { lat: -25.27, lon: 133.78 },
  netherlands: { lat: 52.13, lon: 5.29 },
  sweden: { lat: 60.13, lon: 18.64 },
  ireland: { lat: 53.41, lon: -8.24 },
  singapore: { lat: 1.35, lon: 103.82 },
};

