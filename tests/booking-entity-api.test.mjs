import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../api/bookings.php", import.meta.url), "utf8");
const changes = fs.readFileSync(new URL("../api/changes.php", import.meta.url), "utf8");
const recovery = fs.readFileSync(new URL("../api/recovery.php", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const publicApi = fs.readFileSync(new URL("../api/public.php", import.meta.url), "utf8");
const publicApp = fs.readFileSync(new URL("../public.js", import.meta.url), "utf8");

assert.match(api, /FOR UPDATE/, "Booking mutations must lock current server state");
assert.match(api, /SELECT actor_user_id, result_payload FROM app_operations/, "Booking retries must be idempotent");
assert.match(api, /booking_assert_capacity/, "Slot capacity must be checked on the server");
assert.match(api, /booking_assert_slot_rules/, "Schedule, holiday and past-time rules must be checked on the server");
assert.match(api, /booking_holiday_applies/, "Both supported holiday data formats must be checked safely");
assert.match(api, /booking_can_access/, "Salon access must be checked on the server");
assert.match(api, /foreach \(\['salon', 'date', 'time', 'phone'\] as \$field\)/, "Booking updates must accept only explicit editable fields");
assert.match(api, /'source'\s*=>\s*'admin'[\s\S]*'status'\s*=>\s*'confirmed'/, "Admin booking creation must not trust client-controlled source or status");
assert.match(api, /INSERT INTO app_change_events/, "Booking before/after changes must be recoverable");
assert.match(api, /INSERT INTO app_recovery_journal/, "Deleted bookings must enter recovery history");
assert.match(changes, /'booking'\s*=>\s*'bookings'/, "Booking events must support selective restore");
assert.doesNotMatch(recovery, /DELETE FROM app_recovery_journal/, "Reading recovery history must never mutate it");
assert.match(app, /submitBookingOperation\("create"/, "Admin booking creation must use the entity endpoint");
assert.match(app, /submitBookingOperation\("update"/, "Admin booking editing must use the entity endpoint");
assert.match(app, /submitBookingOperation\("status"/, "Booking status must use the entity endpoint");
assert.match(app, /submitBookingOperation\("delete"/, "Booking deletion must use the entity endpoint");
assert.match(app, /booking-cancel[\s\S]*Цуцлах/, "Active bookings must expose a dedicated cancel action");
assert.match(app, /updateBookingStatus\(booking\.id, "cancelled"\)/, "The cancel action must use the server-owned status flow");
assert.match(app, /status === "cancelled"\) return "Цуцлагдсан"/, "Cancelled bookings must render their actual status");
assert.doesNotMatch(app, /state\.bookings\s*=\s*state\.bookings\.filter\(booking\s*=>\s*booking\.status\s*!==\s*"cancelled"\)/, "Cancelled bookings must remain available for status history and filtering");
assert.match(api, /\['pending', 'confirmed', 'cancelled', 'rejected'\]/, "The server must preserve the cancelled booking status");
assert.match(bootstrap, /function booking_max_advance_date/, "The server must define one shared calendar-month booking window");
assert.match(api, /booking_date_within_advance_window/, "Admin bookings must enforce the calendar-month window on the server");
assert.match(publicApi, /booking_date_within_advance_window/, "Public bookings must enforce the same calendar-month window on the server");
assert.match(publicApi, /new DateTimeZone\('Asia\/Ulaanbaatar'\)/, "Public booking date validation must use Mongolia time");
assert.match(app, /max="\$\{bookingMaxDateText\(\)\}"/, "Admin booking dates must expose the one-month maximum in the UI");
assert.match(publicApp, /date > bookingMaxDate\(\)/, "Public booking dates beyond one month must be disabled");

const statusFunction = app.slice(app.indexOf("async function updateBookingStatus"), app.indexOf("let actionCodeDialogOpen"));
assert.doesNotMatch(statusFunction, /saveState\(/, "Booking status must not write the full section");

console.log("booking-entity-api.test: OK");
