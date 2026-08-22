import assert from "node:assert/strict";
import fs from "node:fs";

const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const smsApi = fs.readFileSync(new URL("../api/sms-settings.php", import.meta.url), "utf8");
const revenueApi = fs.readFileSync(new URL("../api/revenue-list.php", import.meta.url), "utf8");
const voucherApi = fs.readFileSync(new URL("../api/voucher-list.php", import.meta.url), "utf8");
const groupSummaryApi = fs.readFileSync(new URL("../api/group-summary.php", import.meta.url), "utf8");
const giftCardApi = fs.readFileSync(new URL("../api/gift-card-list.php", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(stateApi, /assert_sections_readable_by_user\(\$requestedSections, \$user\)/, "State reads must enforce role permissions on the server");
assert.match(stateApi, /'audit'.*'homepageSettings'.*'performanceStatementHistory'/s, "Branch accounts must not read global admin sections");
assert.match(stateApi, /\$copy\['serviceHistory'\] = \$scopedHistory/, "Branch report payloads must strip other branches' customer history");
assert.match(stateApi, /'voucherLogs'.*'performanceStatements'/s, "Branch payloads must scope voucher and performance rows on the server");
assert.match(smsApi, /\$user = require_admin\(\)/, "SMS settings and history must be admin-only");
assert.match(smsApi, /\$pageSize = 100/, "SMS history must stay server-paginated");
assert.match(revenueApi, /\$pageSize = min\(100, max\(10,/, "Revenue rows must be server-paginated");
assert.match(revenueApi, /\(\$user\['role'\] \?\? ''\) === 'salon'/, "Revenue must enforce salon scope on the server");
assert.match(voucherApi, /\$pageSize = min\(100, max\(10,/, "Voucher history must be server-paginated");
assert.match(voucherApi, /\(\$user\['role'\] \?\? ''\) === 'salon'/, "Voucher history must enforce salon scope on the server");
assert.match(groupSummaryApi, /require_admin\(\)/, "Group summary must remain admin-only");
assert.match(giftCardApi, /\$pageSize = min\(100, max\(10,/, "Gift cards must be server-paginated");
assert.match(app, /revenue-list\.php\?/, "Revenue UI must use the server-side filtered endpoint");
assert.match(app, /voucher-list\.php\?/, "Voucher history UI must use the server-side filtered endpoint");
assert.match(app, /vouchers: \["voucherRoles"\]/, "Opening vouchers must not download every historical voucher row");
assert.match(app, /Voucher history is a paged read model[\s\S]*vouchers: \["voucherRoles"\]/, "Voucher page must never write a paged history back as the full section");
assert.match(app, /groups: \["customerTypes", "customerTypeRules", "pricePolicy"\]/, "Opening groups must not download all customer history");
assert.match(app, /group-summary\.php/, "Group counts must come from a lightweight server summary");
assert.match(app, /giftCards: \["generalSettings"\]/, "Opening gift cards must not download the full section");
assert.match(app, /gift-card-list\.php\?/, "Gift card browsing must use the paged endpoint");
assert.match(app, /ensureGiftCardDirectorySections\(\)/, "Gift card mutations must first load the authoritative full section");
assert.match(app, /performance: \["salons", "generalSettings"\]/, "Opening revenue must not download all customer history");
assert.match(app, /settingsUsers: \["salons"\]/, "User settings must not download audit history");
assert.match(app, /branches: \["salons", "homepageSettings"\]/, "Branch settings must not download bookings");
assert.match(app, /settingsPricing: \["pricePolicy", "voucherRoles", "customerTypes", "customerTypeRules"\]/, "Pricing must not fetch or save every customer until recalculation is explicitly requested");
assert.match(app, /settingsUsers: \[\]/, "User changes must not write a browser copy of audit history");

console.log("role-scope-and-revenue.test: OK");
