import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../api/dashboard-summary.php", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../api/analytics-source.php", import.meta.url), "utf8");

test("dashboard loads a server read model before the optional staff detail source", () => {
  assert.match(app, /serverApi\(`dashboard-summary\.php\?\$\{params\.toString\(\)\}`\)/);
  assert.match(app, /summary: result\.summary/);
  assert.match(app, /setTimeout\(\(\) => void loadDashboardStaffSource/);
  assert.match(app, /dashboardDataCache\?\.summary\?\.snapshots/);
  assert.match(app, /dashboardDataCache\?\.summary\?\.serviceRows/);
  assert.match(app, /dashboardDataCache\?\.summary\?\.paymentRows/);
  assert.match(app, /dashboardDataCache\?\.summary\?\.demographics/);
});

test("dashboard falls back to the compatible source when the read model is unavailable", () => {
  assert.match(app, /Dashboard summary response is incomplete/);
  assert.match(app, /typeof summary\.paymentRows !== "object"/);
  assert.match(app, /new URLSearchParams\(\{ mode: "dashboard", month \}\)/);
  assert.match(app, /serverApi\(`analytics-source\.php\?\$\{legacyParams\.toString\(\)\}`\)/);
  assert.match(app, /summary: null/);
  assert.match(app, /if \(!usedLegacySource && month !== "all"\) setTimeout/);
});

test("dashboard summary returns aggregates instead of raw customer and booking arrays", () => {
  assert.match(api, /'snapshots' => \$snapshots/);
  assert.match(api, /'serviceRows' => \$serviceRows/);
  assert.match(api, /'paymentRows' => \$paymentRows/);
  assert.match(api, /'customerStats' =>/);
  assert.match(api, /'operations' =>/);
  assert.match(api, /'system' =>/);
  assert.doesNotMatch(api, /'data'\s*=>\s*\$source/);
  assert.doesNotMatch(api, /'customers'\s*=>\s*\$source\['customers'\]/);
  assert.match(api, /\(\$user\['role'\] \?\? ''\) === 'salon'/);
  assert.match(api, /\$includeOperationalData = !\$isDeleted && empty\(\$item\['deleted'\]\)/);
  assert.match(api, /foreach \(\$paymentRows as \$paymentRow\)/);
  assert.doesNotMatch(api, /if \(\$isDeleted\) \{[\s\S]{0,120}continue;/);
});

test("performance statements sent to the browser contain only calculation fields", () => {
  assert.match(analytics, /function analytics_compact_statement/);
  assert.match(analytics, /analytics_compact_statement\(\$item\)/);
  assert.doesNotMatch(analytics, /\$copy = \$statement/);
});

test("dashboard supports an all-time period while keeping the current month as the UI default", () => {
  assert.match(api, /\$isTotal = \$requestedPeriod === 'all'/);
  assert.match(api, /if \(\$isTotal\) \$monthKeys\[\] = 'all'/);
  assert.match(app, /<option value="all">Нийт<\/option>/);
  assert.match(app, /const previousMonth = monthSelect\.value \|\| currentMonthKey/);
});

test("dashboard revenue KPIs separate service and product income in the agreed order", () => {
  assert.match(api, /'serviceRevenue' => 0/);
  assert.match(api, /if \(\$sourceKind !== 'product'\) \$snapshots\[\$key\]\['serviceRevenue'\] \+= \$paymentRow\['amount'\]/);
  const totalIndex = app.indexOf("<span>Нийт орлого</span>");
  const serviceIndex = app.indexOf("<span>Үйлчилгээний орлого</span>");
  const productIndex = app.indexOf("<span>Барааны орлого</span>");
  const visitIndex = app.indexOf("<span>Үйлчилгээний оролт</span>");
  assert.ok(totalIndex < serviceIndex && serviceIndex < productIndex && productIndex < visitIndex);
});

test("service visits exclude kass quantities and occupancy uses real schedule capacity", () => {
  assert.match(api, /\$snapshot\['visits'\] = \(int\)\(\$countMap\['course'\]/);
  assert.match(app, /filter\(item => item\.key !== "kass"\)/);
  assert.match(api, /dashboard_month_capacity/);
  assert.match(api, /\$latest = \$close - 120/);
  assert.match(api, /dashboard_holiday_closed/);
  assert.match(api, /\['cancelled', 'rejected'\]/);
  assert.match(api, /\$counts\['occupied'\] \/ \$availableCapacity/);
});
