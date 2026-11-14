import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const start = app.indexOf('  const pages = {', app.indexOf('function renderDashboard('));
const end = app.indexOf('\n  content.innerHTML = (pages[viewMode]', start);
function pages() {
  const context = vm.createContext({
    snapshot: Object.freeze({ revenue: 1000, serviceRevenue: 800, products: 200, visits: 8, completion: 90, outstanding: 50, newCustomers: 2 }),
    month: { key: '2026-11', label: 'November' }, growth: 10, revenueNote: 'growth', customerCount: 7,
    scopeText: 'A', revenueVisual: 'revenue-chart', branchRows: [{ name: 'A' }], branchVisual: 'branch-chart',
    serviceVisual: 'service-chart', paymentVisual: 'payment-chart', activeGroupCount: 3, activeCourseCount: 4,
    bonusBalance: 5, staffVisual: 'staff-chart', topServices: [{ name: 'Product', count: 2, revenue: 100 }],
    demographics: { genders: [], ages: [], districts: [] },
    formatNumber: String, money: value => `${value}₮`, htmlSafe: String, dashboardCompactMoney: String,
    dashboardChartControls: () => '', dashboardDonutMarkup: () => '', dashboardVerticalBars: () => '', dashboardDistrictMarkup: () => ''
  });
  vm.runInContext(app.slice(start, end) + '\nthis.reportPages = pages;', context);
  return context.reportPages;
}

test('overview retains only headline KPIs, income trend and branch income', () => {
  const page = pages().overview();
  assert.match(page, /Нийт орлого[\s\S]*1000₮/);
  assert.match(page, /Орлогын өөрчлөлт/);
  assert.match(page, /Салбарын үзүүлэлт/);
  assert.doesNotMatch(page, /<h3>Хэрэглэгч ба бонус|Хэрэглэгчийн бүтэц|Ажилтны гүйцэтгэл|Үйлчилгээний бүтэц|Төлбөрийн төрөл|Эрэлттэй үйлчилгээ/);
});

test('each detail card moves intact into one matching group', () => {
  const sections = Object.fromEntries(Object.entries(pages()).map(([key, render]) => [key, render()]));
  for (const [group, titles] of Object.entries({
    sales: ['Үйлчилгээний бүтэц', 'Төлбөрийн төрөл', 'Эрэлттэй үйлчилгээ, бүтээгдэхүүн'],
    customers: ['Хэрэглэгч ба бонус', 'Хэрэглэгчийн бүтэц'],
    staff: ['Ажилтны гүйцэтгэл']
  })) for (const title of titles) {
    assert.ok(sections[group].includes(`<h3>${title}</h3>`), title);
    for (const [other, content] of Object.entries(sections)) if (other !== group) assert.ok(!content.includes(`<h3>${title}</h3>`), `${title} duplicated in ${other}`);
  }
  assert.match(sections.customers, /Бүх салбарын нэгдсэн хэрэглэгчийн мэдээлэл/);
  assert.match(sections.staff, /түр томилгооны ажил үйлчилгээ хийсэн салбарт/);
  assert.match(sections.sales, /Product/);
});

test('group permissions preserve existing report access and do not expose overview data to salons', () => {
  const begin = app.indexOf('const dashboardViewModes = [');
  const finish = app.indexOf('\nfunction dashboardSelectedViewMode', begin);
  const c = vm.createContext({ activeAccount: { role: 'admin' } });
  vm.runInContext(app.slice(begin, finish), c);
  for (const role of ['admin', 'manager', 'finance', 'director', 'salon']) {
    c.activeAccount.role = role;
    const values = Array.from(c.dashboardAllowedViewModes(), item => item.value);
    for (const key of ['sales', 'customers', 'staff']) assert.equal(values.includes(key), role !== 'salon', `${role}: ${key}`);
    assert.ok(values.includes('time')); assert.ok(values.includes('attendance')); assert.ok(values.includes('events'));
    assert.equal(values.includes('system'), role === 'admin');
  }
});

test('tabs keep shared filters, chart controls, export and responsive navigation', () => {
  const begin = app.indexOf('document.getElementById("dashboardViewTabs")?.addEventListener');
  const finish = app.indexOf('document.getElementById("dashboardExportExcel")', begin);
  const handler = app.slice(begin, finish);
  assert.match(handler, /renderDashboard\(\)/);
  assert.doesNotMatch(handler, /dashboardMonth|dashboardSalon|dashboardFromDate|dashboardToDate|loadDashboardAnalyticsSource/);
  for (const id of ['dashboardMonth', 'dashboardSalon', 'dashboardFromDate', 'dashboardToDate']) assert.ok(html.includes(`id="${id}"`));
  assert.match(css, /\.dashboard-view-tabs\s*\{[^}]*flex-wrap: wrap/s);
  assert.match(css, /\.dashboard-view-tab\s*\{[^}]*white-space: nowrap/s);
  assert.match(app, /viewMode !== "sales" \? "" : dashboardChartModes.services/);
  assert.match(app, /viewMode !== "staff" \? "" : month.key === "all"/);
  assert.match(app, /dashboardWorksheet\("Хэрэглэгчийн бүтэц"/);
  assert.match(app, /dashboardWorksheet\("Ажилтны гүйцэтгэл"/);
});
