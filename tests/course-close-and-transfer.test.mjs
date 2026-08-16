import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

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
  servicePaidAmount(item = {}) {
    return (item.payments || []).reduce((sum, payment) => sum + Number(payment.amount || payment.paidAmount || 0), 0);
  }
};
vm.createContext(context);
vm.runInContext(`${functionSource("courseEligiblePaidAmount")}\n${functionSource("courseTransferInfo")}`, context);

function course({ paid, visits = 4, price = 800000, totalVisits = 8, employeeDiscountAmount = 0 }) {
  return {
    kind: "course",
    basePrice: price,
    employeeDiscountAmount,
    visitsTotal: totalVisits,
    visits: Array.from({ length: visits }, (_, index) => ({ number: index + 1 })),
    payments: paid > 0 ? [{ method: "card", amount: paid }] : []
  };
}

test("a half-used, half-paid course can close without creating credit", () => {
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

test("close flow keeps zero-credit closure out of the customer ledger", () => {
  assert.match(appSource, /\["credit_transfer", "Шилжүүлэх \/ хаах"\]/);
  assert.match(appSource, /submitButton\.disabled = transferInfo\.unusedVisits <= 0 \|\| transferInfo\.shortfall > 0/);
  assert.match(appSource, /if \(transfer\.available > 0\) \{[\s\S]*customer\.creditLedger\.unshift\(closureEntry\)/);
  assert.match(appSource, /historyItem\.courseClosedWithoutTransfer = transfer\.available <= 0;[\s\S]*historyItem\.balance = 0;/);
  assert.match(appSource, /title: transfer\.available > 0 \? "course_credit_transferred" : "course_closed"/);
});
