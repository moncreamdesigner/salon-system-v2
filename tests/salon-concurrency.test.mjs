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

test("partial views fetch the shared rules they render", () => {
  assert.match(appSource, /profile: \[[^\]]+"generalSettings"[^\]]+"_serviceSettings"\]/);
  assert.match(appSource, /settingsPricing: \[[^\]]+"customerTypes"[^\]]+"customerTypeRules"[^\]]+"customers"/);
  assert.match(appSource, /groups: \["customers", "customerGroups", "customerTypes", "customerTypeRules", "pricePolicy"\]/);
});
