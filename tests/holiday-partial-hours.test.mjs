import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const publicApp = fs.readFileSync(new URL("../public.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const bookings = fs.readFileSync(new URL("../api/bookings.php", import.meta.url), "utf8");
const publicApi = fs.readFileSync(new URL("../api/public.php", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../api/dashboard-summary.php", import.meta.url), "utf8");
const sms = fs.readFileSync(new URL("../api/sms-service.php", import.meta.url), "utf8");

test("admin treats legacy holidays as closed and partial holidays as working hours", () => {
  const start = app.indexOf("function holidayMatches");
  const end = app.indexOf("function holidayForDate", start);
  const context = {
    state: {
      holidays: [
        { salon: "Салбар 1", date: "2026-09-20", name: "Бүтэн амралт" },
        { salon: "Салбар 1", date: "2026-09-21", mode: "partial", workStart: "10:00", workEnd: "15:00" },
      ],
    },
    timeToMinutes(value) {
      const [hours, minutes] = String(value).split(":").map(Number);
      return hours * 60 + minutes;
    },
  };
  vm.runInNewContext(app.slice(start, end), context);
  assert.equal(context.isHolidayClosed("Салбар 1", "2026-09-20"), true);
  assert.equal(context.isHolidayClosed("Салбар 1", "2026-09-21"), false);
  assert.deepEqual({ ...context.holidayWorkingHours("Салбар 1", "2026-09-21") }, { start: "10:00", end: "15:00" });
});

test("public booking uses the same full-day and partial-day distinction", () => {
  const start = publicApp.indexOf("function publicHolidayMatches");
  const end = publicApp.indexOf("function dateIsPast", start);
  const context = {
    publicState: {
      holidays: [
        { salon: "Салбар 1", date: "2026-09-20" },
        { salon: "Салбар 1", date: "2026-09-21", mode: "partial", workStart: "10:00", workEnd: "15:00" },
      ],
    },
    publicTimeMinutes(value) {
      const [hours, minutes] = String(value).split(":").map(Number);
      return hours * 60 + minutes;
    },
  };
  vm.runInNewContext(publicApp.slice(start, end), context);
  const salon = { name: "Салбар 1" };
  assert.equal(context.dateHoliday(salon, "2026-09-20"), true);
  assert.equal(context.dateHoliday(salon, "2026-09-21"), false);
  assert.deepEqual({ ...context.holidayWorkingHours(salon, "2026-09-21") }, { start: "10:00", end: "15:00" });
});

test("every server-side booking and reporting path consumes the shared holiday-hour rule", () => {
  assert.match(bootstrap, /function holiday_hours_for_date/);
  assert.match(bootstrap, /function holiday_working_hours/);
  assert.match(bookings, /holiday_hours_for_date\(\$holidays/);
  assert.match(publicApi, /holiday_hours_for_date\(\$holidays/);
  assert.match(dashboard, /holiday_hours_for_date\(\$holidays/);
  assert.match(sms, /holiday_hours_for_date\(sms_section_rows\(\$pdo, 'holidays'\)/);
});
