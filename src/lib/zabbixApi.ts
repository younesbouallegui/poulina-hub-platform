// Centralised Zabbix client. All calls go through the `zabbix-proxy` edge
// function so the bearer token never reaches the browser and CORS is handled
// server-side.
import { supabase } from "@/integrations/supabase/client";

export interface ZabbixRpcError {
  code: number;
  message: string;
  data?: string;
}

export class ZabbixError extends Error {
  code?: number;
  data?: string;
  constructor(msg: string, code?: number, data?: string) {
    super(msg);
    this.code = code;
    this.data = data;
  }
}

export async function zabbixRpc<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("zabbix-proxy", {
    body: { method, params },
  });
  if (error) {
    throw new ZabbixError(error.message || "Zabbix proxy request failed");
  }
  const payload = data as { result?: T; error?: ZabbixRpcError };
  if (payload?.error) {
    throw new ZabbixError(payload.error.message, payload.error.code, payload.error.data);
  }
  return payload?.result as T;
}

// ---------- Domain helpers ----------

export type ZabbixSeverity = "0" | "1" | "2" | "3" | "4" | "5";

export interface ZabbixProblem {
  eventid: string;
  source: string;
  object: string;
  objectid: string;
  clock: string;
  ns: string;
  r_eventid?: string;
  r_clock?: string;
  name: string;
  severity: ZabbixSeverity;
  acknowledged: "0" | "1";
  suppressed?: "0" | "1";
  opdata?: string;
  tags?: { tag: string; value: string }[];
  acknowledges?: {
    acknowledgeid: string;
    userid: string;
    message: string;
    clock: string;
    action: string;
  }[];
  hosts?: { hostid: string; host: string; name: string }[];
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: "0" | "1";
  available?: string;
  interfaces?: { ip: string; dns: string; port: string; type: string }[];
  groups?: { groupid: string; name: string }[];
}

export async function getProblems(): Promise<ZabbixProblem[]> {
  return zabbixRpc<ZabbixProblem[]>("problem.get", {
    output: "extend",
    selectAcknowledges: "extend",
    selectTags: "extend",
    recent: true,
    sortfield: ["eventid"],
    sortorder: "DESC",
  });
}

export async function getTriggerHosts(triggerIds: string[]): Promise<Record<string, ZabbixHost[]>> {
  if (!triggerIds.length) return {};
  const triggers = await zabbixRpc<
    { triggerid: string; hosts: ZabbixHost[] }[]
  >("trigger.get", {
    output: ["triggerid"],
    triggerids: triggerIds,
    selectHosts: ["hostid", "host", "name", "status"],
  });
  const map: Record<string, ZabbixHost[]> = {};
  for (const t of triggers) map[t.triggerid] = t.hosts || [];
  return map;
}

export async function acknowledgeEvent(
  eventid: string,
  message = "Acknowledged via Poulina AI Hub",
): Promise<{ eventids: string[] }> {
  return zabbixRpc("event.acknowledge", {
    eventids: eventid,
    action: 6, // 2 (ack) + 4 (add message)
    message,
  });
}

export async function getApiVersion(): Promise<string> {
  return zabbixRpc<string>("apiinfo.version", {});
}
