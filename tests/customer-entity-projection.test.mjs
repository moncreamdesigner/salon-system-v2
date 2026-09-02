import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../api/customer-entity-store.php", import.meta.url), "utf8");
const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const backfill = fs.readFileSync(new URL("../api/entity-backfill.php", import.meta.url), "utf8");
const fullBackup = fs.readFileSync(new URL("../api/full-backups.php", import.meta.url), "utf8");
const rollingBackup = fs.readFileSync(new URL("../api/rolling-backups.php", import.meta.url), "utf8");
const customerDetail = fs.readFileSync(new URL("../api/customer-detail.php", import.meta.url), "utf8");

test("operational customer data has additive indexed entity tables", () => {
  for (const table of [
    "app_customer_entities",
    "app_service_entities",
    "app_payment_entities",
    "app_visit_entities",
    "app_kass_sale_items",
    "app_customer_credit_entities"
  ]) assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(bootstrap, /idx_payment_entities_salon_date/);
  assert.match(bootstrap, /idx_visit_entities_staff_date/);
});

test("compatibility JSON and entity projections commit in one transaction", () => {
  assert.match(stateApi, /project_customer_entities\(\$pdo, \$sections\['customers'\], \$projectedCustomerIds, \$nextRevision\)/);
  assert.match(stateApi, /Keep the normalized operational projection in the same transaction/);
  assert.match(store, /DELETE FROM \{\$table\} WHERE customer_id IN/);
  assert.match(store, /INSERT INTO app_payment_entities/);
  assert.match(store, /INSERT INTO app_visit_entities/);
  assert.match(store, /INSERT INTO app_kass_sale_items/);
});

test("projection backfill is admin-only and bounded", () => {
  assert.match(backfill, /\$user = require_admin\(\)/);
  assert.match(backfill, /min\(100,/);
  assert.match(backfill, /'matches' => \$source === \$projection/);
  assert.match(backfill, /\$expectedRevision/);
  assert.match(backfill, /'restartRequired' => true/);
  assert.match(backfill, /entity_projection_ready', '0'/);
});

test("all backup and restore paths preserve or rebuild projections", () => {
  assert.match(fullBackup, /'app_customer_entities'/);
  assert.match(fullBackup, /'app_payment_entities'/);
  assert.match(rollingBackup, /project_customer_entities\(\$pdo, \$restoredCustomers/);
  assert.match(rollingBackup, /DELETE FROM \{\$projectionTable\}/);
});

test("customer detail cuts over only after projection parity is marked ready", () => {
  assert.match(customerDetail, /entity_projection_ready\(\$pdo\)/);
  assert.match(customerDetail, /SELECT payload FROM app_customer_entities WHERE customer_id = \?/);
  assert.match(customerDetail, /if \(\$projectionReady\)/);
  assert.match(customerDetail, /else \{[\s\S]+foreach \(\$customers as \$customer\)/);
});
