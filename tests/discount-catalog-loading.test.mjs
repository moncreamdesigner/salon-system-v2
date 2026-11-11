import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function helper(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\nfunction ", start + 1));
}
function freshSession(role = "admin", salon = "") {
  const context = vm.createContext({
    activeView: "settingsDiscounts", activeAccount: { role, salon },
    IS_LOCAL_RUNTIME: false, fullServerStateLoaded: false,
    loadedServerSections: new Set(["discounts", "customerTypes", "customerTypeRules", "generalSettings", "salons"]),
    serviceSettingsData: { single: [], course: [], products: {} }, productGroups: []
  });
  const start = app.indexOf("const VIEW_SERVER_SECTIONS =");
  vm.runInContext(app.slice(start, app.indexOf("const PERFORMANCE_STAFF_SECTIONS", start)), context);
  for (const name of ["serverSectionsForView", "serverViewSectionsLoaded", "discountServiceGroups", "dirtySectionsForView"]) vm.runInContext(helper(name), context);
  return context;
}

test("a direct discount visit waits for its catalog, even when other page data is already loaded", () => {
  const session = freshSession();
  const requested = session.serverSectionsForView("settingsDiscounts");
  assert.ok(requested.includes("_serviceSettings"));
  assert.ok(requested.includes("salons"));
  assert.equal(session.serverViewSectionsLoaded("settingsDiscounts"), false);
  session.loadedServerSections.add("_serviceSettings");
  assert.equal(session.serverViewSectionsLoaded("settingsDiscounts"), true);
  session.loadedServerSections.delete("salons");
  assert.equal(session.serverViewSectionsLoaded("settingsDiscounts"), false);
});

test("fresh admin and both salon sessions show the same product groups after the requested catalog arrives", () => {
  for (const [role, salon] of [["admin", ""], ["salon", "Хан-Уул салбар"], ["salon", "Чингэлтэй салбар"]]) {
    const session = freshSession(role, salon);
    assert.equal(session.discountServiceGroups().length, 0);
    // The page now requests this shared section itself; no profile visit needed.
    assert.ok(session.serverSectionsForView("settingsDiscounts").includes("_serviceSettings"));
    session.serviceSettingsData.products = {
      shampoo: [{ code: "P1", name: "Шампунь" }],
      bundle: [{ code: "P2", name: "Багц" }]
    };
    session.productGroups.push(["shampoo", "Шампунь"], ["bundle", "Багц"], ["empty", "Хоосон"]);
    session.loadedServerSections.add("_serviceSettings");
    assert.equal(session.serverViewSectionsLoaded("settingsDiscounts"), true);
    assert.equal(session.discountServiceGroups().length, 2);
    assert.equal(session.discountServiceGroups()[0][2][0].code, "P1");
    assert.equal(session.discountServiceGroups()[1][2][0].code, "P2");
  }
});

test("discount saves remain isolated and never rewrite the loaded catalog or salons", () => {
  assert.deepEqual(Array.from(freshSession().dirtySectionsForView("settingsDiscounts")), ["discounts"]);
  const php = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");
  const allowlist = php.slice(php.indexOf("function assert_sections_readable_by_user("), php.indexOf("function assert_branch_customer_type_permissions("));
  assert.match(allowlist, /'_serviceSettings'/);
  assert.match(allowlist, /'salons'/);
  assert.doesNotMatch(helper("renderDiscountSettings"), /\bfetch\s*\(|setInterval|synchronizeServerState/);
});
