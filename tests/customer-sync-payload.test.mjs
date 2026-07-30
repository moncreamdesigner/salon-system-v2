import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function customerMutationsForSave");
const end = source.indexOf("function applyServerSectionRevisions", start);
assert.ok(start >= 0 && end > start, "Customer sync helpers must exist in app.js");

const context = vm.createContext({
  structuredClone,
  JSON,
  Number,
  Object,
  Array,
  Map,
  localStateMutationVersion: 4,
  serverScopeRevision: 12,
  serverClientId: "test-client",
  pendingCustomerProfileUpdates: new Map(),
  pendingCustomerGroupUpdates: new Map(),
  pendingServerSections: new Map(),
  serverSectionRevisions: new Map([
    ["customers", 10],
    ["audit", 11],
  ]),
  state: {
    customers: [{ id: 1, name: "Old" }],
    customerGroups: [],
    audit: [{ id: "audit-1", title: "customer_created" }],
  },
  serviceSettingsData: {},
  productGroups: [],
});
vm.runInContext(
  `${source.slice(start, end)}
   globalThis.customerMutationsForSave = customerMutationsForSave;
   globalThis.serverStateRequestBody = serverStateRequestBody;`,
  context
);

context.pendingCustomerProfileUpdates.set(1, {
  id: 1,
  name: "Changed",
  mutationVersion: 4,
  baseFingerprint: '{"id":1,"name":"Old"}',
});
context.pendingServerSections.set("customers", 4);
context.pendingServerSections.set("audit", 4);

const atomicBody = JSON.parse(context.serverStateRequestBody(20, 4));
assert.equal(atomicBody.customerMutations.profiles.length, 1);
assert.equal(atomicBody.customerMutations.profiles[0].name, "Changed");
assert.equal(Object.hasOwn(atomicBody.data, "customers"), false);
assert.equal(Object.hasOwn(atomicBody.sectionRevisions, "customers"), false);
assert.deepEqual(atomicBody.data.audit, context.state.audit);

context.pendingCustomerProfileUpdates.clear();
const legacyBody = JSON.parse(context.serverStateRequestBody(21, 4));
assert.deepEqual(legacyBody.data.customers, context.state.customers);
assert.equal(legacyBody.sectionRevisions.customers, 10);

console.log("customer-sync-payload.test: OK");
