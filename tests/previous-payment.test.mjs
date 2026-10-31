import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function loadFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end);
}
const context = vm.createContext({});
for (const name of ["paymentMethodOptions", "paymentMethodOptionsLabel", "isActualKassRevenueRow", "servicePaidAmount", "courseEligiblePaidAmount", "performancePaymentEligible"]) {
  vm.runInContext(loadFunction(name), context);
}

test("previous payment is selectable and displayed with a distinct label", () => {
  assert.match(context.paymentMethodOptions("previous_payment"), /value="previous_payment" selected>Өмнө нь төлсөн/);
  assert.equal(context.paymentMethodOptionsLabel("previous_payment"), "Өмнө нь төлсөн");
});

test("historical payment settles the service without becoming new cash revenue or cashier commission", () => {
  const historical = { method: "previous_payment", amount: 500000, paidAmount: 500000 };
  const current = { method: "qpay", amount: 40000, paidAmount: 40000 };
  const service = { payments: [historical, current] };
  assert.equal(context.servicePaidAmount(service), 540000);
  assert.equal(context.courseEligiblePaidAmount(service), 540000, "Future service performance still recognizes the paid course");
  assert.equal(context.isActualKassRevenueRow(historical), false);
  assert.equal(context.isActualKassRevenueRow(current), true);
  assert.equal(service.payments.filter(context.isActualKassRevenueRow).reduce((sum, payment) => sum + payment.amount, 0), 40000);
  assert.equal(context.performancePaymentEligible(historical, { paymentMethods: ["previous_payment"] }), false);
  assert.equal(context.performancePaymentEligible(current, { paymentMethods: ["qpay"] }), true);
});

test("historical payment cannot spend or generate new group bonus", () => {
  assert.match(source, /const bonusAmount = \["customer_credit", "previous_payment"\]\.includes\(selectedMethodValue\)/);
  assert.match(source, /const groupPayment = \["customer_credit", "previous_payment"\]\.includes\(methodSelect\?\.value\) \? null : applyGroupPayment/);
  assert.match(source, /if \(previousPaymentMode\) setBonusApplied\(false\)/);
});

test("both server revenue read models exclude historical payments", () => {
  for (const file of ["dashboard-summary.php", "revenue-list.php"]) {
    const php = fs.readFileSync(new URL(`../api/${file}`, import.meta.url), "utf8");
    assert.match(php, /return !in_array\(\$normalized, \[[^\]]*'previous_payment'[^\]]*\], true\)/);
  }
});
