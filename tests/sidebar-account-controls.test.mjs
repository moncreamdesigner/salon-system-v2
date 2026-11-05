import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");

test("footer places logout before the avatar and collapse after the user name", () => {
  const footer = html.slice(html.indexOf('<div class="sidebar-footer">'), html.indexOf("</aside>"));
  assert.ok(footer.indexOf('id="serverLogoutBtn"') < footer.indexOf('id="sidebarUserAvatar"'));
  assert.ok(footer.indexOf('id="sidebarUserName"') < footer.indexOf('id="sidebarCollapseBtn"'));
  for (const id of ["serverLogoutBtn", "sidebarCollapseBtn"]) assert.equal(html.split(`id="${id}"`).length - 1, 1);
  assert.match(footer, /class="sidebar-logout hidden"[^>]*data-admin-only/);
  const logout = footer.match(/<button[^>]+id="serverLogoutBtn"[\s\S]*?<\/button>/)?.[0];
  assert.match(logout, /<svg[^>]+stroke="currentColor"[^>]+aria-hidden="true"/);
  assert.doesNotMatch(logout, /↪/);
});

test("account switching exposes logout only to admins without retaining the previous account's visibility", () => {
  const button = { hiddenClass: true, classList: { toggle(name, hidden) { button.hiddenClass = hidden; } } };
  const context = vm.createContext({
    activeAccount: {}, activeView: "bookings", state: { salons: [{ name: "Хан-Уул" }] },
    document: { getElementById: () => null, querySelectorAll: () => [button] }
  });
  vm.runInContext(`function isAdminAccount() { return activeAccount.role === "admin"; }`, context);
  const start = app.indexOf("function applyActiveAccount(");
  vm.runInContext(app.slice(start, app.indexOf("\nfunction ", start + 1)), context);
  for (const role of ["admin", "salon", "manager", "admin", "unknown"]) {
    context.applyActiveAccount({ id: 1, role, salon: "Хан-Уул" });
    assert.equal(button.hiddenClass, role !== "admin", role);
  }
});

test("collapsed footer keeps the expand control reachable while hiding account details", () => {
  assert.doesNotMatch(css, /body\.sidebar-collapsed \.sidebar-footer\s*\{[^}]*display:\s*none/);
  assert.match(css, /body\.sidebar-collapsed \.sidebar-footer \.sidebar-user-avatar,[\s\S]*?\.sidebar-logout\s*\{\s*display: none !important/);
  const control = css.match(/\.sidebar-collapse-btn\s*\{([^}]+)\}/)?.[1];
  assert.match(control, /position: static/);
  assert.match(control, /width: 28px/);
  assert.doesNotMatch(control, /position: fixed|bottom: 0/);
  assert.match(app, /getElementById\("sidebarCollapseBtn"\)\?\.addEventListener\("click", toggleSidebar\)/);
});
