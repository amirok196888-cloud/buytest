import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BALCAR_BASE = "https://api.balcar.co.il/api/biz/v1";
const BALCAR_SERVICE_ID = 207;
const BALCAR_API_KEY = Deno.env.get("BALCAR_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ADMIN_PIN_HASH = "46a30a10bf067f6c3bede12312c987e43ec06920de6cbbe15617079c1f19ab10";
const ALLOWED_ORIGIN = "https://amirok196888-cloud.github.io";

function responseHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}
function cleanPlate(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((item) => item.toString(16).padStart(2, "0")).join("");
}
async function hashesMatch(first: string, second: string) {
  const a = new TextEncoder().encode(first), b = new TextEncoder().encode(second);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}
async function isAdmin(pin: unknown) {
  const value = String(pin ?? "").trim();
  return value.length > 0 && (await sha256(value)) === ADMIN_PIN_HASH;
}
function newCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return `BT-${String(100000 + (value[0] % 900000))}`;
}
async function balcarRaw(path: string, init: RequestInit = {}) {
  if (!BALCAR_API_KEY) return { status: 503, data: { error: { code: "balcar_not_configured" } } };
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", BALCAR_API_KEY);
  headers.set("Content-Type", "application/json");
  const response = await fetch(BALCAR_BASE + path, { ...init, headers });
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }
  return { status: response.status, data };
}
async function proxy(origin: string | null, path: string, init: RequestInit = {}) {
  const result = await balcarRaw(path, init);
  return json(origin, result.data, result.status);
}
async function authorize(code: string, plate: string) {
  const { data, error } = await admin.rpc("authorize_buytest_access_code", { p_code: code, p_plate: plate });
  if (error) throw error;
  return data;
}
async function orderById(id: string) {
  const { data, error } = await admin.from("buytest_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function paidBalcarOrder(body: Record<string, unknown>, plate: string) {
  const orderId = String(body.orderId || "");
  const clientSecret = String(body.clientSecret || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || clientSecret.length < 30) return null;
  const order = await orderById(orderId);
  if (!order || !(await hashesMatch(String(order.client_secret_hash || ""), await sha256(clientSecret)))) return null;
  const expiresAt = new Date(String(order.expires_at)).getTime();
  if (String(order.status) !== "paid" || String(order.plan) !== "balcar" || cleanPlate(order.plate) !== plate || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return order;
}
async function rememberReport(order: Record<string, unknown>, reportId: unknown, externalRef: string) {
  if (!reportId) return;
  const providerPayload = recordValue(order.provider_payload);
  const { error } = await admin.from("buytest_orders").update({
    provider_payload: { ...providerPayload, balcarReportId: String(reportId), balcarExternalRef: externalRef },
    updated_at: new Date().toISOString(),
  }).eq("id", String(order.id));
  if (error) console.warn("Unable to persist Balcar report id", error.message);
}
function reportIdFrom(value: unknown) {
  const data = recordValue(value);
  return String(data.reportId || data.id || "").trim();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (req.method !== "POST") return json(origin, { error: { code: "method_not_allowed" } }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(origin, { error: { code: "invalid_json" } }, 400); }
  const action = String(body.action || "");

  try {
    if (action === "health") return json(origin, { ok: true, balcarConfigured: Boolean(BALCAR_API_KEY), orderingEnabled: true, paidOrderingEnabled: true, serviceId: BALCAR_SERVICE_ID });
    if (action === "products") return proxy(origin, "/products");
    if (action === "eligibility") {
      const plate = cleanPlate(body.plate), serviceId = Number(body.serviceId || BALCAR_SERVICE_ID);
      if (!/^\d{7,8}$/.test(plate) || serviceId !== BALCAR_SERVICE_ID) return json(origin, { error: { code: "validation_failed" } }, 400);
      return proxy(origin, `/vehicles/${encodeURIComponent(plate)}/eligibility?serviceId=${BALCAR_SERVICE_ID}`);
    }

    if (action === "createPaid" || action === "statusPaid") {
      const plate = cleanPlate(body.plate);
      if (!/^\d{7,8}$/.test(plate)) return json(origin, { error: { code: "validation_failed" } }, 400);
      const order = await paidBalcarOrder(body, plate);
      if (!order) return json(origin, { error: { code: "paid_access_required" } }, 403);
      const providerPayload = recordValue(order.provider_payload);
      const savedReportId = String(providerPayload.balcarReportId || "").trim();
      const externalRef = String(providerPayload.balcarExternalRef || `buytest-balcar-${order.id}`).slice(0, 55);

      if (savedReportId) {
        const result = await balcarRaw(`/reports/${encodeURIComponent(savedReportId)}`);
        return json(origin, result.data, result.status);
      }

      const existing = await balcarRaw(`/reports/by-ref?externalRef=${encodeURIComponent(externalRef)}`);
      if (existing.status >= 200 && existing.status < 300 && reportIdFrom(existing.data)) {
        await rememberReport(order, reportIdFrom(existing.data), externalRef);
        return json(origin, existing.data, existing.status);
      }
      if (action === "statusPaid") return json(origin, { error: { code: "report_not_created" } }, 404);

      const eligibility = await balcarRaw(`/vehicles/${encodeURIComponent(plate)}/eligibility?serviceId=${BALCAR_SERVICE_ID}`);
      if (eligibility.status < 200 || eligibility.status >= 300) return json(origin, eligibility.data, eligibility.status);
      if (recordValue(eligibility.data).requiresSellerDetails === true) {
        return json(origin, { error: { code: "seller_details_required" } }, 422);
      }

      const result = await balcarRaw("/reports", {
        method: "POST",
        body: JSON.stringify({ serviceId: BALCAR_SERVICE_ID, plate, externalRef }),
      });
      if (result.status >= 200 && result.status < 300) {
        await rememberReport(order, reportIdFrom(result.data), externalRef);
        return json(origin, result.data, result.status);
      }
      if (result.status === 409) {
        const duplicate = await balcarRaw(`/reports/by-ref?externalRef=${encodeURIComponent(externalRef)}`);
        if (duplicate.status >= 200 && duplicate.status < 300) {
          await rememberReport(order, reportIdFrom(duplicate.data), externalRef);
          return json(origin, duplicate.data, duplicate.status);
        }
      }
      return json(origin, result.data, result.status);
    }

    // Legacy access-code actions remain available for already issued codes.
    if (action === "status") {
      const reportId = String(body.reportId || "").trim();
      if (!reportId) return json(origin, { error: { code: "validation_failed" } }, 400);
      return proxy(origin, `/reports/${encodeURIComponent(reportId)}`);
    }
    if (action === "authorizeAccess") {
      const plate = cleanPlate(body.plate), code = String(body.accessCode || "");
      const result = await authorize(code, plate);
      return json(origin, result, result?.ok ? 200 : 403);
    }
    if (action === "create") {
      const plate = cleanPlate(body.plate), serviceId = Number(body.serviceId), accessCode = String(body.accessCode || "");
      if (!/^\d{7,8}$/.test(plate) || serviceId !== BALCAR_SERVICE_ID) return json(origin, { error: { code: "validation_failed" } }, 400);
      const access = await authorize(accessCode, plate);
      if (!access?.ok) return json(origin, { error: { code: "access_denied", reason: access?.reason } }, 403);
      const externalRef = String(body.externalRef || `buytest-${access.accessId}-${plate}`).slice(0, 55);
      const payload: Record<string, unknown> = { serviceId, plate, externalRef };
      if (body.ownershipDate) payload.ownershipDate = String(body.ownershipDate);
      if (body.ownerIsraeliId) payload.ownerIsraeliId = String(body.ownerIsraeliId).replace(/\D/g, "");
      if (body.mileage != null) payload.mileage = Number(body.mileage);
      if (body.hand != null) payload.hand = String(body.hand);
      const result = await balcarRaw("/reports", { method: "POST", body: JSON.stringify(payload) });
      if (result.status >= 200 && result.status < 300) await admin.rpc("complete_buytest_access_code", { p_access_id: access.accessId, p_plate: plate });
      return json(origin, result.data, result.status);
    }

    if (action === "adminCreateCode") {
      if (!(await isAdmin(body.adminPin))) return json(origin, { ok: false, error: { code: "admin_denied" } }, 403);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode(), codeHash = await sha256(code.toUpperCase());
        const { data, error } = await admin.from("buytest_access_codes").insert({ code_hash: codeHash, code_value: code }).select("id,sequence_no,created_at").single();
        if (!error) return json(origin, { ok: true, code, id: data.id, sequenceNo: data.sequence_no, createdAt: data.created_at });
        if (error.code !== "23505") return json(origin, { ok: false, error: { code: "create_code_failed" } }, 500);
      }
      return json(origin, { ok: false, error: { code: "code_collision" } }, 500);
    }
    if (action === "adminListCodes") {
      if (!(await isAdmin(body.adminPin))) return json(origin, { ok: false, error: { code: "admin_denied" } }, 403);
      const { data, error } = await admin.from("buytest_access_codes").select("id,sequence_no,code_value,claimed_plate,claimed_at,completed_at,revoked,created_at").order("created_at", { ascending: false }).limit(50);
      return error ? json(origin, { ok: false, error: { code: "list_failed" } }, 500) : json(origin, { ok: true, codes: data });
    }
    if (action === "adminRevokeCode") {
      if (!(await isAdmin(body.adminPin))) return json(origin, { ok: false, error: { code: "admin_denied" } }, 403);
      const { error } = await admin.from("buytest_access_codes").update({ revoked: true }).eq("id", String(body.id || ""));
      return error ? json(origin, { ok: false, error: { code: "revoke_failed" } }, 500) : json(origin, { ok: true });
    }
    return json(origin, { error: { code: "unknown_action" } }, 400);
  } catch (error) {
    console.error("Balcar function error", String(error));
    return json(origin, { error: { code: "balcar_service_error" } }, 500);
  }
});
