import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../api/analytics-source.php", import.meta.url), "utf8");

test("dashboard and performance use a bounded analytics source instead of full state", () => {
  assert.match(app, /dashboard: \["salons", "generalSettings"\]/);
  assert.match(app, /loadDashboardAnalyticsSource/);
  assert.match(app, /loadPerformanceAnalyticsSource/);
  assert.match(api, /\$mode === 'dashboard'.*modify\('-5 months'\)/s);
  assert.match(api, /\$monthStart->modify\('-1 month'\)/);
  assert.match(api, /analytics_service_relevant/);
  assert.match(app, /params\.set\("from", requestedFrom\)/);
  assert.match(app, /params\.set\("to", requestedTo\)/);
  assert.match(app, /\["performanceFrom", "performanceTo"\][\s\S]+?await loadPerformanceAnalyticsSource/);
  assert.doesNotMatch(app, /invalidatePerformanceCaches\(\)/);
});

test("analytics source enforces salon scope on the server", () => {
  assert.match(api, /\(\$user\['role'\] \?\? ''\) === 'salon'/);
  assert.match(api, /\$itemSalon !== \$salon/);
  assert.match(api, /function analytics_compact_customer/);
  assert.match(api, /function analytics_compact_service/);
  assert.match(api, /\$registeredRelevant \|\| \$history !== \[\]/);
  assert.doesNotMatch(api, /\$copy = \$customer/);
  assert.doesNotMatch(api, /'customerGroups'/);
});
