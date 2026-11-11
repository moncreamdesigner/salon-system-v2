import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function helper(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\nfunction ", start + 1));
}
const policy = { version: 1, service: { serviceKinds: ["single", "course"], basis: "paid", rate: 10 }, cashier: { rate: 2, paymentMethods: ["qpay"] } };
const context = vm.createContext({
  performanceCalculationSource: null, performancePolicyForDate: () => policy,
  performanceAssignment: () => false, todayText: () => "2026-11-03",
  state: {}, activeAccount: { salon: "Хан-Уул" },
  performanceVoucherRoleIdForPayment: () => "", performancePaymentEligible: payment => payment.method === "qpay"
});
for (const name of ["isPrepaidServicePending", "completePrepaidService", "serviceTotalAmount", "servicePaidAmount", "performanceTransactionIdentity", "dedupePerformanceTransactions", "cashierCommissionRevenue", "calculatePerformanceTransactions", "profileServiceEditMode"]) vm.runInContext(helper(name), context);
const prepaid = () => ({
  id: "svc-prepaid", kind: "single", title: "Тэжээлийн эмчилгээ", service: "Тэжээлийн эмчилгээ",
  prepaid: true, prepaidPending: true, date: "", staff: "", staffId: null, salon: "Хан-Уул",
  price: 75000, basePrice: 75000, balance: 0, registeredAt: "2026-10-01T09:00:00+08:00", createdAt: "2026-10-01",
  payments: [{ id: "pay-1", amount: 75000, paidAmount: 75000, date: "2026-10-01", method: "qpay" }]
});
const details = { date: "2026-11-03", salon: "Чингэлтэй", staff: "Массажист", staffId: 2 };
function transactions(item) {
  return context.calculatePerformanceTransactions({ sourceState: {
    customers: [{ id: 1, name: "Хэрэглэгч", serviceHistory: [item] }], services: [],
    staff: [{ id: 1, name: "Кассчин", salon: "Хан-Уул" }, { id: 2, name: "Массажист", salon: "Чингэлтэй" }],
    kassSchedules: [{ date: "2026-10-01", salon: "Хан-Уул", staff: "Кассчин" }]
  } });
}

test("prepaid cash reaches the original cashier on payment day without service performance", () => {
  const rows = transactions(prepaid());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, "kass");
  assert.equal(rows[0].date, "2026-10-01");
  assert.equal(rows[0].revenue, 75000);
  assert.equal(rows[0].commission, 1500);
  assert.equal(transactions({ ...prepaid(), staff: "Массажист", staffId: 2 }).length, 1, "Malformed pending data must not produce staff bonus");
});

test("later fulfillment preserves the paid contract and pays only the actual staff on the actual day", () => {
  const old = prepaid();
  const result = context.completePrepaidService(old, details, "2026-11-03T01:00:00Z");
  assert.equal(old.prepaidPending, true, "Pure completion must not mutate the source");
  assert.equal(result.price, 75000);
  assert.equal(result.balance, 0);
  assert.deepEqual(result.payments, old.payments);
  assert.equal(result.registeredAt, old.registeredAt);
  assert.equal(result.salon, "Хан-Уул");
  assert.equal(result.performedSalon, "Чингэлтэй");
  const rows = transactions(result);
  assert.equal(rows.length, 2);
  const cashier = rows.find(row => row.type === "kass");
  assert.equal(cashier.salon, "Хан-Уул");
  assert.equal(cashier.date, "2026-10-01");
  const service = rows.find(row => row.type === "single");
  assert.equal(service.staffId, 2);
  assert.equal(service.date, "2026-11-03");
  assert.equal(service.salon, "Чингэлтэй");
  assert.equal(service.commission, 7500);
  assert.equal(context.profileServiceEditMode(result), "locked");
  assert.throws(() => context.completePrepaidService(result, details));
});

test("fulfillment requires a date and staff and never revives a deleted service", () => {
  assert.throws(() => context.completePrepaidService(prepaid(), { ...details, date: "" }));
  assert.throws(() => context.completePrepaidService(prepaid(), { ...details, staff: "" }));
  assert.throws(() => context.completePrepaidService({ ...prepaid(), deleted: true }, details));
});

