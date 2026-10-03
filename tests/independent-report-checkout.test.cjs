const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('independent report checkout opens its form without re-entering the entitlement wrapper', async () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const start = html.indexOf("async function startPayment(planKey='report')");
  const end = html.indexOf('async function submitBuyTestPayment()', start);
  assert.ok(start >= 0 && end > start);
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {hidden: true, value: id === 'plate' ? '12345678' : '', classList: {remove() {}}});
    return nodes.get(id);
  };
  const session = new Map();
  const ctx = {
    buyTestPaymentStarting: false,
    buytestPlans: {report: {name: 'פענוח דוח המכון', price: 29}},
    document: {body: {classList: {contains: () => false}, style: {}}, getElementById: node},
    storedBuyTestPayment: () => null,
    sessionStorage: {setItem: (k,v) => session.set(k,v)},
    BuyTestBundle: {unlock: () => {throw new Error('Checkout re-entered the wrapper');}}
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end), ctx);
  await ctx.startPayment('report');
  assert.equal(node('paymentOverlay').hidden, false);
  assert.equal(session.get('buytestPendingPlan'), 'report');
  assert.equal(node('paymentPlanSummary').textContent, 'פענוח דוח המכון · רכב 12345678 · 29 ₪');
  assert.equal(node('paymentSubmitButton').textContent, 'המשך לתשלום מאובטח — 29 ₪');
});
