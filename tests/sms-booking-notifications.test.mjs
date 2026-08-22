import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../api/sms-service.php", import.meta.url), "utf8");
const settingsApi = fs.readFileSync(new URL("../api/sms-settings.php", import.meta.url), "utf8");
const reminders = fs.readFileSync(new URL("../api/sms-reminders.php", import.meta.url), "utf8");
const bookings = fs.readFileSync(new URL("../api/bookings.php", import.meta.url), "utf8");
const publicApi = fs.readFileSync(new URL("../api/public.php", import.meta.url), "utf8");
const fullBackups = fs.readFileSync(new URL("../api/full-backups.php", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("SMS configuration and outbox are server-owned and recoverable", () => {
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_sms_settings/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_sms_messages/);
  assert.match(bootstrap, /dedupe_key VARCHAR\(190\) NOT NULL UNIQUE/);
  assert.match(bootstrap, /'schema_version', '7'/);
  assert.match(fullBackups, /'app_sms_settings'/);
  assert.match(fullBackups, /'app_sms_messages'/);
});

test("token stays encrypted and is never returned by the admin API", () => {
  assert.match(service, /aes-256-gcm/);
  assert.match(settingsApi, /unset\(\$settings\['token'\]\)/);
  assert.match(settingsApi, /sms_encrypt_token\(\$token\)/);
  assert.doesNotMatch(app, /settings\.token\b/);
});

test("all booking lifecycle events have independent controls and templates", () => {
  for (const event of ["created", "confirmed", "changed", "cancelled", "reminder"]) {
    assert.match(service, new RegExp(`'${event}'\\s*=>`));
    assert.match(html, new RegExp(`data-sms-event="${event}"`));
  }
  assert.match(html, /id="smsEnabled"/);
  assert.match(html, /id="smsApiUrl"/);
  assert.match(html, /id="smsToken"[^>]+type="password"/);
  assert.match(html, /id="smsCharacterLimit"[^>]+max="70"/);
  assert.doesNotMatch(html, /Шинэ token оруулаагүй бол хадгалсныг хэвээр ашиглана/);
  assert.ok(html.indexOf('id="smsTestButton"') < html.indexOf('id="smsCharacterLimit"'), "SMS limit controls must follow the test SMS action");
  assert.match(html, /id="smsHistoryRows"/);
});

test("SMS history is isolated, server-paginated and searchable", () => {
  assert.match(html, /data-sms-tab="history"/);
  for (const id of ["smsHistoryPhone", "smsHistoryFrom", "smsHistoryTo", "smsHistoryEvent", "smsHistoryPagination"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(settingsApi, /\$pageSize = 100/);
  assert.match(settingsApi, /SELECT COUNT\(\*\) FROM app_sms_messages/);
  assert.match(settingsApi, /LIMIT \{\$pageSize\} OFFSET \{\$offset\}/);
  assert.match(settingsApi, /created_at >= \?/);
  assert.match(settingsApi, /event_type = \?/);
  assert.match(bootstrap, /idx_sms_phone_created/);
  assert.match(bootstrap, /idx_sms_event_created/);
  assert.match(app, /new URLSearchParams\(\{ view: "history", page:/);
});

test("booking persistence is isolated from SMS provider failures", () => {
  assert.match(service, /function sms_enqueue_booking_event_safely/);
  assert.match(service, /SAVEPOINT sms_event_queue/);
  assert.match(service, /Booking is already durable; SMS failure stays visible in history/);
  assert.match(bookings, /sms_enqueue_booking_event_safely/);
  assert.match(publicApi, /sms_enqueue_booking_event_safely/);
  assert.match(bookings, /\$pdo->commit\(\);\s*sms_dispatch_immediate/);
  assert.match(publicApi, /\$pdo->commit\(\);\s*sms_dispatch_immediate/);
});

test("reminders use Mongolia time, branch schedules, daytime checks and bounded retries", () => {
  assert.match(service, /const SMS_TIMEZONE = 'Asia\/Ulaanbaatar'/);
  assert.match(service, /const SMS_FIRST_CHECK_HOUR = 6/);
  assert.match(service, /sms_last_bookable_minutes/);
  assert.match(service, /weekendEnd' : 'workEnd'/);
  assert.match(service, /max_attempts, next_attempt_at/);
  assert.match(service, /'pending', 3/);
  assert.match(reminders, /PHP_SAPI !== 'cli'/);
});

test("change and cancellation invalidate old reminders without duplicate sends", () => {
  assert.match(service, /sms_cancel_pending_reminders/);
  assert.match(service, /\['changed', 'cancelled', 'deleted'\]/);
  assert.match(service, /\$appointment <= \$now->modify\('\+24 hours'\)/);
  assert.match(service, /INSERT IGNORE INTO app_sms_messages/);
  assert.match(bookings, /\['salon', 'date', 'time'\]/);
});

test("provider business failures and Unicode limits cannot be marked sent", () => {
  assert.match(service, /const SMS_UNICODE_LIMIT = 70/);
  assert.match(service, /sms_message_length_error/);
  assert.match(service, /array_key_exists\('status', \$decoded\)/);
  assert.match(service, /\(int\)\$decoded\['status'\] === 1/);
  assert.match(service, /\(int\)\$decoded\['sent_count'\] > 0/);
  assert.match(service, /\$result\['retryable'\].*\$attempts >=/s);
  assert.match(settingsApi, /sms_template_estimated_message/);
  assert.match(settingsApi, /\$normalized\['characterLimit'\]/);
  assert.match(html, /data-sms-counter="confirmed"/);
  assert.match(app, /Тооцоолсон урт/);
  assert.match(service, /min\(SMS_UNICODE_LIMIT, \(int\)\(\$stored\['characterLimit'\]/);
  assert.match(service, /sms_message_length_error\(\$message, \(int\)\(\$settings\['characterLimit'\]/);
});

console.log("sms-booking-notifications.test: OK");
