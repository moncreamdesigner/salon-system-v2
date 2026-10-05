import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helpers = app.slice(app.indexOf("function performanceTransactionIdentity("), app.indexOf("function calculatePerformanceTransactions("));
const context = vm.createContext({ structuredClone });
vm.runInContext(helpers, context);
const unique = rows => context.dedupePerformanceTransactions(rows);
const rows = [
  { id: "kass:payment", type: "kass", staffId: 2, salon: "Хан-Уул", revenue: 82900, commission: 1658 },
  { id: "service:course:visit:6", type: "course", staffId: 2, salon: "Хан-Уул", revenue: 81250, commission: 8125 },
  { id: "service:course:visit:7", type: "course", staffId: 3, salon: "Хан-Уул", revenue: 81250, commission: 8125 }
];

test("renaming a customer cannot duplicate a payment or visit payout", () => {
  const oldRows = rows.map(row => ({ ...row, customer: "ЦЭВЭЛМАА" }));
  const renamedRows = rows.map(row => ({ ...row, customer: "Цэвэлмаа" }));
  const result = unique([...oldRows, ...renamedRows]);
  assert.equal(result.length, 3);
  assert.equal(result.reduce((sum, row) => sum + row.commission, 0), 17908);
  assert.equal(result.reduce((sum, row) => sum + row.revenue, 0), 245400);
  assert.equal(unique(result).length, 3);
  assert.equal(oldRows.length, 3);
});

test("different visits, recipients, and unknown legacy events are retained", () => {
  assert.equal(unique([
    rows[0], rows[1], rows[2],
    { ...rows[1], staffId: 3 },
    { ...rows[1], type: "master" },
    { ...rows[1], salon: "Чингэлтэй" },
    { revenue: 100 }, { revenue: 100 }
  ]).length, 8);
});

test("saving a statement deduplicates payouts and totals while archiving its original", () => {
  const originals = [...rows, ...rows.map(row => ({ ...row, customer: "renamed" }))];
  const state = { performanceStatements: [], performanceStatementHistory: [] };
  Object.assign(context, {
    state,
    performanceStatementFor: () => ({ id: "existing", transactions: originals }),
    archivePerformanceStatement: value => state.performanceStatementHistory.push(structuredClone(value)),
    auditActorUsername: () => "test",
    currentPerformancePolicy: () => ({ version: 1 }),
    entityId: () => "new"
  });
  vm.runInContext(app.slice(app.indexOf("function upsertPerformanceStatement("), app.indexOf("function previousCalendarMonth(")), context);
  const saved = context.upsertPerformanceStatement({ month: "2026-09", salon: "Хан-Уул", status: "locked", transactions: originals });
  assert.equal(saved.transactions.length, 3);
  assert.equal(saved.totalCommission, 17908);
  assert.equal(saved.totalRevenue, 245400);
  assert.equal(state.performanceStatementHistory[0].transactions.length, 6);
});

test("locked snapshots use the same deduplication for both report sources", () => {
  assert.match(app, /dedupePerformanceTransactions\(statement.transactions\)\.forEach\(item => result.push/);
  assert.match(app, /dedupePerformanceTransactions\(statement.transactions\)\.forEach\(item => live.push/);
});
