import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function openStaffPerformanceDetail(");
const source = app.slice(start, app.indexOf("\nfunction ", start + 1));

test("staff detail orders mixed service and cash rows newest first without changing payroll", () => {
  const transactions = [
    { id: "old", date: "2026-11-08", type: "single", title: "old-row", revenue: 100, commission: 10, rate: 10, salon: "Branch" },
    { id: "new", date: "2026-11-11", type: "course", title: "new-row", revenue: 200, commission: 20, rate: 10, salon: "Branch" },
    { id: "cash", date: "2026-11-05", type: "kass", title: "cash-row", revenue: 300, commission: 6, rate: 2, salon: "Branch" },
    { id: "same", date: "2026-11-11", type: "single", title: "same-day-row", revenue: 400, commission: 40, rate: 10, salon: "Branch" }
  ];
  const row = { staff: { id: 2, name: "Staff", salon: "Branch" }, transactions, revenue: 1000, commission: 76, singleCount: 2, courseCount: 1, kassDays: 1 };
  const original = structuredClone(row);
  transactions.forEach(Object.freeze);
  Object.freeze(transactions);
  let html = "";
  const context = vm.createContext({
    buildPerformanceReport: () => ({ from: "2026-11-01", to: "2026-11-30", salon: "all", rows: [row] }),
    state: { assignments: [] }, htmlSafe: String, money: value => `${value}M`,
    performanceTransactionTypeLabel: value => value.type,
    window: { open: () => ({ document: { write: value => { html = value; }, close() {} } }) }
  });
  vm.runInContext(source, context);
  context.openStaffPerformanceDetail(2);
  assert.ok(html.indexOf("new-row") < html.indexOf("same-day-row"), "Same-day rows keep their original order");
  assert.ok(html.indexOf("same-day-row") < html.indexOf("old-row"));
  assert.ok(html.indexOf("old-row") < html.indexOf("cash-row"));
  assert.ok(html.includes("1000M"));
  assert.ok(html.includes("76M"));
  assert.deepEqual(row, original, "Source transactions and totals must remain unchanged");
});
