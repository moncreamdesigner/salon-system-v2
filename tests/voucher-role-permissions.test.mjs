import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const endpointSource = fs.readFileSync(new URL("../api/voucher-roles.php", import.meta.url), "utf8");
const stateSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");

test("salon voucher role writes use an atomic endpoint instead of generic state replacement", () => {
  assert.match(appSource, /serverApi\("voucher-roles\.php"/);
  assert.match(appSource, /submitVoucherRoleOperation\("upsert"/);
  assert.match(appSource, /submitVoucherRoleOperation\("delete"/);
  assert.match(endpointSource, /SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE/);
  assert.match(endpointSource, /voucher_role_rows\(\$pdo, 'voucherRoles', true\)/);
  assert.match(stateSource, /\$restricted = \[[^\]]*'voucherRoles'/);
});

test("simultaneous edits of the same voucher role conflict without losing other roles", () => {
  assert.match(appSource, /baseRole: existingRole \? structuredClone\(existingRole\) : null/);
  assert.match(endpointSource, /\$currentRole != \$baseRole/);
  assert.match(endpointSource, /'voucherRoleConflict' => true/);
  assert.match(endpointSource, /voucher_role_next_id\(\$roles\)/);
});

test("voucher cashier eligibility updates the versioned policy in the same transaction", () => {
  assert.match(endpointSource, /function voucher_role_update_policy/);
  assert.match(endpointSource, /'voucherRoleIds' => \$ids/);
  assert.match(endpointSource, /\$upsert->execute\(\['pricePolicy'/);
  assert.match(endpointSource, /\$pdo->commit\(\)/);
});

test("salon-entered voucher labels are escaped before rendering for every branch", () => {
  assert.match(appSource, /<strong>\$\{htmlSafe\(role\.name\)\}<\/strong>/);
  assert.match(appSource, /htmlSafe\(role\.position \|\| ""\)/);
});
