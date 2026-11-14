import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../api/booking-attendance.php", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../api/booking-list.php", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = app.indexOf("function localBookingAttendance(");
const source = app.slice(start, app.indexOf("\nfunction bookingSourceText", start));
const context = vm.createContext({ IS_LOCAL_RUNTIME: false });
vm.runInContext(source, context);
const booking = { date: "2026-11-14", phone: "99112233", salon: "B", status: "confirmed" };
const service = { kind: "single", date: booking.date, salon: "A", performedSalon: "B", staff: "Staff" };
const customers = [{ phone: booking.phone, serviceHistory: [service] }];
const check = (b, c, day) => context.localBookingAttendance(b, c, day);

test("attendance distinguishes arrival, waiting, past no-show and cancellation", () => {
  assert.equal(check(booking, customers, booking.date), "arrived");
  assert.equal(check(booking, [], booking.date), "waiting");
  assert.equal(check(booking, [], "2026-11-15"), "missed");
  assert.equal(check(booking, customers, "2026-11-13"), "waiting");
  assert.equal(check({ ...booking, status: "cancelled" }, customers, "2026-11-15"), "excluded");
  assert.equal(check({ ...booking, phone: "9911 2233" }, customers, booking.date), "arrived");
  assert.equal(check({ ...booking, salon: "A" }, customers, booking.date), "waiting");
  assert.equal(check({ ...booking, phone: "99112234" }, customers, booking.date), "waiting");
});

test("cash, prepaid payments, deleted records and unperformed services are not arrivals", () => {
  for (const override of [{ kind: "kass" }, { kind: "diagnosis" }, { prepaidPending: true }, { deleted: true }, { deletedAt: booking.date }, { staff: "" }]) {
    assert.equal(check(booking, [{ phone: booking.phone, serviceHistory: [{ ...service, ...override }] }], booking.date), "waiting");
  }
  assert.equal(check(booking, [{ ...customers[0], deleted: true }], booking.date), "waiting");
  const course = { kind: "course", salon: "A", visits: [{ date: booking.date, salon: "B", staff: "Staff" }] };
  assert.equal(check(booking, [{ phone: booking.phone, serviceHistory: [course] }], booking.date), "arrived");
  course.visits[0].deleted = true;
  assert.equal(check(booking, [{ phone: booking.phone, serviceHistory: [course] }], booking.date), "waiting");
});

test("production attendance is scoped, bounded, read-only and separate from booking status", () => {
  assert.match(html, /<th>Төлөв<\/th><th>Ирц<\/th><th>Үйлдэл<\/th>/);
  assert.match(app, /bookingStatusLabel\(booking.status\)[\s\S]*?bookingAttendanceLabel\(booking\)/);
  assert.match(app, /booking-inline-edit-row.*colspan="9"/);
  assert.ok(list.indexOf("array_slice($filtered") < list.indexOf("booking_list_with_attendance($pdo"));
  assert.match(api, /c\.phone IN \(\$phoneParams\)/);
  assert.match(api, /v\.visit_date IN \(\$dateParams\)/);
  assert.match(api, /entity_projection_ready\(\$pdo\)/);
  assert.doesNotMatch(api, /\b(?:INSERT|UPDATE|DELETE)\b|section_key = 'customers'/);
  assert.match(app, /revision.php\?sections=bookings,customers/);
  assert.match(app, /remoteAttendanceRevision !== bookingAttendanceRevision \|\| bookingAttendanceDay !== todayText\(\)/);
  assert.match(context.bookingAttendanceLabel({ attendance: "arrived" }), /Ирсэн/);
  assert.match(context.bookingAttendanceLabel({}), /Шалгагдаагүй/);
});
