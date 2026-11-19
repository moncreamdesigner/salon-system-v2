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
  const form = node(), directory = node();
  const ids = { currentServiceTab: current, incompleteServiceTab: incomplete, activeTreatmentStrip: strip, incompleteServicePanel: panel, customerServiceTabs: tabs, customerInlineForm: form, customerDirectoryPanel: directory };
  tabs.querySelector = x => ids[x.slice(1)];
  const requests = [];
  const context = vm.createContext({ document: { getElementById: id => ids[id] }, loadIncompleteServicePage: (p, n) => requests.push([p,n]) });
  vm.runInContext(app.slice(app.indexOf('let incompleteServiceGeneration'), app.indexOf('async function loadIncompleteServicePage')), context);
  context.bindCustomerServiceTabs();
  assert.deepEqual(requests, []);
  incomplete.listeners.click();
  incomplete.listeners.click();
  assert.deepEqual(requests, [[panel,1]]);
  assert.equal(form.classList.contains('hidden'), true);
  assert.equal(directory.classList.contains('hidden'), true);
  current.listeners.click();
  assert.equal(panel.classList.contains('hidden'), true);
  assert.equal(strip.classList.contains('hidden'), false);
  assert.equal(form.classList.contains('hidden'), false);
  assert.equal(directory.classList.contains('hidden'), false);
  assert.match(html, /id="customerDirectoryPanel"/);
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
  assert.match(api, /COUNT\(\*\) OVER \(\) AS matched_count/);
  assert.match(api, /'totalPages' => \$totalPages/);
  assert.match(api, /ORDER BY x\.opened IS NULL, x\.opened, x\.customer_id, x\.service_id/);
  assert.doesNotMatch(api, /app_sections|INSERT INTO|UPDATE app_|DELETE FROM/);
});

test('incomplete service pagination shows only current and total page numbers', async () => {
  const panel = { isConnected: true, classList: { contains: () => false }, querySelectorAll: () => [] };
  const requests = [];
  const context = vm.createContext({
    activeView: 'customers', activeAccount: { id: 1 }, htmlSafe: String,
    serverApi: async path => {
      requests.push(path);
      return path.endsWith('=4') ? { items: [], totalPages: 0, hasMore: false }
        : { items: [{ customer_id: 10 }], totalPages: 3, hasMore: true };
    },
  });
  vm.runInContext(app.slice(app.indexOf('let incompleteServiceGeneration'), app.indexOf('function renderCustomers()')), context);
  await context.loadIncompleteServicePage(panel, 2);
  assert.match(panel.innerHTML, /<span>2 \/ 3<\/span>/);
  await context.loadIncompleteServicePage(panel, 4);
  assert.match(requests.at(-1), /page=1$/);
  assert.match(panel.innerHTML, /<span>1 \/ 3<\/span>/);
});
