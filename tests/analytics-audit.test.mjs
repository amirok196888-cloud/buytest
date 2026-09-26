import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Run from any directory: node --test tests/analytics-audit.test.mjs
// No network, payment, WhatsApp, production writes, clock, or random fixtures.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(root + p, 'utf8');
const html = read('index.html');
const packageJS = read('package-149.js');
const edge = read('supabase/functions/buytest-analytics/index.ts');
const migrationFiles = readdirSync(root + 'supabase/migrations').filter(p => p.endsWith('.sql')).sort();
const migrations = migrationFiles.map(p => read('supabase/migrations/' + p)).join('\n');
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, 'Missing source anchor: ' + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, 'Missing source end anchor: ' + end);
  return source.slice(from, to);
}
const labels = vm.runInNewContext('(' + between(html, 'const BUYTEST_CLICK_LABELS=', 'function trackBuyTestClick').replace('const BUYTEST_CLICK_LABELS=', '').trim().replace(/;$/, '') + ')');
const clickSource = between(html, 'function trackBuyTestClick(', 'const BUYTEST_SOURCE_LABELS=');
const trackSource = between(html, 'async function trackBuyTestEvent(', 'const BUYTEST_CLICK_LABELS=');
const allowed = [...between(edge, 'const CLICK_EVENT_TYPES', 'function cors').matchAll(/"((?:click_|page_|blog_|free_|consultation_)[a-z_]+)"/g)].map(m => m[1]);
function tags(source) {
  return [...source.matchAll(/<(button|a)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g)].map(m => {
    const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(a => [a[1], a[2] ?? a[3]]));
    return { tag: m[1], ...attrs };
  });
}
const controls = tags(html);
const byClick = action => controls.filter(c => c.onclick === action);

function tracker(search = '', managerMode = false) {
  const calls = [], listeners = [];
  class Element {
    constructor(target) { this.target = target; }
    closest() { return this.target; }
  }
  const context = vm.createContext({
    Element, URLSearchParams, location: { search }, console: { warn() {} },
    document: { body: { classList: { contains: () => managerMode } }, addEventListener: (...args) => listeners.push(args) },
    buyTestAnalyticsIdentity: () => ({ visitorId: 'visitor_00000000000001', sessionId: 'session_00000000000001' }),
    buyTestTrafficAttribution: () => ({ trafficSource: 'google', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'audit' }),
    plate: () => '12345678', callBuyTestAnalyticsService: async body => { calls.push(body); }
  });
  vm.runInContext(trackSource + '\n' + clickSource, context);
  return { calls, listeners, context, click(c, disabled = false) {
    const target = c ? { dataset: { analyticsClick: c['data-analytics-click'] }, disabled } : null;
    context.trackBuyTestClick({ target: new Element(target) });
  } };
}

