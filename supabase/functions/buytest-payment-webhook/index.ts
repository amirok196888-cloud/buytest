import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CARDCOM_API_URL = "https://secure.cardcom.solutions/api/v11";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
async function serviceRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("server_configuration_missing");
  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${SERVICE_ROLE_KEY}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error("database_request_failed");
  return data;
}
async function privateConfig(name: string) {
  const value = await serviceRequest("/rest/v1/rpc/buytest_get_private_config", { method: "POST", body: JSON.stringify({ p_name: name }) });
  return typeof value === "string" ? value.trim() : "";
}
async function orderById(id: string) {
  const data = await serviceRequest(`/rest/v1/buytest_orders?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" });
  return Array.isArray(data) ? data[0] : null;
}
async function updateOrder(id: string, values: Record<string, unknown>) {
  const data = await serviceRequest(`/rest/v1/buytest_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
  return Array.isArray(data) ? data[0] : null;
}
async function requestBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await req.json() as Record<string, unknown>;
  const form = await req.formData();
  return Object.fromEntries(form.entries()) as Record<string, unknown>;
}
async function cardcomResult(terminalNumber: number, apiName: string, lowProfileId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${CARDCOM_API_URL}/LowProfile/GetLpResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ TerminalNumber: terminalNumber, ApiName: apiName, LowProfileId: lowProfileId }),
      signal: controller.signal,
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    if (!response.ok) throw new Error("cardcom_http_error");
    return data;
  } finally { clearTimeout(timeout); }
}
function compactProviderPayload(result: Record<string, unknown>) {
  const transaction = result.TranzactionInfo && typeof result.TranzactionInfo === "object" ? result.TranzactionInfo as Record<string, unknown> : {};
  const documentInfo = result.DocumentInfo && typeof result.DocumentInfo === "object" ? result.DocumentInfo as Record<string, unknown> : {};
  return {
    provider: "cardcom",
    lowProfileId: String(result.LowProfileId || ""),
    transactionId: String(result.TranzactionId || ""),
    responseCode: Number(result.ResponseCode),
    transactionResponseCode: Number(transaction.ResponseCode),
    amount: Number(transaction.Amount),
    coinId: Number(transaction.CoinId),
    documentNumber: documentInfo.DocumentNumber ?? null,
    documentType: documentInfo.DocumentType ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const body = await requestBody(req);
    const lowProfileId = String(body.LowProfileId || body.lowProfileId || "");
    if (!/^[0-9a-f-]{36}$/i.test(lowProfileId)) return json({ ok: false, error: "invalid_callback" }, 400);
    const [terminalValue, apiName, enabledValue] = await Promise.all([
      privateConfig("cardcom_terminal_number"), privateConfig("cardcom_api_name"), privateConfig("cardcom_payments_enabled"),
    ]);
    const terminalNumber = Number(terminalValue);
    if (!Number.isInteger(terminalNumber) || terminalNumber <= 0 || !apiName || !/^(1|true|yes|enabled)$/i.test(enabledValue)) {
      return json({ ok: false, error: "cardcom_not_configured" }, 503);
    }
    const result = await cardcomResult(terminalNumber, apiName, lowProfileId);
    const orderId = String(result.ReturnValue || "");
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ ok: false, error: "order_not_found" }, 404);
    const order = await orderById(orderId);
    if (!order || String(order.provider_transaction_id || "").toLowerCase() !== lowProfileId.toLowerCase()) return json({ ok: false, error: "order_not_found" }, 404);
    if (order.status === "paid") return json({ ok: true, duplicate: true });
    const transaction = result.TranzactionInfo && typeof result.TranzactionInfo === "object" ? result.TranzactionInfo as Record<string, unknown> : {};
    const expectedAmount = Number(order.amount_agorot) / 100;
    const verified = Number(result.ResponseCode) === 0 &&
      String(result.LowProfileId || "").toLowerCase() === lowProfileId.toLowerCase() &&
      Number(result.TerminalNumber) === terminalNumber &&
      Number(transaction.ResponseCode) === 0 &&
      Math.abs(Number(transaction.Amount) - expectedAmount) < 0.001 &&
      Number(transaction.CoinId) === 1 &&
      !Boolean(transaction.IsRefund);
    if (!verified) return json({ ok: false, error: "payment_not_approved" }, 409);
    await updateOrder(orderId, {
      status: "paid",
      paid_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      provider_payload: compactProviderPayload(result),
    });
    return json({ ok: true });
  } catch (error) {
    console.error("BuyTest Cardcom webhook error", String(error));
    return json({ ok: false, error: "webhook_processing_failed" }, 500);
  }
});
