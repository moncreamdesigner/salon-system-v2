import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function renderBookings(");
const render = app.slice(start, app.indexOf("\nfunction ", start + 1));

test("branch accounts hide the salon header even while loading and admin switching restores it", () => {
  const elements = { bookingsView: { isConnected: true }, bookingSalonColumn: {}, bookingRows: {}, bookingPagination: {}, bookingInlineSlot: {} };
  let branch = true;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] }, isSalonAccount: () => branch,
    renderSalons() {}, IS_LOCAL_RUNTIME: false, bookingDirectoryLoaded: false,
    bookingDirectoryLoading: true
  });
  vm.runInContext(render, context);
  context.renderBookings();
  assert.equal(elements.bookingSalonColumn.hidden, true);
  assert.match(elements.bookingRows.innerHTML, /colspan="8"/);
  branch = false;
  context.renderBookings();
  assert.equal(elements.bookingSalonColumn.hidden, false);
  assert.match(elements.bookingRows.innerHTML, /colspan="9"/);
});

test("only the salon data cell is hidden and editor/empty states use the visible column count", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<table class="booking-table booking-list-table">[\s\S]*?<th id="bookingSalonColumn">Салон<\/th>/);
  assert.equal((html.match(/id="bookingSalonColumn"/g) || []).length, 1);
  assert.match(render, /<td\$\{hideSalon \? " hidden" : ""\}>\$\{booking.salon\}<\/td>/);
  assert.equal((render.match(/colspan="\$\{columnCount\}"/g) || []).length, 3);
  assert.match(render, /bookingStatusLabel\(booking.status\)/);
  assert.match(render, /bookingAttendanceLabel\(booking\)/);
});

test("booking date stays complete on the first line and weekday occupies the second", () => {
  const context = vm.createContext({ dateWithWeekday: () => "2026-11-14 · Бямба", htmlSafe: String });
  const start = app.indexOf("function bookingDateCell(");
  vm.runInContext(app.slice(start, app.indexOf("\nfunction ", start + 1)), context);
  assert.equal(context.bookingDateCell("2026-11-14"), '<span class="booking-date-value">2026-11-14</span><span class="booking-date-weekday">Бямба</span>');
  assert.match(render, /<td class="booking-date-cell">\$\{bookingDateCell\(booking.date\)\}<\/td>/);
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.booking-date-value,[\s\S]*?\.booking-date-weekday\s*\{\s*display: block;\s*white-space: nowrap;/);
  assert.match(css, /\.booking-list-table \[hidden\]\s*\{\s*display: none !important;/);
});
