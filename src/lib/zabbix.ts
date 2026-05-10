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
  const n = typeof s === "number" ? s : parseInt(s, 10);
  if (n >= 5) return "critical";
  if (n === 4) return "high";
  if (n === 3 || n === 2) return "medium";
  return "low";
};

interface QueryArgs {
  method: string;
  params?: unknown;
}

export async function zabbixQuery<T = unknown>(args: QueryArgs): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zabbix-connector", {
    body: { action: "query", ...args },
  });
  if (error) throw new Error(error.message ?? "Zabbix request failed");
  if (!data?.ok) throw new Error(data?.error ?? "Zabbix returned an error");
  return data.result as T;
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
    queryFn: () =>
      zabbixQuery<ZHost[]>({
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
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useZabbixProblems() {
  return useQuery({
    queryKey: ["zabbix", "problems"],
    queryFn: async () => {
      const problems = await zabbixQuery<ZProblem[]>({
        method: "problem.get",
        params: {
          output: "extend",
          recent: false,
          sortfield: ["eventid"],
          sortorder: "DESC",
          limit: 200,
        },
      });
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
