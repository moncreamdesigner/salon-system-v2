import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../api/dashboard-summary.php", import.meta.url), "utf8");
const start = app.indexOf('function dashboardAttendanceHtml(');
const htmlSource = app.slice(start, app.indexOf('\nconst dashboardViewModes', start));
test("attendance report shows counts and resolved-only shares without presenting missing shares as zero", () => {
  const c = vm.createContext({ formatNumber: String, htmlSafe: String, dashboardSimpleTable: (headers, rows) => JSON.stringify({ headers, rows }) });
  vm.runInContext(htmlSource, c);
  const totals = { total: 10, arrived: 3, missed: 1, waiting: 4, excluded: 2, unknown: 0, resolved: 4, uniqueCustomers: 8, arrivedPercent: 75, missedPercent: 25 };
  const html = c.dashboardAttendanceHtml({ totals, byBranch: [{ name: 'A', ...totals }], byMonth: [{ name: '2026-11', ...totals }] });
  assert.match(html, /75%/); assert.match(html, /25%/); assert.match(html, /4 захиалгад/);
  assert.match(html, /8 давхардалгүй хэрэглэгч/);
  assert.match(html, /2026-11/); assert.match(html, /Салбараар/);
  const empty = c.dashboardAttendanceHtml({ totals: { ...totals, arrivedPercent: null, missedPercent: null }, byBranch: [], byMonth: [] });
  assert.doesNotMatch(empty, /null%|undefined%|NaN/);
});
test("attendance reuses dashboard period/salon permissions, server sources and Excel export", () => {
  assert.match(app, /value: "attendance", label: "Захиалгын ирц"/);
  assert.match(app, /item.value === "attendance" && allowed.includes\("time"\)/);
  assert.match(app, /viewMode === "attendance"[\s\S]*?dashboardAttendanceHtml/);
  assert.match(app, /dashboardWorksheet\("Захиалгын ирц"/);
  assert.match(api, /\$customStart\?->format\('Y-m-d'\)/);
  assert.match(api, /booking_attendance_report\([\s\S]*?\$salon, \$today->format\('Y-m-d'\)\)/);
});
