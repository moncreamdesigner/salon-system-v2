import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const publicApp = fs.readFileSync(new URL("../public.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../api/dashboard-summary.php", import.meta.url), "utf8");
const sms = fs.readFileSync(new URL("../api/sms-service.php", import.meta.url), "utf8");

const salon = {
  name: "Тест салбар",
  slotCapacity: 4,
  schedule: { workStart: "09:00", workEnd: "19:00", weekendStart: "10:00", weekendEnd: "19:00", duration: 60 },
  scheduleVersions: [
    { effectiveFrom: "2026-09-01", workStart: "08:00", workEnd: "18:00", weekendStart: "09:00", weekendEnd: "18:00", duration: 30, capacity: 6 },
    { effectiveFrom: "2026-10-01", workStart: "10:00", workEnd: "20:00", weekendStart: "10:00", weekendEnd: "20:00", duration: 60, capacity: 3 },
  ],
};

test("admin schedule resolver preserves the old schedule and activates dated versions", () => {
  const start = app.indexOf("function scheduleConfig");
  const end = app.indexOf("function timeToMinutes", start);
  const context = {
    state: { salons: [structuredClone(salon)] },
    selectedScheduleSalonName: () => salon.name,
    todayText: () => "2026-08-27",
    ensureSalonSchedule: item => item.schedule,
  };
  vm.runInNewContext(app.slice(start, end), context);
  assert.equal(context.scheduleConfig(salon.name, "2026-08-31").workStart, "09:00");
  assert.equal(context.scheduleConfig(salon.name, "2026-09-01").workStart, "08:00");
  assert.equal(context.scheduleConfig(salon.name, "2026-09-30").capacity, 6);
  assert.equal(context.scheduleConfig(salon.name, "2026-10-01").capacity, 3);
});

test("public booking resolver uses the same effective-date rule", () => {
  const start = publicApp.indexOf("function salonScheduleConfig");
  const end = publicApp.indexOf("function renderSalonDetail", start);
  const context = {
    Date,
    dateText: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  };
  vm.runInNewContext(publicApp.slice(start, end), context);
  assert.equal(context.salonScheduleConfig(salon, new Date(2026, 7, 31)).workStart, "09:00");
  assert.equal(context.salonScheduleConfig(salon, new Date(2026, 8, 1)).workStart, "08:00");
  assert.equal(context.salonCapacity(salon, "2026-09-15"), 6);
});

test("server booking, dashboard and SMS paths share the date-effective resolver", () => {
  assert.match(bootstrap, /function salon_schedule_for_date/);
  assert.match(bootstrap, /\$effectiveFrom > \$date/);
  assert.match(dashboard, /salon_schedule_for_date\(\$salon, \$dateText\)/);
  assert.match(sms, /salon_schedule_for_date\(\$salon, \$date->format\('Y-m-d'\)\)/);
});
