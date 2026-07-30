import assert from "node:assert/strict";
import fs from "node:fs";

const publicApi = fs.readFileSync(new URL("../api/public.php", import.meta.url), "utf8");
const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const storage = fs.readFileSync(new URL("../api/booking-storage.php", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const rolling = fs.readFileSync(new URL("../api/rolling-backups.php", import.meta.url), "utf8");
const full = fs.readFileSync(new URL("../api/full-backups.php", import.meta.url), "utf8");

assert.match(storage, /BOOKING_ACTIVE_RETENTION_YEARS = 2/, "Bookings must remain active for at least two years");
assert.match(storage, /INSERT INTO app_booking_archive[\s\S]*ON DUPLICATE KEY UPDATE/, "Old bookings must be durably archived before leaving active state");
assert.doesNotMatch(storage, /INSERT IGNORE INTO app_booking_archive/, "Archive errors must never be silently ignored");
assert.doesNotMatch(publicApi, /archive_old_booking_rows/, "Public booking writes must stay lightweight");
assert.doesNotMatch(stateApi, /archive_old_booking_rows/, "Admin state writes must stay lightweight");
assert.match(storage, /function archive_expired_bookings_maintenance/, "Booking archival must run as isolated maintenance");
assert.match(rolling, /archive_expired_bookings_maintenance\(\$pdo\)/, "Server cron must perform booking archival after backup");
assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_booking_archive/, "Booking archive table is required");
assert.match(rolling, /'bookingArchive'\s*=>/, "Rolling backups must include the booking archive");
assert.match(rolling, /DELETE FROM app_booking_archive/, "Rolling restore must restore archived bookings as one snapshot");
assert.match(full, /'app_booking_archive'/, "Full backups must include the booking archive");

console.log("booking-retention.test: OK");