for (const [action, expected] of [
  ["openInspectionRoute('before')", 'click_before_route'],
  ["openInspectionRoute('after')", 'click_after_route'],
  ["startPayment('report_consultation')", 'click_report_consultation_plan'],
  ['startBalcarPayment()', 'click_insurance_history'],
  ['startFreeCheckFromLanding()', 'click_landing_free'],
  ["startPayment('report')", 'click_report_plan'],
  ["startPayment('consultation')", 'click_consultation_plan'],
  ['copyPreVisitQuestions(this)', 'click_copy_questions'],
  ["document.getElementById('examinerSummaryFile').click()", 'click_report_upload'],
  ['analyseInspectionReport()', 'click_analyze'],
  ["shareReportPdf('finalPdfBtn')", 'click_report_pdf'],
  ["shareReportPdf('balcarPdfBtn')", 'click_balcar_pdf'],
  ['openPrebuyWhatsApp()', 'click_prebuy_whatsapp'],
  ['openPostReportWhatsApp()', 'click_post_report_whatsapp']
]) {
  test('existing control dispatches exactly once: ' + action, () => {
    const found = byClick(action);
    assert.ok(found.length, 'Control must remain discoverable');
    for (const c of found) {
      assert.equal(c['data-analytics-click'], expected);
      const t = tracker(); t.click(c);
      assert.equal(t.calls.length, 1);
      assert.equal(t.calls[0].eventType, expected);
      assert.equal(t.calls[0].sessionId, 'session_00000000000001');
      assert.equal(t.calls[0].trafficSource, 'google');
      assert.equal(t.calls[0].vehiclePlate, '12345678');
      assert.ok(labels[expected], 'Hebrew manager label');
      assert.ok(allowed.includes(expected), 'Edge allowlist');
    }
  });
}
test('capture-phase delegation handles nested targets, disabled controls and unrelated clicks', () => {
  const t = tracker();
  assert.equal(t.listeners.length, 1);
  assert.equal(t.listeners[0][0], 'click');
  assert.equal(t.listeners[0][2], true);
  t.click({ 'data-analytics-click': 'click_after_route' }, true);
  t.click(null);
  t.context.trackBuyTestClick({ target: {} });
  assert.equal(t.calls.length, 0);
});
test('tracking failures never prevent the customer action', async () => {
  const t = tracker();
  t.context.callBuyTestAnalyticsService = async () => { throw Error('offline'); };
  await assert.doesNotReject(t.context.trackBuyTestEvent('click_before_route'));
});
for (const search of ['?manager=1', '?admin=1', '?mode=manager']) {
  test('manager entry must not emit customer events: ' + search, () => {
    const t = tracker(search); t.click({ 'data-analytics-click': 'click_before_route' });
    assert.equal(t.calls.length, 0);
  });
}
test('authenticated manager preview is excluded', () => {
  const t = tracker('', true); t.click({ 'data-analytics-click': 'click_after_route' });
  assert.equal(t.calls.length, 0);
});

// Missing instrumentation is intentionally asserted as a failure, not skipped or
// blessed as expected behavior. These are audit regression gates for a follow-up.
for (const action of [
  'continueToFreeFlow()', 'showLicenseFlow()', 'openAfterPage()',
  'loadAfterPageVehicle()', 'closeInspectionRoutes()', 'closeAfterPage()',
  'returnToVehicle()', 'retryPaidBalcarWithDetails()',
  "document.getElementById('computerTestFile').click()",
  "clearInspectionFile('summary')", "clearInspectionFile('computer')",
  "document.getElementById('consultationVehiclePhotos').click()",
  'event.preventDefault();openGeneralBuyTestWhatsApp()', 'closeBuyTestPayment()'
]) {
  test('customer flow control has a labeled, accepted event: ' + action, () => {
    const found = byClick(action);
    assert.ok(found.length, 'Control exists');
    for (const c of found) {
      const event = c['data-analytics-click'];
      assert.ok(event, 'Missing data-analytics-click for ' + action);
      assert.ok(labels[event], 'Missing manager label: ' + event);
      assert.ok(allowed.includes(event), 'Missing edge allowlist: ' + event);
      const t = tracker(); t.click(c); assert.equal(t.calls.length, 1);
    }
  });
}
for (const id of ['paymentSubmitButton', 'balcarOriginalReport']) {
  test('customer action has instrumentation: #' + id, () => {
    const c = controls.find(c => c.id === id);
    assert.ok(c); assert.ok(c['data-analytics-click'], 'Missing event: ' + id);
  });
}
for (const [name, predicate] of [
  ['back to services', c => c.class === 'appBackHome'],
  ['dynamic insurance retry', c => c.onclick === 'loadPaidBalcarReport()'],
  ['dynamic photo removal', c => c.onclick?.startsWith('vehiclePhotoData.splice(')]
]) {
  test('additional customer action has instrumentation: ' + name, () => {
    const found = controls.filter(predicate);
    assert.ok(found.length, 'Control exists');
    for (const c of found) assert.ok(c['data-analytics-click'], 'Missing event: ' + name);
  });
}
test('all tagged events have Hebrew manager labels and edge acceptance', () => {
  for (const c of [...controls, ...tags(packageJS)].filter(c => c['data-analytics-click'])) {
    assert.ok(labels[c['data-analytics-click']], c['data-analytics-click']);
    assert.ok(allowed.includes(c['data-analytics-click']), c['data-analytics-click']);
  }
});
test('after-route vehicle confirmation does not become a before-route free start', async () => {
  const starts = [], elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: '12345678', textContent: '', setCustomValidity() {}, reportValidity() {} });
    return elements.get(id);
  };
  let route = 'after';
  const context = vm.createContext({ document: { getElementById: el },
    setCustomerRoute: value => { route = value; },
    // Mirrors loadVehicle's actual free_started guard after successful lookup.
    loadVehicle: async () => { if (route === 'free') starts.push('free_started'); }, openAfterPage() {}
  });
  assert.match(html, /if\(customerEntryRoute==='free'[^\n]*\)\{\s*void trackBuyTestEvent\('free_started'\)/);
  vm.runInContext(between(html, 'async function loadAfterPageVehicle()', 'function openInspectionRoute('), context);
  await context.loadAfterPageVehicle();
  assert.deepEqual(starts, [], 'After-route lookup pollutes the free-start denominator');
});

