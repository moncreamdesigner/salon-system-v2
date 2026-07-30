import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const stateApi = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const fullBackups = fs.readFileSync(new URL("../api/full-backups.php", import.meta.url), "utf8");

assert.match(app, /pendingServerOperationBody/, "Retries must retain the exact original request body");
assert.match(app, /localStorage\.removeItem\(PENDING_SERVER_OPERATION_KEY\)/, "Unsafe legacy operation ids must not survive a reload");
assert.match(app, /operationId,\s*\n\s*partial:\s*true/, "State writes must send an operation id");
assert.match(app, /ensurePendingServerOperation\(requestedMutationVersion,\s*requestedCustomerMutations\)/, "Retries must reuse a pending operation id");
assert.match(app, /clearPendingServerOperation\(savingOperationId\)/, "Successful or rejected operations must be cleared");
assert.match(app, /serverRetryNoticeOperationId\s*!==\s*savingOperationId/, "One transient failure must not repeatedly interrupt staff with the same warning");

assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_operations/, "Operation idempotency table is required");
assert.match(bootstrap, /operation_id VARCHAR\(190\) NOT NULL UNIQUE/, "Operation ids must be unique");
assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS app_change_events/, "Recoverable change event table is required");

assert.match(stateApi, /SELECT actor_user_id, result_payload FROM app_operations WHERE operation_id = \?/, "Duplicate operations must return their stored result");
assert.match(stateApi, /idempotentReplay/, "Duplicate response must be marked as replayed");
assert.match(stateApi, /record_change_events\(/, "Entity before/after events must be stored in the same transaction");
assert.match(stateApi, /INSERT INTO app_operations/, "Successful operations must be recorded before commit");

assert.match(fullBackups, /'app_operations'/, "Full backup must include operation records");
assert.match(fullBackups, /'app_change_events'/, "Full backup must include change events");

console.log("operation-idempotency.test: OK");
