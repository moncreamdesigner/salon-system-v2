import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const bookingApi = fs.readFileSync(new URL("../api/bookings.php", import.meta.url), "utf8");
const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");

const editor = app.slice(
  app.indexOf("function openBookingModal"),
  app.indexOf("function bindEvents")
);
const bookingSubmit = app.slice(
  app.indexOf("async function submitBookingOperation"),
  app.indexOf("async function updateBookingStatus")
);

assert.match(
  editor,
  /requestedEdit\s*&&\s*!editing[\s\S]*Шинэ цаг болгон бүртгээгүй[\s\S]*return;/,
  "A missing edit target must fail closed instead of rendering create mode"
);
assert.match(
  editor,
  /form\.querySelectorAll\("\.booking-slot-row"\)/,
  "Booking submission must count only rows owned by the active form"
);
assert.doesNotMatch(
  editor,
  /Array\.from\(document\.querySelectorAll\("\.booking-slot-row"\)\)\.map/,
  "Booking submission must not collect slot rows globally"
);
assert.match(
  bookingSubmit,
  /bookingMutationInFlight \+= 1[\s\S]*localStateMutationVersion \+= 1[\s\S]*bookingMutationInFlight = Math\.max/,
  "A booking mutation must invalidate stale refreshes and release its refresh lock"
);
assert.match(
  app,
  /serverSavePending \|\| bookingMutationInFlight > 0/,
  "Periodic refresh must wait for booking mutations"
);
assert.match(
  app,
  /filter\(key => key !== "bookings"\)/,
  "Production generic state writes must exclude the booking section"
);

assert.match(
  bookingApi,
  /booking_unique_id\(\$bookings\)/,
  "The server must own every new booking id"
);
assert.match(
  bookingApi,
  /bookingGroupId[\s\S]*slotIndex[\s\S]*slotCount/,
  "Slots created together must retain a stable group identity"
);
assert.match(
  bookingApi,
  /booking_id_count\(\$bookings, \$id\) > 1/,
  "Editing a legacy duplicate id must stop instead of updating an arbitrary row"
);
assert.match(
  stateApi,
  /array_key_exists\('bookings', \$sections\)[\s\S]*bookingEndpointRequired/,
  "The generic state endpoint must reject whole-section booking writes"
);

console.log("booking-edit-regression.test: OK");
