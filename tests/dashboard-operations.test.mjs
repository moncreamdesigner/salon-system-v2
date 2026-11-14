import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function helper(name) { const start = app.indexOf(`function ${name}(`); return app.slice(start, app.indexOf('\nfunction ', start + 1)); }
test('donut calculates missing shares and handles empty totals', () => {
  const c = vm.createContext({ formatNumber: String, htmlSafe: String });
  vm.runInContext(helper('dashboardDonutMarkup'), c);
  const rows = [{ name: 'Confirmed', value: 3, color: 'green' }, { name: 'Cancelled', value: 1, color: 'red' }];
  const markup = c.dashboardDonutMarkup(rows, 4, 'value');
  assert.match(markup, /75%/); assert.match(markup, /25%/);
  assert.doesNotMatch(c.dashboardDonutMarkup([{ value: 0 }], 0, 'value'), /undefined%|NaN%|Infinity%/);
});
test('served today counts customers once and follows performed branch, not payment date', () => {
  const c = vm.createContext({});
  vm.runInContext(helper('dashboardServedToday'), c);
  const service = { kind: 'single', date: '2026-11-14', salon: 'A', staff: 'Employee' };
  const customers = [{ id: 1, serviceHistory: [service, service] }, { id: 2, serviceHistory: [{ kind: 'course', salon: 'A', visits: [{ ...service, performedSalon: 'B' }] }] }, { id: 3, serviceHistory: [{ ...service, prepaidPending: true }] }];
  assert.equal(c.dashboardServedToday(customers, service.date, ''), 2);
  assert.equal(c.dashboardServedToday(customers, service.date, 'A'), 1);
  assert.equal(c.dashboardServedToday(customers, service.date, 'B'), 1);
});
