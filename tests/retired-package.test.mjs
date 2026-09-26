import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../package-149.js', import.meta.url), 'utf8');
function app(saved = null) {
  const inserted = [], payments = [], scrolled = [];
  let removed = false;
  const legacy = { querySelector: () => ({}), remove: () => { removed = true; } };
  const insurance = { insertAdjacentElement: (_where, element) => inserted.push(element) };
  const section = { querySelector: () => removed ? insurance : legacy };
  const button = { classList: { remove() {} } };
  const context = vm.createContext({
    buytestPlans: {}, buytestPlanClasses: [],
    document: {
      createElement: () => ({ style: {}, classList: { remove() {} } }),
      head: { appendChild() {} },
      body: { classList: { contains: () => false, toggle() {} } },
      querySelector: () => null,
      getElementById: id => id === 'insuranceStartSection' ? section : id === 'balcarPlanButton' ? button : { scrollIntoView: () => scrolled.push(id) }
    },
    storedBuyTestPayment: () => saved, plate: () => '12345678', atob: () => '{}',
    showInsuranceStart() {}, restoreBuyTestAccess: async () => false,
    startPayment: async plan => { payments.push(plan); },
    updateBuyTestRoadmap() {}, startBalcarPayment() {}, loadPaidBalcarReport() {},
    resumePaidVehicleFlow() {}, previewPlanAsManager() {}, activeBuyTestPlan: () => saved?.plan,
    buyTestStageProgress: { reportCompleted: false }
  });
  vm.runInContext(source, context);
  return { context, payments, inserted, scrolled, removed };
}
test('149 purchase offer is absent after initialization and refresh', () => {
  const a = app();
  assert.equal(a.removed, true, 'Legacy offer removed');
  assert.deepEqual(a.inserted, [], 'No replacement purchase offer');
  a.context.showInsuranceStart();
  assert.deepEqual(a.inserted, []);
  assert.doesNotMatch(source, /onclick="startPayment\('full149'\)"/);
});
test('existing 149 buyer can still access the included report without another charge', async () => {
  const a = app({ plan: 'full149', plate: '12345678', accessToken: 'existing.token' });
  await a.context.startPayment('report');
  assert.deepEqual(a.payments, []);
  assert.deepEqual(a.scrolled, ['afterInspectionSection']);
});
test('other purchase handlers and amounts remain unchanged', async () => {
  const a = app();
  for (const plan of ['report', 'consultation', 'report_consultation', 'balcar']) await a.context.startPayment(plan);
  assert.deepEqual(a.payments, ['report', 'consultation', 'report_consultation', 'balcar']);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [plan, price] of [['report',49], ['consultation',100], ['report_consultation',129], ['balcar',39]]) {
    assert.match(html, new RegExp(plan + ':\\{[^\\n]*price:' + price + '[,}]'));
  }
  assert.match(html, /package-149\.js\?v=7/);
});
