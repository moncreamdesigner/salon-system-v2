import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const start = app.indexOf('  const pages = {', app.indexOf('function renderDashboard('));
const end = app.indexOf('\n  content.innerHTML = (pages[viewMode]', start);
function pages(overrides = {}) {
  const context = vm.createContext({
    snapshot: Object.freeze({ revenue: 1000, serviceRevenue: 800, products: 200, visits: 8, completion: 90, outstanding: 50, newCustomers: 2 }),
    month: { key: '2026-11', label: 'November' }, growth: 10, revenueNote: 'growth', customerCount: 7,
    scopeText: 'A', revenueVisual: 'revenue-chart', branchRows: [{ name: 'A' }], branchVisual: 'branch-chart',
    serviceVisual: 'service-chart', paymentVisual: 'payment-chart', activeGroupCount: 3, activeCourseCount: 4,
    bonusBalance: 5, staffVisual: 'staff-chart', topServices: [{ name: 'Product', count: 2, revenue: 100 }],
    demographics: { genders: [], ages: [], districts: [] },
    formatNumber: String, money: value => `${value}₮`, htmlSafe: String, dashboardCompactMoney: String,
    dashboardChartControls: () => '', dashboardDonutMarkup: () => '', dashboardVerticalBars: () => '', dashboardDistrictMarkup: () => '',
    dashboardCashflowHtml: () => '<section>cashflow-data</section>', dashboardOperationsHtml: () => '<section><h3>Өдрийн ажиллагаа</h3></section>', showStaffDetails: true, showOperations: true, salon: '', ...overrides
  });
  vm.runInContext(app.slice(start, end) + '\nthis.reportPages = pages;', context);
  return context.reportPages;
}

test('sales begins with headline KPIs and preserves income graphs and cashflow without an overview tab', () => {
  assert.equal(pages().overview, undefined);
  const page = pages().sales();
  assert.match(page, /Нийт орлого[\s\S]*1000₮/);
  assert.match(page, /Орлогын өөрчлөлт/);
  assert.match(page, /Салбарын үзүүлэлт/);
  assert.doesNotMatch(page, /<h3>Хэрэглэгч ба бонус|Хэрэглэгчийн бүтэц|Ажилтны гүйцэтгэл/);
  assert.ok(page.indexOf('Нийт орлого') < page.indexOf('Үйлчилгээний бүтэц'));
  assert.ok(page.indexOf('cashflow-data') > page.indexOf('Эрэлттэй үйлчилгээ'));
});

test('staff and operations share a page while preserving financial detail permissions', () => {
  const admin = pages().staff();
  assert.ok(admin.indexOf('Ажилтны гүйцэтгэл') < admin.indexOf('Өдрийн ажиллагаа'));
  const branch = pages({ showStaffDetails: false }).staff();
  assert.match(branch, /Өдрийн ажиллагаа/);
  assert.doesNotMatch(branch, /Ажилтны гүйцэтгэл|staff-chart/);
  const finance = pages({ showOperations: false }).staff();
  assert.match(finance, /Ажилтны гүйцэтгэл/);
  assert.doesNotMatch(finance, /Өдрийн ажиллагаа/);
});

test('merged money flow and operations display recorded values instead of legacy synthetic estimates', () => {
  const helper = name => { const start = app.indexOf(`function ${name}(`); return app.slice(start, app.indexOf('\nfunction ', start + 1)); };
  const c = vm.createContext({ dashboardDataCache: { summary: {
    sourceTotals: { '2026-11|A': { single: 300, course: 500, product: 200 } },
    operations: { bookings: 7, statusCounts: { confirmed: 3, pending: 1, cancelled: 2, rejected: 1 }, activeTreatments: 2, workingStaff: 4, activeAssignments: 1 }
  } }, state: {}, formatNumber: String, htmlSafe: String, todayText: () => '2026-11-14', dashboardDonutMarkup: rows => JSON.stringify(rows) });
  vm.runInContext(helper('dashboardCashflowHtml') + '\n' + helper('dashboardOperationsHtml'), c);
  const cash = c.dashboardCashflowHtml({ key: '2026-11', label: 'November' }, 'A', { revenue: 1000 });
  assert.match(cash, /"amount":300/); assert.match(cash, /"amount":500/); assert.match(cash, /"amount":200/);
  assert.doesNotMatch(cash, /Авлагын насжилт|Сарын тулгалт|16\/18/);
  const operations = c.dashboardOperationsHtml({}, 'A', {});
  assert.match(operations, /<strong>7<\/strong>/);
  assert.match(operations, /<strong>2<\/strong>/);
  assert.doesNotMatch(operations, /Өнөөдрийн орлого|Цагийн дүүргэлт|Ажилтны өнөөдрийн ачаалал/);
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
    for (const key of ['sales', 'customers']) assert.equal(values.includes(key), role !== 'salon', `${role}: ${key}`);
    assert.ok(values.includes('staff'));
    assert.equal(Array.from(c.dashboardReportCapabilities()).includes('overview'), role !== 'salon');
    for (const removed of ['overview', 'cashflow', 'operations']) assert.ok(!values.includes(removed));
    assert.ok(values.includes('time')); assert.ok(!values.includes('attendance')); assert.ok(values.includes('events'));
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
  assert.match(css, /\.dashboard-grid\.dashboard-sales-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(app, /viewMode !== "sales" \? "" : dashboardChartModes.services/);
  assert.match(app, /viewMode !== "staff" \? "" : month.key === "all"/);
  assert.match(app, /dashboardWorksheet\("Хэрэглэгчийн бүтэц"/);
  assert.match(app, /dashboardWorksheet\("Ажилтны гүйцэтгэл"/);
});
