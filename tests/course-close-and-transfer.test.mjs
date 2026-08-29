import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const parametersStart = appSource.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parameterDepth += 1;
    if (appSource[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = appSource.indexOf("{", parametersEnd);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`${name} body is incomplete`);
}

const context = {
  result: null,
  activeAccount: { salon: "Salon 1" },
  todayText() { return "2026-08-29"; },
  performancePolicyForDate() {
    return { version: 1, effectiveFrom: "2026-01-01", service: { basis: "base", rate: 10, serviceKinds: ["course", "single"] } };
  },
  servicePaidAmount(item = {}) {
    return (item.payments || []).reduce((sum, payment) => sum + Number(payment.amount || payment.paidAmount || 0), 0);
  }
};
vm.createContext(context);
vm.runInContext(`${functionSource("courseEligiblePaidAmount")}\n${functionSource("configuredCourseSingleVisitPrice")}\n${functionSource("courseTransferInfo")}\n${functionSource("courseClosurePerformanceAdjustments")}`, context);

function course({ paid, visits = 4, price = 800000, totalVisits = 8, employeeDiscountAmount = 0, singleVisitPrice = price / totalVisits }) {
  return {
    kind: "course",
    basePrice: price,
    singleVisitPrice,
    employeeDiscountAmount,
    visitsTotal: totalVisits,
    visits: Array.from({ length: visits }, (_, index) => ({ number: index + 1 })),
    payments: paid > 0 ? [{ method: "card", amount: paid }] : []
  };
}

test("a half-used, half-paid course has no transferable overpayment", () => {
  const info = context.courseTransferInfo(course({ paid: 400000 }));
  assert.deepEqual(
    { used: info.usedVisits, unused: info.unusedVisits, usedValue: info.usedValue, available: info.available, shortfall: info.shortfall },
    { used: 4, unused: 4, usedValue: 400000, available: 0, shortfall: 0 }
  );
});

test("only payment above consumed visits becomes customer credit", () => {
  const info = context.courseTransferInfo(course({ paid: 500000 }));
  assert.equal(info.available, 100000);
  assert.equal(info.shortfall, 0);
});

test("a course cannot close while consumed visits have an unpaid shortfall", () => {
  const info = context.courseTransferInfo(course({ paid: 300000 }));
  assert.equal(info.available, 0);
  assert.equal(info.shortfall, 100000);
});

test("transfer and close is offered only for a paid course with an overpayment", () => {
  assert.match(appSource, /\["credit_transfer", "Шилжүүлэх \/ хаах"\]/);
  assert.match(appSource, /allowCreditTransfer = item\.kind === "course" && transferInfo\.unusedVisits > 0 && transferInfo\.paid > 0 && transferInfo\.available > 0/);
  assert.match(appSource, /transfer\.unusedVisits <= 0 \|\| transfer\.paid <= 0 \|\| transfer\.available <= 0/);
  assert.match(appSource, /if \(transfer\.available > 0\) \{[\s\S]*customer\.creditLedger\.unshift\(closureEntry\)/);
});

test("closing a course reprices consumed visits at the stored single-visit price", () => {
  const info = context.courseTransferInfo(course({ paid: 800000, singleVisitPrice: 150000 }));
  assert.deepEqual(
    { originalUsedValue: info.originalUsedValue, usedValue: info.usedValue, difference: info.repricingDifference, available: info.available },
    { originalUsedValue: 400000, usedValue: 600000, difference: 200000, available: 200000 }
  );
});

test("course closure adjustments follow each visit staff and use the closure date", () => {
  const item = course({ paid: 800000, visits: 3, singleVisitPrice: 150000 });
  item.id = "course-1";
  item.service = "Massage course";
  item.visits = [
    { id: "v1", number: 1, date: "2026-01-05", salon: "Salon 1", staff: "A", staffId: 1 },
    { id: "v2", number: 2, date: "2026-02-05", salon: "Salon 2", staff: "B", staffId: 2 },
    { id: "v3", number: 3, date: "2026-03-05", salon: "Salon 1", staff: "A", staffId: 1 }
  ];
  const transfer = context.courseTransferInfo(item, 150000);
  const rows = context.courseClosurePerformanceAdjustments(item, { name: "Customer" }, transfer, "2026-08-29", "close-1");
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => [row.staff, row.salon, row.date, row.revenue, row.commission]), [
    ["A", "Salon 1", "2026-08-29", 50000, 5000],
    ["B", "Salon 2", "2026-08-29", 50000, 5000],
    ["A", "Salon 1", "2026-08-29", 50000, 5000]
  ]);
});

test("salary deduction is offered only to employee customers", () => {
  assert.match(appSource, /allowSalary = customer\?\.type === "Ажилтан"/);
  assert.match(appSource, /\.\.\.\(allowSalary \? \[\["salary", "Цалингаас суутгах"\]\] : \[\]\)/);
  assert.match(appSource, /paymentMethodOptions\(selectedMethod, \{ allowCreditTransfer, allowSalary, creditBalance \}\)/);
  assert.match(appSource, /selectedMethodValue === "salary" && customer\?\.type !== "Ажилтан"/);
});

test("customer registration age fields are numeric text inputs without spinner controls", () => {
  const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(htmlSource, /id="inlineCustomerAge"[^>]*type="text"[^>]*inputmode="numeric"[^>]*maxlength="3"/);
  assert.match(appSource, /id="modalCustomerAge"[^>]*type="text"[^>]*inputmode="numeric"[^>]*maxlength="3"/);
  assert.match(appSource, /inlineCustomerAge"\)\?\.addEventListener\("input"[\s\S]*replace\(\/\\D\/g, ""\)\.slice\(0, 3\)/);
});

test("payment and close controls adapt to the profile column instead of viewport width", () => {
  assert.match(styleSource, /\.inline-payment-form\s*\{[\s\S]*?container-type: inline-size;/);
  assert.match(styleSource, /\.inline-payment-method-field \.custom-select-menu\s*\{[\s\S]*?width: max\(100%, 230px\);/);
  assert.match(styleSource, /@container \(max-width: 900px\)[\s\S]*?\.inline-payment-grid\s*\{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/);
  assert.match(styleSource, /@container \(max-width: 900px\)[\s\S]*?\.inline-payment-method-field\s*\{[\s\S]*?flex: 1 1 230px !important;/);
  assert.match(styleSource, /@container \(max-width: 900px\)[\s\S]*?\.inline-credit-transfer\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
});
