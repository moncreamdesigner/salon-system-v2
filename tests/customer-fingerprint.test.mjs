import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const clearStart = source.indexOf("function clearCustomerUiState");
const clearEnd = source.indexOf("function dirtySectionsForView", clearStart);
const groupCleanupStart = source.indexOf("function cleanCustomerGroupUiState");
const groupCleanupEnd = source.indexOf("function syncedEntityFingerprint", groupCleanupStart);
const fingerprintStart = source.indexOf("function syncedEntityFingerprint");
const fingerprintEnd = source.indexOf("function captureSyncedCustomerFingerprints", fingerprintStart);
assert.ok(clearStart >= 0 && clearEnd > clearStart, "Customer UI cleanup helper must exist");
assert.ok(groupCleanupStart >= 0 && groupCleanupEnd > groupCleanupStart, "Group UI cleanup helper must exist");
assert.ok(fingerprintStart >= 0 && fingerprintEnd > fingerprintStart, "Customer fingerprint helpers must exist");

const context = vm.createContext({ structuredClone, JSON });
vm.runInContext(
  `${source.slice(clearStart, clearEnd)}
   ${source.slice(groupCleanupStart, groupCleanupEnd)}
   ${source.slice(fingerprintStart, fingerprintEnd)}
   globalThis.syncedCustomerFingerprint = syncedCustomerFingerprint;
   globalThis.syncedCustomerGroupFingerprint = syncedCustomerGroupFingerprint;`,
  context
);

const persistedCustomer = {
  id: 7,
  name: "Оношилгооны хэрэглэгч",
  serviceHistory: [{
    id: "diagnosis-1",
    diagnosis: { note: "Эхний мэдээлэл" }
  }]
};
const openCustomer = structuredClone(persistedCustomer);
openCustomer.profileServiceOpen = true;
openCustomer.profileInfoEditing = true;
openCustomer.serviceHistory[0].diagnosisOpen = true;
openCustomer.serviceHistory[0].diagnosisExpanded = true;

assert.equal(
  context.syncedCustomerFingerprint(openCustomer),
  context.syncedCustomerFingerprint(persistedCustomer),
  "UI-only state must not create a false customer conflict"
);

const changedCustomer = structuredClone(openCustomer);
changedCustomer.serviceHistory[0].diagnosis.note = "Нэмсэн мэдээлэл";
assert.notEqual(
  context.syncedCustomerFingerprint(changedCustomer),
  context.syncedCustomerFingerprint(persistedCustomer),
  "Persisted diagnosis changes must still change the fingerprint"
);

const persistedGroup = { id: 4, name: "99112233", members: [7] };
const openGroup = { ...persistedGroup, editingName: true, directoryExpanded: true };
assert.equal(
  context.syncedCustomerGroupFingerprint(openGroup),
  context.syncedCustomerGroupFingerprint(persistedGroup),
  "Group UI-only state must not create a false conflict"
);

const captureStart = source.indexOf("function captureSyncedCustomerFingerprints(");
const captureEnd = source.indexOf("function discardUnsafeCustomerReplays(", captureStart);
const captureSource = source.slice(captureStart, captureEnd);
assert.doesNotMatch(
  captureSource,
  /set\(Number\(customer\.id\), syncedCustomerFingerprint\(customer\)\)/,
  "Loading the customer list must not stringify every full customer eagerly"
);
assert.match(
  captureSource,
  /storedSyncedFingerprint/,
  "A full conflict fingerprint is calculated lazily when that customer is edited"
);
assert.match(
  captureSource,
  /!replace && !merge/,
  "An authoritative customer-detail subset must merge fingerprints without dropping other pending profile bases"
);

console.log("customer-fingerprint.test: OK");
