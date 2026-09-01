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
    { effectiveFrom: "2026-09-01", workStart: "08:00", workEnd: "18:00", weekendStart: "09:00", weekendEnd: "18:00", workDuration: 30, weekendDuration: 90, workCapacity: 6, weekendCapacity: 2, lunchBreaks: [{ start: "12:00", end: "13:00", count: 2 }, { start: "13:00", end: "14:00", count: 2 }] },
    { effectiveFrom: "2026-10-01", workStart: "10:00", workEnd: "20:00", weekendStart: "10:00", weekendEnd: "20:00", workDuration: 60, weekendDuration: 120, workCapacity: 3, weekendCapacity: 1 },
  ],
};

test("admin schedule resolver preserves the old schedule and activates dated versions", () => {
  const start = app.indexOf("function scheduleConfig");
  const end = app.indexOf("function minutesToTime", start);
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
  assert.equal(context.scheduleConfig(salon.name, "2026-09-05").duration, 90);
  assert.equal(context.scheduleConfig(salon.name, "2026-09-05").capacity, 2);
  assert.equal(context.scheduleConfig(salon.name, "2026-10-01").capacity, 3);
  assert.equal(context.scheduleCapacityAtTime(context.scheduleConfig(salon.name, "2026-09-01"), "11:30"), 6);
  assert.equal(context.scheduleCapacityAtTime(context.scheduleConfig(salon.name, "2026-09-01"), "12:00"), 4);
  assert.equal(context.scheduleCapacityAtTime(context.scheduleConfig(salon.name, "2026-09-01"), "13:30"), 4);
  assert.equal(context.scheduleCapacityAtTime(context.scheduleConfig(salon.name, "2026-10-01"), "12:00"), 3);
  assert.equal(context.scheduleCapacityAtTime({ capacity: 4, lunchBreaks: [{ start: "12:00", end: "14:00", count: 3 }, { start: "13:00", end: "14:00", count: 2 }] }, "13:00"), 0);
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
  assert.equal(context.salonScheduleConfig(salon, new Date(2026, 8, 5)).duration, 90);
  assert.equal(context.salonCapacity(salon, "2026-09-05"), 2);
  assert.equal(context.salonCapacity(salon, "2026-09-01", "12:00"), 4);
  assert.equal(context.salonCapacity(salon, "2026-09-05", "12:00"), 0);
  assert.equal(context.salonCapacity(salon, "2026-09-01", "14:00"), 6);
});

test("server booking, dashboard and SMS paths share the date-effective resolver", () => {
  assert.match(bootstrap, /function salon_schedule_for_date/);
  assert.match(bootstrap, /\$effectiveFrom > \$date/);
  assert.match(dashboard, /salon_schedule_for_date\(\$salon, \$dateText\)/);
  assert.match(sms, /salon_schedule_for_date\(\$salon, \$date->format\('Y-m-d'\)\)/);
  assert.match(bootstrap, /function salon_capacity_for_slot/);
  assert.match(bootstrap, /return max\(0, \$capacity - \$lunchCount\)/);
  assert.match(dashboard, /salon_capacity_for_slot\(\$salon, \$dateText, \$slotTime\)/);
});
