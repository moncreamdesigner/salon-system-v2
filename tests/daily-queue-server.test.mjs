import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const customerList = fs.readFileSync(new URL("../api/customer-list.php", import.meta.url), "utf8");

assert.match(app, /if \(!IS_LOCAL_RUNTIME\) return false;[\s\S]{0,160}const grouped = new Map\(\)/, "Paged live browsers must not own queue numbering.");
assert.match(stateApi, /FOR UPDATE[\s\S]*daily_queue_normalize_customers\(\$sections\['customers'\]\)/, "Queue allocation must run after the server transaction lock.");
assert.match(stateApi, /customers' && \$hasProfileMutations\) continue/, "Unrelated customer saves must rely on entity conflicts instead of section-wide rejection.");
assert.match(customerList, /daily_queue_normalize_customers\(\$rows\)/, "Existing duplicate numbers must be repaired in the active queue response immediately.");

console.log("daily-queue-server.test: OK");
