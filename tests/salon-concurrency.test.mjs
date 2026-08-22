import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stateApiSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");

test("append-only audit history never rejects an unrelated salon write", () => {
  assert.match(stateApiSource, /if \(\(string\)\$key === 'audit'\) continue;/);
  assert.match(stateApiSource, /\$sections = merge_append_only_audit\(\$currentSections, \$sections\);/);
});

test("kass schedules use cross-salon unique ids and replay safely after a revision conflict", () => {
  assert.match(appSource, /id: uniqueNumericId\(\[\.\.\.state\.kassSchedules, \.\.\.createdItems\]\)/);
  assert.doesNotMatch(appSource, /id: nextId\(state\.kassSchedules\)/);
  assert.match(appSource, /function registerPendingKassScheduleMutation/);
  assert.match(appSource, /function replayPendingKassScheduleMutations/);
  assert.match(appSource, /markPendingKassScheduleSections\(\);[\s\S]+?pendingKassScheduleMutations\.length > 0/);
});

test("legacy duplicate kass ids remain distinct between salons", () => {
  assert.match(stateApiSource, /if \(\$kind === 'kass-schedule'[\s\S]+?return 'kass-schedule:' \. trim\(\(string\)\(\$item\['salon'\]/);
  assert.match(stateApiSource, /assert_dated_section_unlocked\(\$current, \$incoming, 'kassSchedules',[\s\S]+?'kass-schedule'\);/);
});

test("holidays use globally unique ids and legacy rows are addressed by salon", () => {
  assert.match(appSource, /id: entityId\("holiday"\)/);
  assert.doesNotMatch(appSource, /id: nextId\(state\.holidays\)/);
  assert.match(appSource, /function holidayRecordKey\(holiday = \{\}\)/);
  assert.match(appSource, /editHoliday\(button\.dataset\.id, button\.dataset\.salon\)/);
  assert.match(appSource, /deleteHoliday\(button\.dataset\.id, button\.dataset\.salon\)/);
});

test("voucher usage logs use globally unique ids", () => {
  assert.match(appSource, /id: entityId\("voucher-log"\)/);
  assert.doesNotMatch(appSource, /id: nextId\(state\.voucherLogs\)/);
});

test("partial views fetch the shared rules they render", () => {
  assert.match(appSource, /profile: \[[^\]]+"generalSettings"[^\]]+"_serviceSettings"\]/);
  assert.match(appSource, /settingsPricing: \[[^\]]+"customerTypes"[^\]]+"customerTypeRules"\]/);
  assert.match(appSource, /PERFORMANCE_STAFF_SECTIONS = \["customers"/);
  assert.match(appSource, /groups: \["customerTypes", "customerTypeRules", "pricePolicy"\]/);
  assert.match(appSource, /synchronizeServerState\(null, \["customers", "customerGroups"\], "groupsDirectory"\)/);
});
