import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/customer-incomplete-services.php', import.meta.url), 'utf8');

test('opening only the incomplete tab loads page one, closing discards late responses', () => {
  const node = (hidden = false) => {
    const classes = new Set(hidden ? ['hidden'] : []);
    return { dataset: {}, listeners: {}, isConnected: true, classList: {
      contains: x => classes.has(x), add: x => classes.add(x), remove: x => classes.delete(x),
      toggle: (x, on) => on ? classes.add(x) : classes.delete(x),
    }, setAttribute() {}, replaceChildren() { this.innerHTML = ''; },
    addEventListener(name, fn) { this.listeners[name] = fn; } };
  };
  const current = node(), incomplete = node(), strip = node(), panel = node(true), tabs = node();
  const ids = { currentServiceTab: current, incompleteServiceTab: incomplete, activeTreatmentStrip: strip, incompleteServicePanel: panel, customerServiceTabs: tabs };
  tabs.querySelector = x => ids[x.slice(1)];
  const requests = [];
  const context = vm.createContext({ document: { getElementById: id => ids[id] }, loadIncompleteServicePage: (p, n) => requests.push([p,n]) });
  vm.runInContext(app.slice(app.indexOf('let incompleteServiceGeneration'), app.indexOf('async function loadIncompleteServicePage')), context);
  context.bindCustomerServiceTabs();
  assert.deepEqual(requests, []);
  incomplete.listeners.click();
  incomplete.listeners.click();
  assert.deepEqual(requests, [[panel,1]]);
  current.listeners.click();
  assert.equal(panel.classList.contains('hidden'), true);
  assert.equal(strip.classList.contains('hidden'), false);
  assert.match(app, /generation === incompleteServiceGeneration && activeView === "customers" && panel.isConnected/);
  assert.match(html, /id="incompleteServicePanel"\s+role="tabpanel"/);
});

test('server uses signed-in branch, valid visits, real prepaid records and bounded oldest-first pages', () => {
  assert.match(api, /\$user = require_auth\(\)/);
  assert.doesNotMatch(api, /\$_GET\[['"]salon/);
  assert.match(api, /s\.salon = \?/);
  assert.match(api, /c\.archived = 0/);
  assert.match(api, /\$\.transferClosed/);
  assert.match(api, /COUNT\(DISTINCT[\s\S]*?v\.payload, '\$\.deletedAt'/);
  assert.match(api, /\$\.prepaidPending[\s\S]*?p\.amount > 0/);
  assert.match(api, /\$pageSize = 30/);
  assert.match(api, /ORDER BY x\.opened IS NULL, x\.opened, x\.customer_id, x\.service_id/);
  assert.doesNotMatch(api, /app_sections|INSERT INTO|UPDATE app_|DELETE FROM/);
});
