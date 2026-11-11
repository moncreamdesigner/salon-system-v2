import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function helper(name) { const start = app.indexOf(`function ${name}(`); assert.ok(start >= 0, name); return app.slice(start, app.indexOf("\nfunction ", start + 1)); }
const course = { code: "C1", name: "Курс", price: 949900, visits: "8 удаа", singleVisitPrice: 175000 };
const single = { code: "S1", name: "Нэг удаа", price: 100000 };
const campaign = { id: 8, name: "Нэр нь дурын байж болно", percent: 30, startDate: "2026-11-11", endDate: "2026-11-17", salons: ["Хан-Уул", "Чингэлтэй"], days: [], services: ["course:C1:Курс", "single:S1:Нэг удаа"] };
function setup() {
  const fields = { profileServiceDate: "2026-11-11", profileServiceSalon: "Хан-Уул", profileServiceRoom: "standard", profileServiceStaff: "Ажилтан" };
  const policy = { employeeDiscount: { enabled: false }, service: { serviceKinds: ["course", "single"], basis: "paid", rate: 10 }, cashier: { rate: 2, paymentMethods: ["qpay"] } };
  const c = vm.createContext({
    state: { discounts: [structuredClone(campaign)], staff: [{ id: 2, name: "Ажилтан", salon: "Хан-Уул" }], audit: [] }, activeAccount: { role: "admin", salon: "" },
    todayText: () => fields.profileServiceDate, formValue: id => fields[id] || "", document: { getElementById: () => ({ value: "0", checked: false }) },
    serviceOptionsForKind: kind => [kind === "course" ? course : single], pricePolicy: () => policy, defaultState: { pricePolicy: policy },
    standardServiceName: name => name, isMasterStaffName: () => false, performanceCalculationSource: null,
    performancePolicyForDate: () => policy, performanceAssignment: () => false, performancePaymentEligible: () => true, performanceVoucherRoleIdForPayment: () => "",
    kassRevenueServiceName: () => "Курс"
  });
  for (const name of ["serviceDiscountKey", "activeCampaignDiscount", "employeeDiscountPriceParts", "profileServicePriceParts", "courseVisitExtras", "serviceTotalAmount", "servicePaidAmount", "servicePerformancePaidBase", "cashierCommissionRevenue", "isPrepaidServicePending", "performanceTransactionIdentity", "dedupePerformanceTransactions", "calculatePerformanceTransactions", "kassRevenueSourceRows", "configuredCourseSingleVisitPrice", "coursePriceSnapshot", "parseVisitCount", "courseEligiblePaidAmount", "courseTransferInfo"]) vm.runInContext(helper(name), c);
  return { c, fields };
}
function storedCourse() { return { id: "course", kind: "course", service: "Курс", salon: "Хан-Уул", date: "2026-11-11", basePrice: 949900, price: 949900, visitsTotal: 8, singleVisitPrice: 175000, campaignDiscountAmount: 284970, campaignDiscount: { id: 8, percent: 30, serviceKey: "course:C1:Курс" }, serviceCommissionBasisVersion: 1, employeeDiscountAmount: 0, visits: [], balance: 664930, payments: [] }; }
test("the selected 949,900 course becomes 664,930 with a generic 30% rule", () => {
  const { c } = setup();
  const quote = c.profileServicePriceParts({ profileServiceKind: "course" });
  assert.equal(quote.basePrice, 949900);
  assert.equal(quote.campaignDiscountAmount, 284970);
  assert.equal(quote.total, 664930);
  assert.equal(quote.campaignDiscount.serviceKey, "course:C1:Курс");
  c.state.discounts[0].percent = 15;
  assert.equal(c.profileServicePriceParts({ profileServiceKind: "course" }).total, 807415, "Use configured percent, never a hardcoded event price");
});
test("only checked items in the matching kind, salon and date are discounted", () => {
  const { c, fields } = setup();
  assert.equal(c.profileServicePriceParts({ profileServiceKind: "single" }).total, 70000);
  c.state.discounts[0].services = ["single:S1:Нэг удаа"];
  assert.equal(c.profileServicePriceParts({ profileServiceKind: "course" }).total, 949900);
  fields.profileServiceSalon = "Өөр салбар";
  assert.equal(c.profileServicePriceParts({ profileServiceKind: "single" }).total, 100000);
  fields.profileServiceSalon = "Чингэлтэй";
  fields.profileServiceDate = "2026-11-18";
  assert.equal(c.profileServicePriceParts({ profileServiceKind: "single" }).total, 100000);
});
test("course registration persists the discounted debt and unchanged original price snapshot", () => {
  const { c, fields } = setup();
  let submit;
  const events = {};
  const form = { querySelector: () => null, querySelectorAll: () => [], addEventListener: (type, fn) => { if (type === "submit") submit = fn; } };
  const salonInput = { addEventListener: (type, fn) => { events[type] = fn; } };
  c.document.getElementById = id => id === "profileServiceForm" ? form : id === "profileServiceSalon" ? salonInput : null;
  let refreshes = 0;
  Object.assign(c, { enhanceNativeSelects: () => {}, updateProfileServicePrice: () => { refreshes++; }, requireOperationalDateEditable: () => true,
    entityId: () => "course-new", assignDailyQueue: () => {}, currentTreatmentFromHistory: () => ({}), customerCourseEntryStatus: () => ({ kind: "course", done: 0, total: 8 }),
    customerBalance: () => 664930, auditNowText: () => fields.profileServiceDate, auditActorUsername: () => "test", saveAndRefreshCustomerProfile: () => {} });
  vm.runInContext(helper("bindProfileServiceInlineForm"), c);
  const customer = { id: 1, name: "Test", groupId: 1, profileServiceKind: "course", serviceHistory: [] };
  c.bindProfileServiceInlineForm(customer);
  const previousRefreshes = refreshes;
  events.change({ target: { value: fields.profileServiceSalon } });
  assert.equal(refreshes, previousRefreshes + 1, "Course has no staff input but changing salon must still update price");
  submit({ preventDefault() {} });
  const item = customer.serviceHistory[0];
  assert.equal(item.basePrice, 949900);
  assert.equal(item.priceSnapshot.basePrice, 949900);
  assert.equal(item.balance, 664930);
  assert.equal(c.serviceTotalAmount(item), 664930);
  assert.equal(item.campaignDiscountAmount, 284970);
});
test("stored course keeps its enrollment discount after the event ends or is edited", () => {
  const { c, fields } = setup();
  const item = storedCourse();
  fields.profileServiceDate = "2027-01-01";
  c.state.discounts = [];
  const quote = c.profileServicePriceParts({ profileServiceEditingIndex: 0, serviceHistory: [item] });
  assert.equal(quote.total, 664930);
  assert.equal(quote.campaignDiscountAmount, 284970);
  assert.equal(c.serviceTotalAmount({ ...item, visits: [{ vipRoomFee: 20000 }] }), 684930, "Visit extras stay separate from the base-price campaign");
  assert.equal(c.serviceTotalAmount({ ...item, campaignDiscountAmount: 0, campaignDiscount: null, serviceCommissionBasisVersion: 0 }), 949900, "Old contracts are never repriced from current campaigns");
});
test("course service bonus uses the original per-visit price while cash is the actual discounted payment", () => {
  const { c } = setup();
  const item = storedCourse();
  item.balance = 0;
  item.payments = [{ id: "pay", date: item.date, method: "qpay", amount: 664930, paidAmount: 664930 }];
  item.visits = [{ id: "visit", number: 1, date: item.date, staff: "Ажилтан", staffId: 2, salon: item.salon }];
  const data = { customers: [{ id: 1, name: "Test", serviceHistory: [item] }], staff: c.state.staff, services: [], kassSchedules: [] };
  assert.equal(c.kassRevenueSourceRows(data)[0].amount, 664930);
  const row = c.calculatePerformanceTransactions({ sourceState: data })[0];
  assert.equal(row.revenue, 949900 / 8);
  assert.equal(row.commission, Math.round(949900 / 8 * .1));
  assert.equal(c.courseTransferInfo(item).available, 664930 - 175000, "Closing must use discounted money, not create phantom credit");
  item.payments[0].amount = item.payments[0].paidAmount = 332465;
  item.balance = 332465;
  assert.equal(c.servicePerformancePaidBase(item), 949900 / 2);
});
