import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://amirok196888-cloud.github.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VALID_ID = /^[A-Za-z0-9_-]{20,80}$/;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-buytest-manager-pin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

async function serviceRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("server_configuration_missing");
  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_ROLE_KEY}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    console.error("BuyTest analytics database request failed", response.status, path);
    throw new Error("database_request_failed");
  }
  return data;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function privateConfig(name: string) {
  const value = await serviceRequest("/rest/v1/rpc/buytest_get_private_config", {
    method: "POST",
    body: JSON.stringify({ p_name: name }),
  });
  return typeof value === "string" ? value : "";
}

async function isAdmin(pin: string) {
  const expected = await privateConfig("buytest_manager_pin_hash");
  return Boolean(pin) && Boolean(expected) && await sha256(pin.trim()) === expected;
}

async function trackEvent(eventType: string, visitorId: string, sessionId: string) {
  if (!['page_view', 'free_started'].includes(eventType) || !VALID_ID.test(visitorId) || !VALID_ID.test(sessionId)) {
    throw new Error("invalid_event");
  }
  await serviceRequest("/rest/v1/buytest_analytics_events?on_conflict=event_type,session_id", {
    method: "POST",
    headers: { "Prefer": "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ event_type: eventType, visitor_id: visitorId, session_id: sessionId }),
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return json(origin, { ok: false, error: "origin_not_allowed" }, 403);
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST") return json(origin, { ok: false, error: "method_not_allowed" }, 405);
  if (origin !== ALLOWED_ORIGIN) return json(origin, { ok: false, error: "origin_not_allowed" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(origin, { ok: false, error: "invalid_json" }, 400); }

  try {
    if (body.action === "track") {
      await trackEvent(String(body.eventType || ""), String(body.visitorId || ""), String(body.sessionId || ""));
      return json(origin, { ok: true });
    }
    if (body.action === "stats") {
      const pin = String(req.headers.get("x-buytest-manager-pin") || body.adminPin || "");
      if (!await isAdmin(pin)) return json(origin, { ok: false, error: "admin_denied" }, 403);
      const range = ['today', '7d', '30d', 'all'].includes(String(body.range)) ? String(body.range) : 'all';
      const stats = await serviceRequest("/rest/v1/rpc/buytest_analytics_summary", {
        method: "POST",
        body: JSON.stringify({ p_range: range }),
      });
      return json(origin, { ok: true, stats });
    }
    return json(origin, { ok: false, error: "invalid_action" }, 400);
  } catch (error) {
    console.error("BuyTest analytics error", error);
    const name = error instanceof Error ? error.message : "analytics_failed";
    return json(origin, { ok: false, error: name === "invalid_event" ? name : "analytics_failed" }, name === "invalid_event" ? 400 : 500);
  }
});
