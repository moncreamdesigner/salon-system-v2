import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const pub = fs.readFileSync(new URL("../public.js", import.meta.url), "utf8");
function helper(source, name) { const start = source.indexOf(`function ${name}(`); return source.slice(start, source.indexOf("\nfunction ", start + 1)); }

test("admin and public slot counters both release cancelled and rejected seats", () => {
  const bookings = [{ id: 1, salon: "A", date: "2026-11-20", time: "09:00", status: "confirmed" }, { id: 2, salon: "A", date: "2026-11-20", time: "09:00", status: "pending" }];
  const c = vm.createContext({ IS_LOCAL_RUNTIME: true, state: { bookings }, publicState: { bookings }, salonCapacity: () => 2 });
  vm.runInContext(helper(app, "bookedCountForSlot"), c);
  vm.runInContext(helper(pub, "slotFull"), c);
  const adminCount = () => c.bookedCountForSlot("A", "2026-11-20", "09:00");
  const publicFull = () => c.slotFull({ name: "A" }, "2026-11-20", "09:00");
  assert.equal(adminCount(), 2); assert.equal(publicFull(), true);
  for (const status of ["cancelled", "rejected"]) {
    bookings[1].status = status;
    assert.equal(adminCount(), 1); assert.equal(publicFull(), false);
  }
  bookings[1].status = "confirmed";
  assert.equal(publicFull(), true, "A replacement booking must occupy the released seat");
});

test("fresh occupancy repaints an already-open cashier form without resetting its phone draft", () => {
  const start = app.indexOf('  if (bookingInlineEditingId) {', app.indexOf('function renderBookings('));
  const end = app.indexOf('\n  renderInfoHeader(activeView);', start);
  const slots = [{ id: 1 }, { id: 2 }];
  let updates = 0;
  const form = { dataset: { salonSignature: "A" }, phone: "99112233", querySelectorAll: () => slots };
  const c = vm.createContext({ bookingInlineEditingId: null, document: { getElementById: () => ({ querySelector: () => form }) }, accountSalons: () => [{ name: "A" }], renderBookingTimeOptions: () => { updates++; }, openBookingModal: () => { throw new Error("Draft was reset"); } });
  vm.runInContext(app.slice(start, end), c);
  assert.equal(updates, 2); assert.equal(form.phone, "99112233");
});

test("public availability refreshes on booking interactions/return without interval polling", () => {
  const binding = pub.slice(pub.indexOf('function bindPublicEvents('));
  assert.match(binding, /if \(week\).*refreshActivePublicView\("booking"\)/);
  assert.match(binding, /if \(date\).*refreshActivePublicView\("booking"\)/);
  assert.match(binding, /addEventListener\("focus", refreshBookingOnReturn\)/);
  assert.match(binding, /addEventListener\("visibilitychange", refreshBookingOnReturn\)/);
  assert.doesNotMatch(pub, /setInterval\(/);
  assert.match(app, /if \(bookingDirectoryLoading\) await bookingDirectoryLoading.catch/);
});
