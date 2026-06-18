// Zabbix JSON-RPC proxy. Keeps the Zabbix bearer token server-side and
// works around browser CORS by relaying requests from the edge.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface RpcBody {
  method: string;
  params?: unknown;
}

const ZBX_URL = Deno.env.get("ZABBIX_URL");
const ZBX_TOKEN = Deno.env.get("ZABBIX_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonRpcEndpoint(base: string) {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("api_jsonrpc.php")
    ? trimmed
    : `${trimmed}/api_jsonrpc.php`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ZBX_URL || !ZBX_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Zabbix is not configured (missing ZABBIX_URL or ZABBIX_TOKEN)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Require an authenticated app user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RpcBody;
    if (!body?.method || typeof body.method !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'method'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcPayload = {
      jsonrpc: "2.0",
      method: body.method,
      params: body.params ?? {},
      id: 1,
    };

    const endpoint = jsonRpcEndpoint(ZBX_URL);
    const zbxResp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-rpc",
        Authorization: `Bearer ${ZBX_TOKEN}`,
      },
      body: JSON.stringify(rpcPayload),
    });

    const text = await zbxResp.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Non-JSON response from Zabbix", status: zbxResp.status, body: text.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zabbix-proxy error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
