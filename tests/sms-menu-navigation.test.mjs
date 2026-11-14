import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function setView(");
const source = app.slice(start, app.indexOf("\nfunction ", start + 1));
function element() {
  const classes = new Set();
  return { scrollTop: 250, attributes: {}, classList: {
    toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
    add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name)
  }, setAttribute(name, value) { this.attributes[name] = value; } };
}

test("SMS keeps the admin submenu open like sibling settings without changing its scroll", () => {
  const submenu = element(), toggle = element(), sidebar = element(), view = element();
  const nodes = { settingsSubmenu: submenu, settingsToggle: toggle, sidebar };
  let admin = true;
  const c = vm.createContext({
    activeView: "bookings", saveContextView: "bookings", state: { customers: [], customerGroups: [] }, retiredViews: new Set(),
    isAdminAccount: () => admin, releaseDiagnosisCameraSession() {}, stopSmsCampaignPolling() {}, releaseRenderedView() {}, resetIncomingViewState() {},
    ACTIVE_VIEW_SESSION_KEY: "view", ACTIVE_CUSTOMER_SESSION_KEY: "customer", sessionStorage: { setItem() {}, removeItem() {} },
    mountOnlyView() {}, showServerViewLoader() {}, IS_LOCAL_RUNTIME: false, serverStorageReady: false, showToast() {},
    document: { getElementById: id => nodes[id] || view, querySelectorAll: () => [] }
  });
  vm.runInContext(source, c);
  for (const name of ["settingsCatalog", "smsCampaigns", "settingsSms", "smsCampaigns"]) {
    c.setView(name);
    assert.equal(c.activeView, name);
    assert.equal(submenu.classList.contains("open"), true, name);
    assert.equal(toggle.classList.contains("active"), true, name);
    assert.equal(toggle.attributes["aria-expanded"], "true");
    assert.equal(submenu.scrollTop, 250);
  }
  c.setView("bookings");
  assert.equal(submenu.classList.contains("open"), false);
  admin = false;
  c.setView("smsCampaigns");
  assert.equal(c.activeView, "bookings", "SMS stays admin-only");
  assert.equal(submenu.classList.contains("open"), false);
});
