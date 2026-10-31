import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("app.js");
const ui = read("events.js");
const api = read("api/events.php");

test("event menu follows discounts and loads only its own data plus delete-code settings", () => {
  assert.match(html, /data-view="settingsDiscounts">Хямдрал<\/button>\s*<button class="nav-item" data-view="events">Арга хэмжээ/);
  assert.match(app, /events: \["generalSettings"\]/);
  assert.match(app, /name === "events"\) window.EventSettings.render\(\)/);
  assert.match(ui, /serverApi\("events.php"/);
  assert.doesNotMatch(ui, /saveState\(/);
});
test("event UI escapes names, prevents duplicate submits and shows registration lock", () => {
  assert.match(ui, /html\(row.name\)/);
  assert.match(ui, /if \(busy\) return/);
  assert.match(ui, /row.registrationCount > 0 \? "disabled"/);
  assert.match(ui, /requestActionCode\("delete", true\)/);
  assert.match(app, /window.EventSettings\?\.hasPending/);
});

test("profile event controls are compact, optional and persist only on explicit save", () => {
  assert.match(app, /window.EventSettings.profileCard\(customer\)/);
  assert.match(app, /window.EventSettings.bindProfile\(customer\)/);
  assert.match(ui, /<option value="">–<\/option>/);
  assert.match(ui, /event.endDate >= todayText\(\)/);
  assert.match(ui, /action: "assign", customerId: id, eventId: draft.selected, token: draft.token/);
  assert.match(read("styles.css"), /\.profile-event-controls\s*\{[^}]*display: flex/);
});

test("dashboard event filters are separate from income reports and server-scoped", () => {
  assert.match(html, /id="eventReportMode"[\s\S]*value="all"[\s\S]*value="month"[\s\S]*value="single"/);
  assert.match(ui, /mode: "dashboard", filter: mode.value, month: month.value, eventId: eventSelect.value, salon/);
  assert.match(api, /\(\$user\['role'\] \?\? ''\) === 'salon' \? \(string\)\$user\['salon'\]/);
  assert.doesNotMatch(ui, /setInterval/);
});
test("server event writes are authenticated, locked, code-checked and entity-owned", () => {
  assert.match(api, /verify_same_origin\(\)/);
  assert.match(api, /require_auth\(\)/);
  assert.match(api, /meta_key = 'revision' FOR UPDATE/);
  assert.match(api, /hash_equals\(\$code/);
  assert.match(api, /event_mutate\(/);
  assert.match(read("api/state.php"), /array_key_exists\('_events', \$sections\)/);
  assert.match(app, /delete incoming\._events/);
});

test("event form creates, edits and locks registered rows without changing client state", async () => {
  const elements = new Map();
  for (const id of ["eventForm", "eventName", "eventStartDate", "eventEndDate", "eventSubmit", "eventCancel", "eventFormTitle", "eventRows", "eventFields", "eventRefresh", "eventMessage"]) {
    elements.set(id, { value: "", dataset: {}, handlers: {}, classList: { toggle() {} }, addEventListener(type, handler) { this.handlers[type] = handler; }, scrollIntoView() {}, focus() {} });
  }
  const element = id => elements.get(id);
  element("eventForm").reset = () => { for (const id of ["eventName", "eventStartDate", "eventEndDate"]) element(id).value = ""; };
  let stored = [{ id: "registered", version: 1, name: '<img src=x onerror="bad()">', startDate: "2026-11-01", endDate: "2026-11-30", registrationCount: 1 }];
  const posts = [];
  let askedForCode = 0;
  const context = vm.createContext({ window: {}, document: { getElementById: element }, activeView: "events", entityId: () => "event-new", todayText: () => "2026-10-31", editIcon: () => "edit", trashIcon: () => "delete", renderInfoHeader() {}, showToast() {}, requestActionCode: async () => { askedForCode++; return "test-code"; }, serverApi: async (path, options = {}) => {
    if (!options.method) return { events: stored.map(row => ({ ...row })) };
    const body = JSON.parse(options.body);
    posts.push(body);
    const row = { ...body, version: body.version + 1, registrationCount: 0 };
    stored = stored.filter(item => item.id !== row.id).concat(row);
    return { event: row };
  } });
  vm.runInContext(ui, context);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  context.window.EventSettings.render();
  await tick();
  assert.match(element("eventRows").innerHTML, /&lt;img/);
  assert.doesNotMatch(element("eventRows").innerHTML, /<img/);
  const target = dataset => ({ target: { closest: () => ({ dataset }) } });
  await element("eventRows").handlers.click(target({ eventDelete: "registered" }));
  assert.equal(askedForCode, 0, "Registered events must be blocked before asking for a code");
  assert.equal(posts.length, 0);
  element("eventName").value = "New event";
  element("eventEndDate").value = "2026-11-30";
  element("eventForm").handlers.submit({ preventDefault() {} });
  await tick();
  assert.equal(posts[0].name, "New event");
  assert.equal(posts[0].version, 0);
  assert.equal(context.window.EventSettings.count, 2);
  await element("eventRows").handlers.click(target({ eventEdit: "event-new" }));
  element("eventName").value = "Edited event";
  element("eventForm").handlers.submit({ preventDefault() {} });
  await tick();
  assert.equal(posts[1].id, "event-new");
  assert.equal(posts[1].version, 1);
  assert.equal(posts[1].name, "Edited event");
});

function fakeElements(ids) {
  const elements = new Map(ids.map(id => [id, { value: "", dataset: {}, handlers: {}, parentElement: {}, isConnected: true,
    addEventListener(type, handler) { this.handlers[type] = handler; } }]));
  return id => elements.get(id);
}

test("profile defaults blank, hides expired events and only saves explicit choices or removal", async () => {
  const element = fakeElements(["profileEventCard", "profileEventSelect", "profileEventSave", "profileEventMessage"]);
  element("profileEventCard").dataset.customerId = "12";
  const posts = [];
  const context = vm.createContext({ window: {}, document: { getElementById: element }, todayText: () => "2026-10-31", serverApi: async (path, options = {}) => {
    if (!options.method) return { membership: { eventId: "", token: "original-token" }, events: [
      { id: "latest", name: "New event", endDate: "" },
      { id: "ended", name: "Expired event", endDate: "2026-10-30" }
    ] };
    const payload = JSON.parse(options.body);
    posts.push(payload);
    return { membership: { eventId: payload.eventId, token: "new-token" } };
  } });
  vm.runInContext(ui, context);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  context.window.EventSettings.bindProfile({ id: 12 });
  await tick();
  assert.equal(element("profileEventSelect").value, "");
  assert.match(element("profileEventSelect").innerHTML, /New event/, "Unlimited events must be available");
  assert.doesNotMatch(element("profileEventSelect").innerHTML, /Expired event/);
  assert.equal(posts.length, 0);
  element("profileEventSelect").handlers.change({ target: { value: "latest" } });
  assert.equal(posts.length, 0, "Changing the dropdown alone must never save");
  assert.equal(context.window.EventSettings.hasPending, true);
  await element("profileEventSave").handlers.click();
  assert.equal(posts[0].customerId, "12");
  assert.equal(posts[0].eventId, "latest");
  assert.equal(context.window.EventSettings.hasPending, false);
  assert.equal(element("profileEventMessage").textContent, "", "Successful save must not leave an extra explanation below the controls");
  element("profileEventSelect").handlers.change({ target: { value: "" } });
  await element("profileEventSave").handlers.click();
  assert.equal(posts[1].eventId, "", "Blank saves an explicit removal");
  assert.equal(posts[1].token, "new-token");
  assert.equal(element("profileEventSelect").value, "");
});

test("unlimited events can be created without an end date and later given one", async () => {
  const element = fakeElements(["eventForm", "eventName", "eventStartDate", "eventEndDate", "eventUnlimited", "eventSubmit", "eventCancel", "eventFormTitle", "eventRows", "eventFields", "eventRefresh", "eventMessage"]);
  element("eventMessage").classList = { toggle() {} };
  element("eventForm").reset = () => { for (const id of ["eventName", "eventStartDate", "eventEndDate"]) element(id).value = ""; };
  element("eventForm").scrollIntoView = () => {};
  element("eventName").focus = () => {};
  let stored = [];
  const posts = [];
  const context = vm.createContext({ window: {}, document: { getElementById: element }, todayText: () => "2026-10-31", entityId: () => "unlimited", editIcon: () => "edit", trashIcon: () => "delete", activeView: "events", renderInfoHeader() {}, showToast() {}, serverApi: async (path, options = {}) => {
    if (!options.method) return { events: stored };
    const body = JSON.parse(options.body); posts.push(body);
    stored = [{ ...body, version: body.version + 1, registrationCount: 0 }];
    return { event: stored[0] };
  } });
  vm.runInContext(ui, context);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  context.window.EventSettings.render(); await tick();
  assert.equal(element("eventUnlimited").checked, true);
  assert.equal(element("eventEndDate").disabled, true);
  element("eventName").value = "Хугацаагүй арга хэмжээ";
  element("eventForm").handlers.submit({ preventDefault() {} }); await tick();
  assert.equal(posts[0].endDate, "");
  assert.match(element("eventRows").innerHTML, /Хугацаагүй/);
  await element("eventRows").handlers.click({ target: { closest: () => ({ dataset: { eventEdit: "unlimited" } }) } });
  element("eventUnlimited").handlers.change({ target: { checked: false } });
  assert.equal(element("eventEndDate").disabled, false);
  element("eventEndDate").value = "2026-11-30";
  element("eventForm").handlers.submit({ preventDefault() {} }); await tick();
  assert.equal(posts[1].endDate, "2026-11-30");
  assert.equal(posts[1].id, "unlimited");
});

test("event UI uses Mongolian labels and requires only the start date", () => {
  assert.match(html, /id="eventStartDate" type="date" required/);
  assert.match(html, /id="eventEndDate" type="date" disabled/);
  assert.match(html, /id="eventUnlimited" type="checkbox" checked/);
  assert.match(html, /Арга хэмжээний тайлан/);
  assert.match(ui, /profile-card-title">Арга хэмжээ/);
  assert.doesNotMatch(html, />Event(?:\s|<)/);
});

test("creation is cardless, both management titles are removed, and checkbox uses the theme", () => {
  assert.match(html, /<section class="event-create-section" aria-label="Арга хэмжээ үүсгэх">/);
  assert.doesNotMatch(html, /id="eventFormTitle"|<h2>Арга хэмжээний жагсаалт<\/h2>|Хоосон бол хугацаагүй/);
  const styles = read("styles.css");
  assert.match(styles, /\.event-create-section\s*\{[^}]*margin-bottom:\s*20px;/);
  assert.match(styles, /input\[type="checkbox"\]\s*\{[^}]*accent-color:\s*var\(--accent\)/);
});

test("event report is an independent dashboard tab and does not fetch financial analytics", () => {
  const element = fakeElements(["dashboardView", "eventDashboard", "dashboardContent", "dashboardMonth", "dashboardFromDate", "dashboardToDate", "dashboardExportExcel"]);
  for (const id of ["dashboardMonth", "dashboardFromDate", "dashboardToDate"]) element(id).closest = () => element(id).parentElement;
  let mode = "events";
  let reports = 0;
  let analytics = 0;
  const context = vm.createContext({
    document: { getElementById: element },
    dashboardSelectedViewMode: () => mode,
    window: { EventSettings: { renderDashboard: () => reports++ } },
    renderDashboardViewTabs: value => assert.equal(value, "events"),
    monthText: () => "2026-10", todayText: () => "2026-10-31", isSalonAccount: () => false,
    dashboardDateRange: () => ({ from: "", to: "" }), IS_LOCAL_RUNTIME: false, dashboardDataCache: null,
    dashboardAnalyticsKey: () => "key", loadDashboardAnalyticsSource: () => analytics++
  });
  const renderSource = app.slice(app.indexOf("function renderDashboard()"), app.indexOf("function releaseRenderedView("));
  // Only the requested function is invoked; later declarations remain inert.
  vm.runInContext(renderSource, context);
  context.renderDashboard();
  assert.equal(element("eventDashboard").hidden, false);
  assert.equal(element("dashboardContent").hidden, true);
  assert.equal(reports, 1);
  assert.equal(analytics, 0);
  mode = "overview";
  context.renderDashboard();
  assert.equal(element("eventDashboard").hidden, true);
  assert.equal(element("dashboardContent").hidden, false);
  assert.equal(element("dashboardMonth").parentElement.hidden, false);
  assert.equal(analytics, 1);
});

test("event dashboard loads once and sends all, monthly and single filters with the selected salon", async () => {
  const element = fakeElements(["eventDashboard", "eventReportMode", "eventReportMonth", "eventReportEvent", "eventReportRefresh", "eventReportMessage", "eventReportTotals", "eventReportRows", "eventReportSalons", "dashboardSalon"]);
  element("eventReportMode").value = "month";
  element("dashboardSalon").value = "Salon 2";
  const queries = [];
  const context = vm.createContext({ window: {}, URLSearchParams, document: { getElementById: element }, todayText: () => "2026-10-31", serverApi: async path => {
    if (path === "events.php") return { events: [{ id: "ended", name: "Expired event", startDate: "2026-09-01", endDate: "2026-09-30" }] };
    queries.push(new URLSearchParams(path.split("?")[1]));
    return { summary: { eventCount: 1, registrations: 2, customers: 2, salons: { "Salon 2": 2 }, events: [{ name: "Safe <name>", startDate: "2026-10-01", endDate: "2026-10-31", registrationCount: 2 }] } };
  } });
  vm.runInContext(ui, context);
  await context.window.EventSettings.renderDashboard();
  await context.window.EventSettings.renderDashboard();
  assert.equal(queries.length, 1, "Rerendering should not create repeated report requests");
  assert.equal(queries[0].get("filter"), "month");
  assert.equal(queries[0].get("month"), "2026-10");
  assert.equal(queries[0].get("salon"), "Salon 2");
  assert.match(element("eventReportEvent").innerHTML, /Expired event/, "Old events remain selectable in reports");
  assert.match(element("eventReportRows").innerHTML, /Safe &lt;name&gt;/);
  element("eventReportMode").value = "all";
  await context.window.EventSettings.renderDashboard(true);
  assert.equal(queries.at(-1).get("filter"), "all");
  element("eventReportMode").value = "single";
  element("eventReportEvent").value = "ended";
  await context.window.EventSettings.renderDashboard(true);
  assert.equal(queries.at(-1).get("eventId"), "ended");
});