test('migration replay accepts every event accepted by the edge function', () => {
  const checks = [...migrations.matchAll(/add constraint buytest_analytics_events_event_type_check\s+check\s*\(event_type in\s*\(([\s\S]*?)\)\)/g)];
  assert.ok(checks.length);
  const last = checks.at(-1)[1];
  const events = [...last.matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(allowed.filter(e => !events.includes(e)), [], 'Standalone setup SQL is not part of migration replay');
});
test('a checked-in deployment path executes the analytics database change', () => {
  const dir = root + '.github/workflows';
  const workflows = existsSync(dir) ? readdirSync(dir).filter(p => /\.ya?ml$/.test(p)).map(p => read('.github/workflows/' + p)).join('\n') : '';
  assert.match(workflows, /supabase\s+db\s+push|psql[\s\S]*analytics|scripts\/deploy-analytics/, 'Pages build alone never runs SQL; require an explicit database deployment gate');
});

const sourceLabels = between(html, 'const BUYTEST_SOURCE_LABELS=', 'function renderBuyTestSourceAnalytics(');
const renderClicks = between(html, 'function renderBuyTestClickAnalytics(', 'function renderBuyTestBlogAnalytics(');
function render(rows) {
  const body = { innerHTML: '' };
  const context = vm.createContext({ document: { getElementById: () => body }, BUYTEST_CLICK_LABELS: labels,
    escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) });
  vm.runInContext(sourceLabels + renderClicks, context);
  context.renderBuyTestClickAnalytics(rows); return body.innerHTML;
}
test('manager labels current events and safely renders campaign values', () => {
  const out = render([{ eventType: 'click_report_consultation_plan', clicks: 2, source: 'google', utmCampaign: '<img onerror=bad>' }]);
  assert.ok(out.includes(labels.click_report_consultation_plan));
  assert.ok(out.includes('&lt;img onerror=bad&gt;'));
  assert.ok(!out.includes('<img'));
});
test('manager report retains measured zero stages instead of hiding them', () => {
  const out = render([{ eventType: 'click_before_route', clicks: 3, source: 'direct' }, { eventType: 'click_copy_questions', clicks: 0, source: 'direct' }]);
  assert.ok(out.includes(labels.click_copy_questions), 'Zero stages disappear; cannot distinguish missing tracking from no progression');
});
test('manager API provides same-session transition information, not only marginal click totals', async () => {
  let handler;
  const paths = [];
  const context = vm.createContext({ Request, Response, Headers, TextEncoder, console: { error() {} },
    Deno: { env: { get: () => 'test' }, serve: fn => { handler = fn; } },
    fetch: async url => {
      paths.push(String(url));
      return new Response(JSON.stringify([]), { status: 200 });
    }
  });
  const source = stripTypeScriptTypes(edge.replace(/^import[^\n]*\n/, ''), { mode: 'strip' });
  vm.runInContext(source + '\nisAdmin = async () => true;', context);
  const response = await handler(new Request('https://example.invalid', { method: 'POST', headers: { Origin: 'https://buytest.co.il', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stats', range: '7d' }) }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.funnel || data.transitions, 'Only stats/clicks/blog: no ordered session transitions or not-continued counts');
});
