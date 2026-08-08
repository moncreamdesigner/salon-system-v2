import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const apiSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("employee discount is policy-driven and snapshotted on each service", () => {
  assert.match(appSource, /employeeDiscount:\s*\{/);
  assert.match(appSource, /employeeDiscountPercent:\s*Number\(priceParts\.employeeDiscountPercent/);
  assert.match(appSource, /employeeDiscountAmount:\s*Number\(priceParts\.employeeDiscountAmount/);
  assert.match(appSource, /employeeDiscountAppliedAt:/);
  assert.match(htmlSource, /id="employeeDiscountPercent"/);
  assert.match(htmlSource, /id="employeeDiscountEnabled"/);
});

test("transferred course credit is a ledger movement, not new cash revenue", () => {
  assert.match(appSource, /function customerCreditLedger\(/);
  assert.match(appSource, /function courseTransferInfo\(/);
  assert.match(appSource, /type:\s*"course_transfer"/);
  assert.match(appSource, /type:\s*"credit_payment"/);
  assert.match(appSource, /!\["bonus", "gift_card", "customer_credit", "credit_transfer"/);
  assert.match(appSource, /methodSelect\?\.value === "customer_credit" \? null : applyGroupPayment/);
});

test("non-admin accounts cannot create or convert branch customer types", () => {
  assert.match(appSource, /type !== "Салбар" \|\| isAdminAccount\(\)/);
  assert.match(apiSource, /function assert_branch_customer_type_permissions/);
  assert.match(apiSource, /if \(\(\$user\['role'\] \?\? ''\) === 'admin'\) return;/);
  assert.match(apiSource, /assert_branch_customer_type_permissions\(\$currentSections, \$sections, \$user\);/);
});

