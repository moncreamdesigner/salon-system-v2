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
const product = { group: "test", code: "P1", name: "Бараа", price: 100000, sale: 60000, saleNote: "3+", qty: 1 };
const selected = { salon: "Хан-Уул", date: "2026-11-11" };
const campaign = { id: 1, name: "Хямдрал", percent: 20, startDate: "2026-11-01", endDate: "2026-11-30", salons: ["Хан-Уул"], days: ["3"], services: ["products:test:P1:Бараа"] };
function setup(discounts = [campaign]) {
  const policy = { cashier: { rate: 2, paymentMethods: ["qpay"] }, service: { rate: 10, serviceKinds: [] }, employeeDiscount: { enabled: true, percent: 10, applyToDiscountedPrice: true } };
  const c = vm.createContext({ state: { discounts }, activeAccount: { salon: "Хан-Уул" }, pricePolicy: () => policy,
    defaultState: { pricePolicy: policy }, performanceCalculationSource: null, performancePolicyForDate: () => policy,
    performanceAssignment: () => false, performanceVoucherRoleIdForPayment: () => "", performancePaymentEligible: payment => payment.method === "qpay",
    kassRevenueServiceName: () => "Бараа", todayText: () => selected.date, isSalonAccount: () => true });
  for (const name of ["serviceDiscountKey", "kassSaleThreshold", "kassHasSpecialPrice", "kassLineUnitPrice", "activeCampaignDiscount", "productCampaignDiscount", "kassProductPriceParts", "profileKassPricingContext", "employeeDiscountPriceParts", "kassCartPriceParts", "serviceTotalAmount", "servicePaidAmount", "cashierCommissionRevenue", "performanceTransactionIdentity", "dedupePerformanceTransactions", "servicePerformancePaidBase", "calculatePerformanceTransactions", "kassRevenueSourceRows"]) vm.runInContext(helper(name), c);
  return { c, policy };
}
test("campaign reduces only selected products and always replaces the 3+ price", () => {
  const { c } = setup();
  assert.equal(c.kassProductPriceParts(product, 1, selected).unitPrice, 80000);
  assert.equal(c.kassProductPriceParts(product, 3, selected).lineTotal, 240000, "Do not choose or stack the cheaper 3+ offer during a campaign");
  assert.equal(c.kassProductPriceParts({ ...product, code: "P2", name: "Өөр" }, 1, selected).unitPrice, 100000);
  assert.equal(c.kassProductPriceParts({ ...product, name: "Шинэ нэр" }, 1, selected).unitPrice, 80000, "Stable product code keeps a renamed product eligible");
});
test("campaign scope honors salon, weekday, inclusive dates and activation", () => {
  const { c } = setup();
  for (const ctx of [{ ...selected, salon: "Чингэлтэй" }, { ...selected, salon: "" }, { ...selected, date: "2026-11-12" }, { ...selected, date: "2026-10-31" }, { ...selected, date: "2026-12-01" }]) assert.equal(c.kassProductPriceParts(product, 3, ctx).unitPrice, 60000);
  const allDays = setup([{ ...campaign, days: [] }]).c;
  assert.equal(allDays.kassProductPriceParts(product, 1, { ...selected, date: "2026-11-01" }).unitPrice, 80000);
  assert.equal(allDays.kassProductPriceParts(product, 1, { ...selected, date: "2026-11-30" }).unitPrice, 80000);
  assert.equal(setup([{ ...campaign, active: false }]).c.kassProductPriceParts(product, 1, selected).unitPrice, 100000);
});
test("overlapping campaigns select the largest percentage without compounding; zero-price campaigns remain zero", () => {
  const { c } = setup([campaign, { ...campaign, id: 2, percent: 30 }]);
  assert.equal(c.kassProductPriceParts(product, 1, selected).unitPrice, 70000);
  assert.equal(setup([{ ...campaign, percent: 100 }]).c.kassProductPriceParts(product, 1, selected).lineTotal, 0);
});
test("cart combines discounted and undiscounted products and keeps employee stacking policy", () => {
  const { c, policy } = setup();
  const cart = [product, { group: "test", code: "P2", name: "Өөр", price: 50000, qty: 1 }];
  const standard = c.kassCartPriceParts({ type: "Хэрэглэгч" }, cart, selected);
  assert.equal(standard.originalTotal, 150000);
  assert.equal(standard.productDiscountAmount, 20000);
  assert.equal(standard.total, 130000);
  assert.equal(c.kassCartPriceParts({ type: "Ажилтан" }, cart, selected).total, 117000);
  policy.employeeDiscount.applyToDiscountedPrice = false;
  assert.equal(c.kassCartPriceParts({ type: "Ажилтан" }, cart, selected).total, 125000);
});
function sale() { return { id: "sale", kind: "kass", date: selected.date, salon: selected.salon, price: 80000, basePrice: 100000, balance: 0, cashierCommissionBasisVersion: 1, cashierCommissionBase: 100000, payments: [{ id: "pay", date: selected.date, method: "qpay", amount: 80000, paidAmount: 80000 }] }; }
function report(c, item) { return { customers: [{ id: 1, name: "Хэрэглэгч", serviceHistory: [item] }], staff: [{ id: 1, name: "Кассчин", salon: selected.salon }], kassSchedules: [{ date: selected.date, salon: selected.salon, staff: "Кассчин" }], services: [] }; }
test("cash revenue stays at the discounted receipt while staff commission uses the undiscounted base", () => {
  const { c } = setup();
  const data = report(c, sale());
  assert.equal(c.kassRevenueSourceRows(data)[0].amount, 80000);
  const row = c.calculatePerformanceTransactions({ sourceState: data })[0];
  assert.equal(row.revenue, 100000);
  assert.equal(row.commission, 2000);
});
test("partial payments allocate the base proportionally and do not double-count it", () => {
  const { c } = setup();
  const item = sale();
  item.payments = [{ id: "pay1", date: selected.date, method: "qpay", amount: 40000, paidAmount: 40000 }, { id: "pay2", date: selected.date, method: "qpay", amount: 40000, paidAmount: 40000 }];
  const rows = c.calculatePerformanceTransactions({ sourceState: report(c, item) });
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.commission, 0), 2000);
  item.payments = [item.payments[0]];
  item.balance = 40000;
  assert.equal(c.calculatePerformanceTransactions({ sourceState: report(c, item) })[0].commission, 1000);
});
test("existing transactions and excluded methods keep their old payout rules", () => {
  const { c } = setup();
  const old = sale();
  delete old.cashierCommissionBasisVersion;
  delete old.cashierCommissionBase;
  assert.equal(c.calculatePerformanceTransactions({ sourceState: report(c, old) })[0].commission, 1600);
  const excluded = sale();
  excluded.payments[0].method = "previous_payment";
  assert.equal(c.calculatePerformanceTransactions({ sourceState: report(c, excluded) }).length, 0);
});
test("the registration handler persists the same quote and original commission base", () => {
  const { c } = setup();
  let submit;
  const form = { querySelectorAll: () => [], querySelector: () => null, addEventListener: (type, fn) => { if (type === "submit") submit = fn; } };
  const customer = { id: 1, groupId: 1, profileKassCart: [product], serviceHistory: [] };
  Object.assign(c, { enhanceNativeSelects: () => {}, bindProfileKassCartControls: () => {}, formValue: id => id === "profileKassSalon" ? selected.salon : selected.date,
    requireOperationalDateEditable: () => true, entityId: () => "new-sale", collapseCustomerServicePanels: () => {}, customerBalance: () => 80000, saveAndRefreshCustomerProfile: () => {} });
  vm.runInContext(helper("bindProfileKassInlineForm"), c);
  c.bindProfileKassInlineForm(customer, form);
  submit({ preventDefault() {} });
  const item = customer.serviceHistory[0];
  assert.equal(item.price, 80000);
  assert.equal(item.balance, 80000);
  assert.equal(item.cashierCommissionBase, 100000);
  assert.equal(item.products[0].unitPrice, 80000);
  assert.equal(item.products[0].campaignDiscount.id, campaign.id);
  assert.equal(item.productDiscountAmount, 20000);
});
test("profile quote changes on branch/date changes; compact analytics keeps the payout snapshot", () => {
  assert.match(helper("bindProfileKassInlineForm"), /\["profileKassSalon", "profileKassDate"\][\s\S]*?renderProfile\(\)/);
  const php = fs.readFileSync(new URL("../api/analytics-source.php", import.meta.url), "utf8");
  assert.match(php, /'cashierCommissionBasisVersion', 'cashierCommissionBase'/);
});
