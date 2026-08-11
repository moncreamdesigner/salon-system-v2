import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const apiSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("employee discount is policy-driven and snapshotted on each service", () => {
  assert.match(appSource, /employeeDiscount:\s*\{/);
  assert.match(appSource, /employeeDiscountPercent:\s*Number\(priceParts\.employeeDiscountPercent/);
  assert.match(appSource, /employeeDiscountAmount:\s*Number\(priceParts\.employeeDiscountAmount/);
  assert.match(appSource, /employeeDiscountAppliedAt:/);
  assert.match(htmlSource, /id="employeeDiscountPercent"/);
  assert.match(htmlSource, /id="employeeDiscountEnabled"/);
});

test("employee discount applies to kass products and respects special-price stacking", () => {
  const functionSource = appSource.match(/function employeeDiscountPriceParts\([\s\S]*?\n}\n/)?.[0];
  assert.ok(functionSource, "Employee discount calculator must exist");
  let policy = { enabled: true, percent: 10, applyToDiscountedPrice: true };
  const calculator = new Function("pricePolicy", "defaultState", `${functionSource}; return employeeDiscountPriceParts;`)(
    () => ({ employeeDiscount: policy }),
    { pricePolicy: { employeeDiscount: policy } }
  );

  assert.deepEqual(calculator({ type: "Ажилтан" }, 100000, 70000), { percent: 10, amount: 10000, total: 90000 });
  policy = { ...policy, applyToDiscountedPrice: false };
  assert.deepEqual(calculator({ type: "Ажилтан" }, 100000, 70000), { percent: 10, amount: 3000, total: 97000 });
  assert.deepEqual(calculator({ type: "Хэрэглэгч" }, 100000, 0), { percent: 0, amount: 0, total: 100000 });

  assert.match(appSource, /renderProfileKassCartBox\(customer, cart\)/);
  assert.match(appSource, /employeeDiscountPriceParts\(customer, grossTotal, discountedSubtotal\)/);
  assert.match(appSource, /kind: "kass"[\s\S]*?employeeDiscountPercent: employeeDiscount\.percent,[\s\S]*?employeeDiscountAmount: employeeDiscount\.amount/);
  assert.match(appSource, /balance: Math\.max\(0, employeeDiscount\.total - paidAmount\)/);
  assert.match(styleSource, /\.profile-kass-total\.profile-kass-discount[\s\S]*?color: var\(--accent\);/);
});

test("transferred course credit is a ledger movement, not new cash revenue", () => {
  assert.match(appSource, /function customerCreditLedger\(/);
  assert.match(appSource, /function courseTransferInfo\(/);
  assert.match(appSource, /type:\s*"course_transfer"/);
  assert.match(appSource, /type:\s*"credit_payment"/);
  assert.match(appSource, /!\["bonus", "gift_card", "customer_credit", "credit_transfer"/);
  assert.match(appSource, /methodSelect\?\.value === "customer_credit" \? null : applyGroupPayment/);
  assert.match(appSource, /amountInput\.disabled = transferMode;/);
  assert.match(appSource, /amountInput\.required = !transferMode;/);
  assert.match(styleSource, /\.inline-payment-extra\.credit-transfer-mode\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(appSource, /inline-payment-credit-balance-field hidden/);
  assert.doesNotMatch(appSource, /Энэ дүн шинэ орлого болон кассын урамшуулалд дахин тооцогдохгүй/);
  assert.match(appSource, /placeholder="Шалтгаан: Курсыг зогсоож бараа авах"/);
});

test("an older service can receive a current payment while payment dates remain protected", () => {
  assert.doesNotMatch(appSource, /const paymentEditable = isServiceWithinEditDays\(item\);/);
  assert.match(appSource, /<button class="primary-btn inline-payment-submit" type="submit"/);
  assert.doesNotMatch(appSource, /if \(!isServiceWithinEditDays\(historyItem\)\)/);
  assert.match(appSource, /requireOperationalDateEditable\(paidDate, "[^"]+"\)/);
  assert.match(appSource, /requireOperationalDateEditable\(transferDate, "[^"]+"\)/);
});

test("course visits use a staged, per-visit cancellation flow", () => {
  assert.match(appSource, /class="secondary-btn icon-clear course-visit-cancel"/);
  assert.match(appSource, /form\.dataset\.cancelRequested = "true"/);
  assert.match(appSource, /if \(existingVisit && form\.dataset\.cancelRequested === "true"\)/);
  assert.match(appSource, /requireOperationalDateEditable\(cancelledDate, "цуцлах"\)/);
  assert.match(appSource, /course\.visits = \(course\.visits \|\| \[\]\)\.filter/);
  assert.match(appSource, /course_visit_cancelled/);
});

test("transferred courses can be corrected within the configured window without orphaning credit", () => {
  assert.match(appSource, /if \(item\.transferClosed\) return "transfer-details";/);
  assert.match(appSource, /function courseTransferLedgerEntries\(/);
  assert.match(appSource, /function serviceCreditLedgerEntries\(/);
  assert.match(appSource, /if \(remainingCreditBalance < 0\)/);
  assert.match(appSource, /customer\.creditLedger = remainingCreditLedger;/);
  assert.match(appSource, /course_credit_transfer_reversed/);
  assert.match(appSource, /if \(editingItem\.transferClosed\)[\s\S]+?creditTransfers: editingItem\.creditTransfers,[\s\S]+?transferClosed: true/);
});

test("deleted services do not leave credit ledger history behind", () => {
  assert.match(appSource, /const historyIds = new Set\(\(Array\.isArray\(customer\.serviceHistory\)/);
  assert.match(appSource, /return \(!sourceId \|\| historyIds\.has\(sourceId\)\) && \(!targetId \|\| historyIds\.has\(targetId\)\);/);
  assert.match(appSource, /function reverseCustomerCreditPayment[\s\S]+?String\(entry\.targetServiceId \|\| ""\) === historyId/);
});

test("non-admin accounts cannot create or convert branch customer types", () => {
  assert.match(appSource, /type !== "Салбар" \|\| isAdminAccount\(\)/);
  assert.match(apiSource, /function assert_branch_customer_type_permissions/);
  assert.match(apiSource, /if \(\(\$user\['role'\] \?\? ''\) === 'admin'\) return;/);
  assert.match(apiSource, /assert_branch_customer_type_permissions\(\$currentSections, \$sections, \$user\);/);
});

test("employee policy checkboxes use the product accent color", () => {
  assert.match(styleSource, /\.employee-discount-policy input\[type="checkbox"\]\s*\{\s*accent-color: var\(--accent\);\s*\}/);
});
