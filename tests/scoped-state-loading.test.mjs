import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helpers = app.slice(
  app.indexOf("const VIEW_SERVER_SECTIONS ="),
  app.indexOf("async function synchronizeServerState(")
);

const context = {
  activeView: "bookings",
  IS_LOCAL_RUNTIME: false,
  fullServerStateLoaded: false,
  loadedServerSections: new Set(),
  serverScopeRevision: 17,
  virtualViews: new Map([["bookings", {}], ["customers", {}], ["performance", {}]]),
  viewServerRevisions: new Map()
};
vm.createContext(context);
vm.runInContext(`${helpers}\nthis.api = { serverSectionsForView, serverViewSectionsLoaded, markAllViewsCurrent };`, context);

assert.equal(context.api.serverViewSectionsLoaded("bookings"), false, "An unopened booking view is not authoritative");
context.loadedServerSections.add("bookings");
assert.equal(context.api.serverViewSectionsLoaded("bookings"), false, "A view remains blocked while a dependency is missing");
context.loadedServerSections.add("salons");
context.loadedServerSections.add("holidays");
assert.equal(context.api.serverViewSectionsLoaded("bookings"), true, "A view unlocks only after every dependency loads");

context.api.markAllViewsCurrent();
assert.equal(context.viewServerRevisions.size, 0, "A partial response must never mark unrelated views current");
context.fullServerStateLoaded = true;
context.api.markAllViewsCurrent();
assert.deepEqual(
  [...context.viewServerRevisions.entries()],
  [["bookings", 17], ["customers", 17], ["performance", 17]],
  "Only a full authoritative response can mark every view current"
);

const initializer = app.slice(
  app.indexOf("async function initializeServerStorage("),
  app.indexOf("const AUTO_REFRESH_VIEWS")
);
assert.match(initializer, /showServerViewLoader\(activeView\)/);
assert.match(initializer, /finally \{[\s\S]*serverStorageReady[\s\S]*hideServerViewLoader/);

const viewSetter = app.slice(app.indexOf("function setView("), app.indexOf("function resetIncomingViewState("));
assert.doesNotMatch(
  viewSetter.slice(viewSetter.indexOf("!serverViewSectionsLoaded(name)")),
  /!renderedViews\.has\(name\)\) renderActiveView/,
  "A failed first load must not expose an editable empty view"
);

const refresher = app.slice(
  app.indexOf("async function refreshServerStateForView("),
  app.indexOf("function auditNowText(")
);
assert.match(refresher, /revision\.php\$\{sectionQuery\}/, "Refresh checks only the active view's section revisions");
assert.match(refresher, /serverViewRefreshPromises\.get\(viewName\)/, "Each view deduplicates only its own refresh request");
assert.match(refresher, /requestedSections\.some\(key => pendingSections\.includes\(key\)\)/, "Only refreshes with overlapping data sections are serialized");
assert.doesNotMatch(refresher, /serverRefreshPromise/, "A slow unrelated view must not serialize every refresh");

console.log("scoped-state-loading.test: OK");
