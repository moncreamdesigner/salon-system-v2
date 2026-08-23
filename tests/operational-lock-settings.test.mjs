import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");

assert.match(
  source,
  /array_merge\(array_keys\(\$sections\), \$mutationKeys, \['generalSettings'\]\)/,
  "Partial customer saves must load generalSettings before enforcing the operational lock"
);
assert.match(
  source,
  /function operational_edit_days\(array \$current, array \$incoming\): int/,
  "The operational day limit must have one shared server-side resolver"
);
assert.match(
  source,
  /preg_replace\('\/\^3 хоногоос\/u', \$days \. ' хоногоос'/,
  "Server protection messages must display the configured day limit"
);
assert.match(
  source,
  /recovery_index\([^;]+, 'service'\)/,
  "Legacy services must use stable business identity instead of their mutable full payload"
);

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(
  appSource,
  /kass: \["kassSchedules", "staff", "assignments", "salons", "generalSettings"\]/,
  "Every salon account must load the shared operational edit-day setting in the kass view"
);
assert.match(
  appSource,
  /discardPendingMutationsThrough\(savingMutationVersion\);[\s\S]+?await reloadServerConflictSections\(savingSections\)/,
  "A rejected locked operation must be removed from the retry queue and replaced with scoped server state"
);

console.log("operational-lock-settings.test: OK");
