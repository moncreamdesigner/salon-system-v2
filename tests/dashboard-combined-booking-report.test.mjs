import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function helper(name) { const start = app.indexOf(`function ${name}(`); return app.slice(start, app.indexOf("\nfunction ", start + 1)); }

test("one combined page renders attendance below time without subtabs or separate filters", () => {
  const calls = [];
  const c = vm.createContext({ dashboardTimeReportPageHtml: value => { calls.push(value); return '<section>TIME</section>'; }, dashboardAttendanceHtml: value => { calls.push(value); return '<section>ATTENDANCE</section>'; } });
  vm.runInContext(helper('dashboardBookingReportHtml'), c);
  const time = { totalBookings: 5 }, attendance = { totals: { arrived: 3 } };
  const html = c.dashboardBookingReportHtml(time, attendance);
  assert.equal(html, '<div class="dashboard-report-stack"><section>TIME</section><section>ATTENDANCE</section></div>');
  assert.equal(calls[0], time); assert.equal(calls[1], attendance);
  assert.doesNotMatch(html, /tablist|role="tab"|<input|<select/);
});

test("previous attendance selection redirects to the combined time view", () => {
  const c = vm.createContext({ document: { getElementById: () => ({ value: 'attendance' }) }, dashboardAllowedViewModes: () => [{ value: 'overview' }, { value: 'time' }] });
  vm.runInContext(helper('dashboardNormalizedViewMode') + '\n' + helper('dashboardSelectedViewMode'), c);
  assert.equal(c.dashboardSelectedViewMode(), 'time');
  assert.match(app, /const previousMode = dashboardNormalizedViewMode\(modeSelect.value\)/);
  for (const [previous, current] of Object.entries({ overview: 'sales', cashflow: 'sales', operations: 'staff', attendance: 'time' })) assert.equal(c.dashboardNormalizedViewMode(previous), current);
});
