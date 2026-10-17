import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function source(from, to) { return app.slice(app.indexOf(`function ${from}(`), app.indexOf(`function ${to}(`)); }
function setup() {
  const fields = { profileServiceDate: "2026-10-20", profileServiceRoom: "standard" };
  const ctx = vm.createContext({
    todayText: () => "2026-10-25",
    standardServiceName: name => name,
    serviceAudienceForCustomer: () => "Том хүн",
    serviceSettingsData: { single: [], course: [] },
    formValue: name => fields[name] || "",
    document: { getElementById: () => ({ value: "0" }) },
    pricePolicy: () => ({}),
    isMasterStaffName: () => false,
    employeeDiscountPriceParts: (_customer, total) => ({ total, amount: 0, percent: 0 })
  });
  for (const block of [source("servicePriceAtDate", "updateServiceFormMode"), source("configuredCourseSingleVisitPrice", "courseTransferInfo"), source("courseVisitExtras", "servicePaidAmount"), source("profileServicePriceParts", "profileServicePriceBreakdownHtml"), source("serviceOptionsForKind", "serviceOptionLabel"), source("parseVisitCount", "staffOptionHtml")]) vm.runInContext(block, ctx);
  return ctx;
}
const original = { name: "Курс", customer: "Том хүн", price: 540000, singleVisitPrice: 75000, visits: "8 удаа" };
const newPrice = { ...original, price: 650000, singleVisitPrice: 90000 };

test("Oct 20 prices activate at the boundary without overwriting the old baseline", () => {
  const ctx = setup();
  const catalog = ctx.withServicePriceVersion(original, newPrice, "2026-10-20");
  assert.equal(catalog.price, 540000);
  assert.equal(ctx.servicePriceAtDate(catalog, "2026-10-19").price, 540000);
  assert.equal(ctx.servicePriceAtDate(catalog, "2026-10-20").price, 650000);
  assert.equal(ctx.servicePriceAtDate(catalog, "2026-11-01").singleVisitPrice, 90000);
  assert.equal(original.priceVersions, undefined);
});

test("additional future versions and resaving one date retain all prior prices", () => {
  const ctx = setup();
  let item = ctx.withServicePriceVersion(original, newPrice, "2026-10-20");
  item = ctx.withServicePriceVersion(item, { ...newPrice, price: 700000 }, "2026-11-01");
  item = ctx.withServicePriceVersion(item, { ...newPrice, price: 660000 }, "2026-10-20");
  assert.equal(item.priceVersions.length, 2);
  assert.equal(ctx.servicePriceAtDate(item, "2026-10-21").price, 660000);
  assert.equal(ctx.servicePriceAtDate(item, "2026-11-01").price, 700000);
  assert.equal(ctx.servicePriceAtDate(item, "2026-10-01").price, 540000);
});

test("legacy unfinished courses use the enrollment-date closure price", () => {
  const ctx = setup();
  ctx.serviceSettingsData.course = [ctx.withServicePriceVersion(original, newPrice, "2026-10-20")];
  const course = { kind: "course", title: "Курс", date: "2026-10-19", basePrice: 540000, visitsTotal: 8, balance: 200000, visits: [] };
  assert.equal(ctx.configuredCourseSingleVisitPrice(course), 75000);
  const snapshot = ctx.coursePriceSnapshot(course);
  assert.equal(snapshot.singleVisitPrice, 75000);
  assert.equal(snapshot.visitsTotal, 8);
  assert.equal(ctx.configuredCourseSingleVisitPrice({ ...course, priceSnapshot: snapshot, date: "2026-10-25" }), 75000);
  assert.equal(ctx.configuredCourseSingleVisitPrice({ ...course, date: "2026-10-20", basePrice: 650000 }), 90000);
});

test("editing an existing course keeps its price, discount, and visit extras after the increase", () => {
  const ctx = setup();
  ctx.serviceSettingsData.course = [ctx.withServicePriceVersion(original, newPrice, "2026-10-20")];
  const course = { kind: "course", title: "Курс", date: "2026-10-10", basePrice: 540000, price: 550000, employeeDiscountAmount: 54000, employeeDiscountPercent: 10, visits: [{ vipRoomFee: 10000 }], visitsTotal: 8 };
  const result = ctx.profileServicePriceParts({ profileServiceEditingIndex: 0, serviceHistory: [course] });
  assert.equal(result.basePrice, 540000);
  assert.equal(result.total, 496000);
  assert.equal(result.employeeDiscountAmount, 54000);
});

test("new course and single registrations use the selected service date", () => {
  const ctx = setup();
  ctx.serviceSettingsData.course = [ctx.withServicePriceVersion(original, newPrice, "2026-10-20")];
  assert.equal(ctx.serviceOptionsForKind("course", {}, "2026-10-19")[0].price, 540000);
  assert.equal(ctx.profileServicePriceParts({ profileServiceKind: "course" }).basePrice, 650000);
  ctx.serviceSettingsData.single = [ctx.withServicePriceVersion({ ...original, price: 75000 }, { ...original, price: 90000 }, "2026-10-20")];
  assert.equal(ctx.serviceOptionsForKind("single", {}, "2026-10-19")[0].price, 75000);
  assert.equal(ctx.serviceOptionsForKind("single", {}, "2026-10-20")[0].price, 90000);
});

test("brand-new future services are hidden until their first effective date", () => {
  const ctx = setup();
  ctx.serviceSettingsData.course = [ctx.withServicePriceVersion(null, newPrice, "2026-10-20")];
  assert.equal(ctx.serviceOptionsForKind("course", {}, "2026-10-19").length, 0);
  assert.equal(ctx.serviceOptionsForKind("course", {}, "2026-10-20").length, 1);
});
