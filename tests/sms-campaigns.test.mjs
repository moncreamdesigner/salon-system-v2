import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const bootstrap = read("../api/bootstrap.php");
const api = read("../api/sms-campaigns.php");
const service = read("../api/sms-campaign-service.php");
const worker = read("../api/sms-campaign-worker.php");
const settings = read("../api/sms-settings.php");
const backup = read("../api/full-backups.php");
const html = read("../index.html");
const app = read("../app.js");
const client = read("../sms-campaigns.js");

test("marketing SMS uses dedicated server tables and recoverable backups", () => {
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_sms_campaigns/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_sms_campaign_recipients/);
  assert.match(bootstrap, /UNIQUE KEY idx_sms_campaign_phone \(campaign_id, phone\)/);
  assert.match(bootstrap, /idx_sms_campaign_status_due \(status, next_run_at\)/);
  assert.match(bootstrap, /idx_sms_campaign_recipient_due \(campaign_id, status, next_attempt_at\)/);
  assert.match(bootstrap, /'schema_version', '8'/);
  assert.match(backup, /'app_sms_campaigns'/);
  assert.match(backup, /'app_sms_campaign_recipients'/);
  assert.doesNotMatch(service, /INSERT(?: IGNORE)? INTO app_sms_messages/);
});

test("campaign access and all mutations remain admin-only and code-confirmed", () => {
  assert.match(api, /verify_same_origin\(\);\s*\$user = require_admin\(\)/);
  assert.match(api, /hash_equals\(\$expected, \$submitted\)/);
  assert.match(api, /if \(!sms_campaign_code_matches/);
  assert.ok(api.indexOf("sms_campaign_code_matches($pdo") < api.indexOf("if ($action === 'create')"));
  assert.match(html, /data-view="smsCampaigns" data-admin-only/);
  assert.match(app, /"smsCampaigns", "settingsSms"/);
  assert.match(client, /const code = await requireEditCodeValue\(\)/);
});

test("campaign drafts never send before a separate explicit start", () => {
  assert.match(api, /VALUES \(\?, \?, \?, 'draft', \?\)/);
  assert.match(api, /if \(\$action === 'start'\)/);
  assert.match(api, /status = 'running', total_count = \?, pending_count = \?/);
  assert.match(client, /data-action="start"/);
  assert.match(service, /WHERE status = 'running' AND next_run_at <= \?/);
});

test("customer phones are valid, deduplicated and assembled in bounded insert batches", () => {
  assert.match(service, /\(\$customer\['deleted'\] \?\? false\) === true/);
  assert.match(service, /sms_normalize_phone\(/);
  assert.match(service, /\$phones\[\$phone\] = true/);
  assert.match(service, /return array_keys\(\$phones\)/);
  assert.match(api, /array_chunk\(\$phones, 200\)/);
  assert.match(api, /INSERT IGNORE INTO app_sms_campaign_recipients/);
});

test("sending is bounded, leased, retried and independent from browsers", () => {
  assert.match(service, /const SMS_CAMPAIGN_MIN_BATCH = 10/);
  assert.match(service, /const SMS_CAMPAIGN_MAX_BATCH = 100/);
  assert.match(service, /const SMS_CAMPAIGN_DEFAULT_BATCH = 50/);
  assert.match(service, /lease_until IS NULL OR lease_until < \?/);
  assert.match(service, /ORDER BY id ASC LIMIT 1 FOR UPDATE/);
  assert.match(service, /LIMIT \{\$limit\} FOR UPDATE/);
  assert.match(service, /\$now->modify\('\+5 minutes'\)/);
  assert.match(service, /attempts < max_attempts/);
  assert.match(service, /new DateTimeZone\(SMS_TIMEZONE\)/);
  assert.match(worker, /PHP_SAPI !== 'cli'/);
  assert.match(settings, /UPDATE app_sms_campaigns SET status = 'paused'/);
});

test("campaign totals and recipients do not load all customers or history", () => {
  assert.match(api, /\$pageSize = 20/);
  assert.match(api, /\$pageSize = 100/);
  assert.match(api, /SELECT COUNT\(\*\) FROM app_sms_campaigns/);
  assert.doesNotMatch(api, /SELECT COUNT\(\*\) FROM app_sms_campaign_recipients/);
  assert.match(api, /\$total = \(int\)\$campaign\['total_count'\]/);
  assert.match(app, /smsCampaigns: \["generalSettings"\]/);
  assert.match(client, /activeView !== "smsCampaigns" \|\| !isAdminAccount\(\)/);
  assert.match(client, /\}, 20000\)/);
  assert.match(app, /if \(previousView === "smsCampaigns"\) stopSmsCampaignPolling\(\)/);
});

test("SMS settings stays separate and campaign submit preserves its form across awaits", () => {
  assert.match(html, /data-view="settingsSms"[^>]*>SMS тохиргоо/);
  assert.match(html, /id="smsCampaignsView"/);
  assert.match(html, /id="settingsSmsView"/);
  assert.match(client, /const form = event\.currentTarget/);
  assert.match(client, /form\.reset\(\)/);
  assert.doesNotMatch(client, /event\.currentTarget\.reset\(\)/);
});
