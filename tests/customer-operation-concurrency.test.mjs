import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const mutationSource = fs.readFileSync(new URL("../api/customer-mutations.php", import.meta.url), "utf8");
const stateApiSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
const changesApiSource = fs.readFileSync(new URL("../api/changes.php", import.meta.url), "utf8");

test("profile writes include only sections changed by the operation", () => {
  assert.match(appSource, /function saveAndRefreshCustomerProfile\(message, \{[\s\S]+?relatedSections = \[\][\s\S]+?pendingCustomerGroupUpdates\.size \? \["customerGroups"\] : \[\][\s\S]+?\.\.\.new Set\(relatedSections\)/);
  assert.match(appSource, /saveAndRefreshCustomerProfile\("Төлбөр бүртгэгдлээ", \{[\s\S]+?voucherLog \? \["voucherLogs"\][\s\S]+?giftCardUsage \? \["giftCards"\]/);
});

test("customer mutations carry a base snapshot for server three-way merge", () => {
  assert.match(appSource, /const baseSnapshot = previous\?\.baseSnapshot[\s\S]+?lastSyncedCustomerFingerprints/);
  assert.match(appSource, /baseFingerprint:[\s\S]+?baseSnapshot/);
  assert.match(appSource, /update\.baseSnapshot = structuredClone\(savedProfile\)/);
  assert.match(appSource, /update\.baseSnapshot && typeof update\.baseSnapshot === "object"/);
  assert.match(appSource, /function applyPendingCustomerProfileUpdates[\s\S]+?const \{ mutationVersion, baseFingerprint, baseSnapshot, \.\.\.profile \} = update/);
});

test("server merges disjoint nested customer operations and rejects same-field edits", () => {
  assert.match(mutationSource, /function customer_mutation_three_way_merge/);
  assert.match(mutationSource, /function customer_mutation_merge_node/);
  assert.match(mutationSource, /str_ends_with\(\$path, '\/visits'\)/);
  assert.match(mutationSource, /'reason' => 'same_field_changed'/);
  assert.match(mutationSource, /'paths' => array_slice\(\$mergeConflicts, 0, 20\)/);
});

test("a true same-entity conflict stops retrying and reloads authoritative data", () => {
  assert.match(appSource, /error\.status === 409 && error\.payload\?\.customerConflict/);
  assert.match(appSource, /discardPendingMutationsThrough\(savingMutationVersion\)/);
  assert.match(appSource, /showServerProtectionNotice\(error\.payload\.message/);
});

test("successful operations keep service, payment, visit and credit event history", () => {
  assert.match(stateApiSource, /'entityType' => 'service'/);
  assert.match(stateApiSource, /\['key' => 'payments', 'type' => 'payment'\]/);
  assert.match(stateApiSource, /\['key' => 'visits', 'type' => 'visit'\]/);
  assert.match(stateApiSource, /'entityType' => 'customerCredit'/);
  assert.match(stateApiSource, /'parentId' => \$entityId \. '\/' \. \(string\)\$serviceId/);
});

test("nested ledger events are audited but restore stays on the atomic parent", () => {
  assert.match(changesApiSource, /Nested ledger events are kept for audit\/download/);
  assert.match(changesApiSource, /\['customer', 'customerGroup', 'booking'\]/);
  assert.doesNotMatch(changesApiSource, /'payment', 'visit', 'diagnosis'.*=> 'customers'/);
});

test("stale browsers cannot replace whole customer arrays", () => {
  assert.match(stateApiSource, /\$bulkCustomerImport/);
  assert.match(stateApiSource, /'customerEndpointRequired' => true/);
  assert.match(stateApiSource, /array_key_exists\('customers', \$sections\) && \$profileMutationCount === 0/);
  assert.match(appSource, /bulkCustomerImport: true/);
  assert.match(appSource, /database_import_merge/);
});