test("existing one-time services are unchanged and the compact control does not add a new tab", () => {
  assert.equal(context.isPrepaidServicePending({ kind: "single" }), false);
  assert.equal(transactions({ ...prepaid(), prepaid: false, prepaidPending: false, date: details.date, staff: details.staff, staffId: 2 }).filter(row => row.type === "single").length, 1);
  const registrationForm = helper("renderProfileServiceInlineForm");
  assert.ok(registrationForm.indexOf('id="profileServicePrepaid"') > registrationForm.indexOf('id="profileServiceRoom"'));
  assert.match(registrationForm, /id="profileServicePrepaid"> Төлбөр урьдчилж төлсөн<\/label>/);
  assert.doesNotMatch(registrationForm, /profile-service-tab-row/);
  assert.doesNotMatch(helper("profileServiceTabsHtml"), /Урьдчилсан/);
  assert.match(app, /const date = prepaid \? ""/);
  assert.match(app, /if \(!prepaid\) customer\.last = date/);
  assert.match(app, /if \(!prepaid && date === todayText\(\)\) assignDailyQueue/);
});

test("server analytics preserves prepaid state and excludes pending visits while retaining payments", () => {
  const analytics = fs.readFileSync(new URL("../api/analytics-source.php", import.meta.url), "utf8");
  assert.match(analytics, /'prepaid', 'prepaidPending', 'performedSalon'/);
  for (const file of ["daily-queue.php", "customer-list.php", "dashboard-summary.php"]) {
    const php = fs.readFileSync(new URL(`../api/${file}`, import.meta.url), "utf8");
    assert.match(php, /prepaidPending/);
    assert.match(php, /performedSalon/);
  }
});

test("the real registration handler saves no staff or service date and does not put prepaid customers in the daily queue", () => {
  const listeners = {};
  const checkbox = { checked: true, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const fields = Array.from({ length: 3 }, () => ({ hidden: false, inputs: [{ disabled: false }], querySelectorAll() { return this.inputs; } }));
  const form = {
    querySelector: selector => selector === "#profileServicePrepaid" ? checkbox : null,
    querySelectorAll: selector => selector === "[data-prepaid-hide]" ? fields : [],
    addEventListener: (name, fn) => { listeners[name] = fn; }
  };
  let queued = 0;
  let saved = 0;
  const customer = { id: 1, name: "Тест", groupId: 1, last: "2026-09-01", profileServiceKind: "single", serviceHistory: [] };
  const registration = vm.createContext({
    document: { getElementById: id => id === "profileServiceForm" ? form : null },
    activeAccount: { role: "salon", salon: "Хан-Уул" }, state: { staff: [], audit: [] },
    enhanceNativeSelects: () => {}, updateProfileServicePrice: () => {},
    profileServicePriceParts: () => ({ item: { name: "Тэжээлийн эмчилгээ" }, total: 75000, basePrice: 75000 }),
    todayText: () => "2026-11-03", formValue: () => "", standardServiceName: name => name,
    entityId: kind => kind + "-1", customerCourseEntryStatus: () => null,
    customerBalance: () => 75000, auditNowText: () => "2026-11-03T09:00:00", auditActorUsername: () => "salon",
    assignDailyQueue: () => { queued++; },
    currentTreatmentFromHistory: () => { throw new Error("Pending service must not start treatment"); },
    requireOperationalDateEditable: () => { throw new Error("Pending service has no date to backdate"); },
    saveAndRefreshCustomerProfile: () => { saved++; }
  });
  vm.runInContext(helper("bindProfileServiceInlineForm"), registration);
  registration.bindProfileServiceInlineForm(customer);
  listeners.change({ target: checkbox });
  assert.ok(fields.every(field => field.hidden && field.inputs[0].disabled));
  listeners.submit({ preventDefault() {} });
  const item = customer.serviceHistory[0];
  assert.equal(item.prepaidPending, true);
  assert.equal(item.date, "");
  assert.equal(item.staff, "");
  assert.equal(item.staffId, null);
  assert.equal(item.balance, 75000);
  assert.equal(item.price, 75000);
  assert.equal(customer.last, "2026-09-01");
  assert.equal(queued, 0);
  assert.equal(saved, 1);
  checkbox.checked = false;
  listeners.change({ target: checkbox });
  assert.ok(fields.every(field => !field.hidden && !field.inputs[0].disabled));
});
