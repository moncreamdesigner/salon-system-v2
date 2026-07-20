const money = value => `${Number(value).toLocaleString("en-US")}₮`;
const formatNumber = value => Number(value).toLocaleString("en-US");
const parseMoneyInput = value => Number(String(value || "").replace(/[^\d]/g, "")) || 0;
const moneyInputValue = value => Number(value || 0) > 0 ? formatNumber(value) : "";

const STORAGE_KEY = "khalgai_salon_local_mvp_v1";
const DATABASE_BACKUP_KEY = "khalgai_salon_database_backups_v1";
const PROTOTYPE_DATA_RESET_VERSION = 2;
const PROTOTYPE_SERVICE_RESET_KEY = `${STORAGE_KEY}:service-data-reset-v1`;
const DELETE_CODE = "1989";
const SERVER_API_BASE = "api";
const DEFAULT_CATALOG_VIEWER_HTML = window.KhalgaiFlipHtml5.DEFAULT_CODE;
const DEFAULT_CATALOG_DRAG_HINT_HTML = window.KhalgaiFlipHtml5.DEFAULT_HINT_HTML;
const DEFAULT_CATALOG_DRAG_HINT_CSS = window.KhalgaiFlipHtml5.DEFAULT_HINT_CSS;
let bookingDropdownCloseBound = false;
let nativeSelectCloseBound = false;
let serverStorageReady = false;
let serverStorageRevision = 0;
let serverSaveTimer = null;
let serverSaveInFlight = false;
let serverSavePending = false;
let serverRefreshInFlight = false;
let localStateMutationVersion = 0;
const pendingCustomerProfileUpdates = new Map();
const SIDEBAR_COMPACT_KEY = "khalgai_sidebar_compact_v1";

const defaultState = {
  salons: [
    { id: 1, name: "Хан-Уул салбар", address: "Хан-Уул дүүрэг, 2-р хороо, АПУ ХХК-ийн замын эсрэг талд, 75-р сургуулийн хойно 35Б байр.", phone: "80024373", active: true, bookings: 18, revenue: 1820000, staff: "8/9", status: "Ачаалал хэвийн", slotCapacity: 4 },
    { id: 2, name: "Төв салбар", address: "Чингэлтэй дүүрэг, 3-р хороо, Peace mall худалдааны төвийн хойно.", phone: "89894373", active: true, bookings: 22, revenue: 2140000, staff: "6/8", status: "Ажилтан хэрэгтэй", slotCapacity: 6 },
    { id: 3, name: "Вип салбар", address: "Хан-Уул дүүрэг, Вип өрөөтэй салбар.", phone: "80024444", active: true, bookings: 8, revenue: 860000, staff: "5/5", status: "Вип өрөөтэй", slotCapacity: 4 }
  ],
  customers: [],
  customerGroups: [],
  catalog: [],
  staff: [
    { id: 1, name: "Хулан", salon: "Хан-Уул салбар", vip: true, commission: "10%", status: "active" },
    { id: 2, name: "Болор", salon: "Төв салбар", vip: false, commission: "8%", status: "active" },
    { id: 3, name: "Номин", salon: "Вип салбар", vip: true, commission: "12%", status: "active" },
    { id: 4, name: "Солонго", salon: "Хан-Уул салбар", vip: false, commission: "9%", status: "active" }
  ],
  bookings: [],
  holidays: [],
  assignments: [],
  kassSchedules: [],
  services: [],
  audit: [],
  voucherRoles: [],
  voucherLogs: [],
  giftCards: [],
  selectedCustomerId: null,
  databaseOperationalDataCleared: true,
  scheduleSettings: {
    workStart: "09:00",
    workEnd: "19:00",
    weekendStart: "10:00",
    weekendEnd: "19:00",
    duration: 30
  },
  generalSettings: {
    diagnosisPhotoLimit: 5,
    diagnosisCaptureMode: "fixed",
    diagnosisCaptureSize: "1280x960",
    diagnosisJpegQuality: 0.92,
    deleteCode: "1989",
    kassEditDays: 3,
    serviceEditDays: 3,
    customerEditDays: 3
  },
  homepageSettings: {
    catalog: {
      flipHtml5Code: DEFAULT_CATALOG_VIEWER_HTML,
      dragHintEnabled: true,
      dragHintHtml: DEFAULT_CATALOG_DRAG_HINT_HTML,
      dragHintCss: DEFAULT_CATALOG_DRAG_HINT_CSS,
      adCoverDesktop: 0,
      adCoverMobile: 0
    },
    booking: {
      directoryHeadline: "ТА ӨӨРТ ОЙР САЛБАРТАА ЦАГ ЗАХИАЛААРАЙ"
    },
    salons: {},
    results: {
      categories: ["Бүгд"],
      posts: [{
        id: 1,
        title: "Үсний уналт багассан үр дүн",
        duration: "3 сарын үр дүн",
        description: "Үсний уналт багасаж, шинэ үсний ургалт нэмэгдсэн бодит үр дүн.",
        webUrl: "",
        images: ["", ""],
        beforeImage: "",
        afterImage: "",
        published: true
      }]
    }
  },
  diagnosisTypes: [
    "Буурал үстэй",
    "Голомтот халзралт",
    "Гэмтэлтэй",
    "Зоосон халзралт",
    "Нарийсалттай",
    "Үс суулгасан",
    "Үс уналттай",
    "Хагтай",
    "хоосон уутанцартай",
    "Хуйхны бохирдолтой",
    "Хуурайшилттай",
    "Хэт тослог",
    "Шингэрэлттэй",
    "Шинэ үсний ургалт бага",
    "Эмзэг хуйх",
    "Эрт бууралталт",
    "Эрүүл"
  ],
  customerTypes: ["Хэрэглэгч", "Тусгай хэрэглэгч", "Ажилтан"],
  customerTypeRules: {
    "Хэрэглэгч": { bonusPercent: 2, dynamic: true },
    "Тусгай хэрэглэгч": { bonusPercent: 10, dynamic: true },
    "Ажилтан": { bonusPercent: 10, dynamic: false }
  },
  pricePolicy: {
    vipRoomFee: 20000,
    masterStaffFee: 15000,
    bonusTiers: [
      { threshold: 0, percent: 2 },
      { threshold: 2000000, percent: 3 },
      { threshold: 3000000, percent: 4 },
      { threshold: 4000000, percent: 5 },
      { threshold: 5000000, percent: 6 },
      { threshold: 6000000, percent: 7 },
      { threshold: 7000000, percent: 8 },
      { threshold: 8000000, percent: 9 },
      { threshold: 9000000, percent: 10 }
    ]
  },
  discounts: []
};

let state = loadState();

state.salons = (Array.isArray(state.salons) && state.salons.length ? state.salons : structuredClone(defaultState.salons)).map((salon, index) => {
  const fallback = defaultState.salons.find(item => Number(item.id) === Number(salon?.id) || item.name === salon?.name) || {};
  return {
    ...fallback,
    ...salon,
    id: Number(salon?.id) || Number(fallback.id) || index + 1,
    bookings: Number(salon?.bookings ?? fallback.bookings ?? 0),
    revenue: Number(salon?.revenue ?? fallback.revenue ?? 0),
    staff: String(salon?.staff ?? fallback.staff ?? "0"),
    status: String(salon?.status ?? fallback.status ?? "Ачаалал хэвийн")
  };
});

function normalizeCustomerNamesWithoutSurname(targetState = state) {
  let changed = false;
  const customers = Array.isArray(targetState?.customers) ? targetState.customers : [];
  targetState.customers = customers.map(customer => {
    const surname = String(customer?.surname || "").trim();
    let name = String(customer?.name || "").trim();
    if (surname) {
      const escapedSurname = surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cleanedName = name.replace(new RegExp(`^${escapedSurname}(?:\\s+|$)`, "i"), "").trim();
      if (cleanedName) name = cleanedName;
    }
    const next = { ...customer, name };
    if (Object.prototype.hasOwnProperty.call(next, "surname")) {
      delete next.surname;
      changed = true;
    }
    if (name !== String(customer?.name || "").trim()) changed = true;
    return next;
  });
  return changed;
}

normalizeCustomerNamesWithoutSurname();

function resetPrototypeOperationalData() {
  if (Number(state.prototypeDataResetVersion || 0) >= PROTOTYPE_DATA_RESET_VERSION) return;
  [
    "customers", "customerGroups", "catalog", "bookings", "holidays", "assignments",
    "kassSchedules", "services", "audit", "voucherRoles", "voucherLogs", "giftCards", "discounts"
  ].forEach(key => {
    state[key] = [];
  });
  state.selectedCustomerId = null;
  state.permanentlyDeletedCustomerIds = [];
  state.databaseOperationalDataCleared = true;
  state.prototypeDataResetVersion = PROTOTYPE_DATA_RESET_VERSION;
  localStorage.removeItem(DATABASE_BACKUP_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clearTransientState(state)));
}

resetPrototypeOperationalData();
state.audit = (Array.isArray(state.audit) ? state.audit : []).map(item =>
  Object.prototype.hasOwnProperty.call(item, "createdAt") ? item : { ...item, createdAt: "" }
);
state.bookings = state.bookings.filter(booking => booking.status !== "cancelled");
state.holidays = Array.isArray(state.holidays) ? state.holidays : [];
state.kassSchedules = Array.isArray(state.kassSchedules) ? state.kassSchedules : [];
state.customerTypes = Array.isArray(state.customerTypes) && state.customerTypes.length ? state.customerTypes : [...defaultState.customerTypes];
state.customerTypes = state.customerTypes.map(type => type === "Шинэ хэрэглэгч" ? "Хэрэглэгч" : type);
if (!state.customerTypes.includes("Хэрэглэгч")) state.customerTypes.unshift("Хэрэглэгч");
state.customers = state.customers.map(customer => ({
  ...customer,
  type: customer.type === "Шинэ хэрэглэгч" ? "Хэрэглэгч" : customer.type
}));
state.customerGroups = Array.isArray(state.customerGroups) ? state.customerGroups : [];
ensureCustomerWorkflowData();
ensureCustomerAgeData();
state.customerTypeRules = {
  ...structuredClone(defaultState.customerTypeRules),
  ...(state.customerTypeRules || {})
};
if (state.customerTypeRules["Шинэ хэрэглэгч"] && !state.customerTypeRules["Хэрэглэгч"]) {
  state.customerTypeRules["Хэрэглэгч"] = state.customerTypeRules["Шинэ хэрэглэгч"];
}
delete state.customerTypeRules["Шинэ хэрэглэгч"];
state.customerTypes.forEach(type => {
  state.customerTypeRules[type] = {
    bonusPercent: type === "Тусгай хэрэглэгч" || type === "Ажилтан" ? 10 : 2,
    dynamic: type !== "Ажилтан",
    ...(state.customerTypeRules[type] || {})
  };
});
ensureEmployeeCustomerBonusRule(state);
state.pricePolicy = {
  ...structuredClone(defaultState.pricePolicy),
  ...(state.pricePolicy || {})
};
state.discounts = Array.isArray(state.discounts) ? state.discounts : [];
state.voucherRoles = Array.isArray(state.voucherRoles) ? state.voucherRoles : [];
state.voucherLogs = Array.isArray(state.voucherLogs) ? state.voucherLogs : [];
state.giftCards = Array.isArray(state.giftCards) ? state.giftCards : [];
state.generalSettings = {
  ...structuredClone(defaultState.generalSettings),
  ...(state.generalSettings || {})
};
state.homepageSettings = {
  ...structuredClone(defaultState.homepageSettings),
  ...(state.homepageSettings || {}),
  catalog: (() => {
    const stored = state.homepageSettings?.catalog || {};
    const hasSavedCode = Object.prototype.hasOwnProperty.call(stored, "flipHtml5Code");
    const hasLegacyCode = Object.prototype.hasOwnProperty.call(stored, "customViewerHtml");
    const savedCode = hasSavedCode
      ? String(stored.flipHtml5Code ?? "")
      : hasLegacyCode
        ? String(stored.customViewerHtml ?? "")
        : DEFAULT_CATALOG_VIEWER_HTML;
    return {
      flipHtml5Code: savedCode,
      dragHintEnabled: stored.dragHintEnabled !== false,
      dragHintHtml: stored.dragHintHtml || DEFAULT_CATALOG_DRAG_HINT_HTML,
      dragHintCss: stored.dragHintCss || DEFAULT_CATALOG_DRAG_HINT_CSS,
      adCoverDesktop: Math.max(0, Math.min(300, Number(stored.adCoverDesktop) || 0)),
      adCoverMobile: Math.max(0, Math.min(300, Number(stored.adCoverMobile) || 0))
    };
  })(),
  salons: { ...(state.homepageSettings?.salons || {}) },
  results: { ...structuredClone(defaultState.homepageSettings.results), ...(state.homepageSettings?.results || {}) }
};
stripLegacyEmbeddedImages(state);
localStorage.setItem(STORAGE_KEY, JSON.stringify(clearTransientState(state)));
state.diagnosisTypes = Array.isArray(state.diagnosisTypes) && state.diagnosisTypes.length ? state.diagnosisTypes : [...defaultState.diagnosisTypes];
normalizeStoredNames();
// Бодит ажилтны мэдээллийг source code-д seed хэлбэрээр хадгалахгүй.
const humanResourceSeed = [];
ensureHumanResourcesData();
state.assignments = (Array.isArray(state.assignments) ? state.assignments : []).map((assignment, index) => {
  const staff = state.staff.find(item => Number(item.id) === Number(assignment.staffId) || item.name === assignment.staff);
  return {
    id: Number(assignment.id) || index + 1,
    staffId: Number(assignment.staffId) || Number(staff?.id) || null,
    staff: assignment.staff || staff?.name || "",
    from: assignment.from || staff?.salon || "",
    to: assignment.to || "",
    startDate: assignment.startDate || assignment.date || "",
    endDate: assignment.endDate || assignment.date || "",
    startTime: assignment.startTime || String(assignment.time || "09:00-20:00").split("-")[0] || "09:00",
    endTime: assignment.endTime || String(assignment.time || "09:00-20:00").split("-")[1] || "20:00",
    reason: assignment.reason || "Салбарын ачаалал нөхөх",
    status: assignment.status || "active"
  };
});
removePaginationDemoData();
let activeView = "bookings";
let bookingTimeOptions = [];
let branchEditingId = null;
let branchGalleryDraft = [];
let humanResourceEditingId = null;
let assignmentEditingId = null;
let assignmentPage = 1;
let diagnosisCameraStream = null;
let voucherRoleEditingId = null;
let systemUsers = [];
let serverDatabaseBackups = [];
let serverBackupIntervalDays = 14;
let systemUserEditingId = null;
let systemUserMigratingLegacy = false;
let systemUsersLoaded = false;
const retiredViews = new Set(["services", "payments", "reports", "catalog", "staff"]);
let activeAccount = { id: 0, username: "", displayName: "Админ", role: "admin", salon: "" };

const dashboardDemoData = {
  months: [
    { key: "2026-07", label: "2026 оны 7 сар", short: "7 сар", revenue: 0, payments: 0, visits: 0, products: 0, newCustomers: 0, outstanding: 0, completion: 0, occupancy: 0 }
  ],
  branches: [
    { name: "Хан-Уул салбар", share: 0, completionDelta: 0, occupancyDelta: 0 },
    { name: "Төв салбар", share: 0, completionDelta: 0, occupancyDelta: 0 },
    { name: "Вип салбар", share: 0, completionDelta: 0, occupancyDelta: 0 }
  ],
  services: [
    { name: "Курс эмчилгээ", share: 0, color: "#60bf63" },
    { name: "Нэг удаагийн үйлчилгээ", share: 0, color: "#91cf86" },
    { name: "Касс бүтээгдэхүүн", share: 0, color: "#bfdcae" },
    { name: "Оношилгоо", share: 0, color: "#dfe9d7" }
  ],
  payments: [
    { name: "Карт", share: 0, color: "#60bf63" },
    { name: "QPay", share: 0, color: "#87c77e" },
    { name: "Бэлэн", share: 0, color: "#b7d9aa" },
    { name: "Ваучер / карт", share: 0, color: "#dfe9d7" }
  ],
  topServices: []
};
let activeServiceMainTab = "single";
let activeProductGroup = "gift";
let activeDatabaseTab = "import";
let activeHomepageSettingsTab = "catalog";
let homepageResultEditingId = null;
let homepageResultEditorRange = null;
let serviceEditingRef = null;
let customerPage = 1;
let holidayEditingId = null;
let customerTypeEditingName = null;
let kassEditingId = null;
let kassPage = 1;
let kassRevenuePage = 1;
let activePerformanceTab = "revenue";
let auditPage = 1;
let bookingPage = 1;
let voucherPage = 1;
let giftCardPage = 1;
let giftCardEditingId = null;
let customerSortMode = "date";
let discountEditingId = null;

const serviceSettingsData = {
  single: [
    { code: "20019", name: "Гүн тэжээлийн эмчилгээ", customer: "Том хүн", price: 55000 },
    { code: "20006", name: "Гүн цэвэрлэгээ /гэмтэлтэй үсний/", customer: "Том хүн", price: 45000 },
    { code: "20020", name: "Тэжээлийн эмчилгээ", customer: "Том хүн", price: 75000 },
    { code: "20009", name: "Үүргийн эмчилгээ", customer: "Том хүн", price: 90000 },
    { code: "20015", name: "Халгайн хандны эмчилгээ", customer: "Том хүн", price: 90000 },
    { code: "20025", name: "Эмзэг хуйхны эмчилгээ", customer: "Том хүн", price: 100000 },
    { code: "20017", name: "Энгийн угаалт", customer: "Том хүн", price: 12000 },
    { code: "20036", name: "Бактерийн эсрэг эмчилгээ хүүхэд", customer: "Хүүхэд", price: 70000 },
    { code: "20007", name: "Гүн цэвэрлэгээ /хүүхэд/", customer: "Хүүхэд", price: 25000 },
    { code: "20008", name: "Тэжээлийн эмчилгээ / хүүхэд /", customer: "Хүүхэд", price: 50000 },
    { code: "20037", name: "Халгайн хандны эмчилгээ хүүхэд", customer: "Хүүхэд", price: 55000 },
    { code: "", name: "Энгийн угаалт", customer: "Хүүхэд", price: 10000 }
  ],
  course: [
    { code: "20010", name: "Буурал үсний эсрэг курс эмчилгээ/8 удаагийн оролт/", customer: "Том хүн", price: 650000, visits: "8 удаа" },
    { code: "20013", name: "Гэмтэлтэй үсний курс эмчилгээ /4 удаагийн оролт/", customer: "Том хүн", price: 300000, visits: "4 удаа" },
    { code: "20027", name: "Тослог үсний курс эмчилгээ /4 удаагийн оролт/", customer: "Том хүн", price: 300000, visits: "4 удаа" },
    { code: "20029", name: "Үүргийн курс эмчилгээ /8 удаагийн оролт/", customer: "Том хүн", price: 650000, visits: "8 удаа" },
    { code: "20012", name: "Үс ургуулах курс эмчилгээ /8 удаагийн оролт/", customer: "Том хүн", price: 540000, visits: "8 удаа" },
    { code: "20026", name: "Хагны эсрэг курс эмчилгээ /4 удаагийн оролт/", customer: "Том хүн", price: 300000, visits: "4 удаа" },
    { code: "20028", name: "Хуурай үсний курс эмчилгээ /4 удаагийн оролт/", customer: "Том хүн", price: 300000, visits: "4 удаа" },
    { code: "20024", name: "Эмзэг хуйхны курс эмчилгээ /4 удаагийн оролт/", customer: "Том хүн", price: 360000, visits: "4 удаа" },
    { code: "20038", name: "Буурал үсний эсрэг курс эмчилгээ хүүхэд /8удаагийн оролт/", customer: "Хүүхэд", price: 420000, visits: "8 удаа" },
    { code: "20039", name: "Тослог үсний эмчилгээ хүүхэд /4удаагийн оролт/", customer: "Хүүхэд", price: 150000, visits: "4 удаа" },
    { code: "20040", name: "Үс ургуулах курс эмчилгээ /8удаагийн оролт/", customer: "Хүүхэд", price: 350000, visits: "8 удаа" },
    { code: "20041", name: "Хагны эсрэг эмчилгээ хүүхэд /4удаагийн оролт/", customer: "Хүүхэд", price: 150000, visits: "4 удаа" },
    { code: "20042", name: "Хуурай үсний эмчилгээ хүүхэд /4удаагийн оролт/", customer: "Хүүхэд", price: 150000, visits: "4 удаа" },
    { code: "20043", name: "Эмзэг хуйхны эмчилгээ хүүхэд /4удаагийн оролт/", customer: "Хүүхэд", price: 180000, visits: "4 удаа" }
  ],
  products: {
    gift: [
      { code: "10054", name: "Бэлгийн карт 150К", price: 150000 },
      { code: "10053", name: "Бэлгийн карт 50К", price: 50000 },
      { code: "10055", name: "Бэлгийн карт 75К", price: 75000 }
    ],
    bundle: [
      { code: "11090", name: "Др.Уна багц 2 той", price: 16000 },
      { code: "11077", name: "Залуус үс арчилгааны багц-250 тай шампунь, 250 тай ангижруулагч", price: 18000 },
      { code: "11093", name: "Итгэлт багц-Нано шампунь-550, ангижруулагч-400", price: 39000 },
      { code: "11141", name: "Торгомсог багц-Др Уна биеийн саван-500, биеийн тос-500", price: 50000 },
      { code: "10027", name: "Үс ургуулах багц", price: 67000, sale: 66000, saleNote: "/3+ш" },
      { code: "11074", name: "Үсээ хайрлая багц - Халгай шампунь-450, Ангижруулагч-450", price: 31500 },
      { code: "11076", name: "Халгай Амар арчилгаа багц 2 той 2026", price: 30000 },
      { code: "11088", name: "Халгай Аялал бэлгийн багц", price: 9000 },
      { code: "11137", name: "Халгай буурал үс минь баяртай багц- Халгай буурал үсний эсрэг шампунь-450мл, Халгай буурал үсний эсрэг ангижруулагч-450мл", price: 45000 },
      { code: "10010", name: "Халгай буурал үсний эсрэг багц 5 тай", price: 106000, sale: 104000, saleNote: "/3+ш" },
      { code: "11071", name: "Цэвэр гар Эрүүл шүд багц-2", price: 15300 },
      { code: "11073", name: "Цэмбий багц- Др.Уна-гарын хөөсөн саван-300, шүдний оо", price: 12000 },
      { code: "11072", name: "Эзэгтэй багц- Аяга угаагч хөөс 300 мл, Гарын хөөсөн саван -300мл, Аяга угаагч порлон, Гал тогооны 3тай алчуур", price: 20000 },
      { code: "11095", name: "Энхрий багц", price: 24400 }
    ],
    druna: [
      { code: "11151", name: "Др.Уна буйлны үрэвслийн эсрэг шүдний оо 100", price: 8600, sale: 8400, saleNote: "/3+ш" },
      { code: "11123", name: "Др.Уна гарын хөөсөн саван-Тэжээлийн 3000", price: 31500, sale: 31000, saleNote: "/3+ш" },
      { code: "11124", name: "Др.Уна гарын хөөсөн саван-Тэжээлийн 5000", price: 49500, sale: 48500, saleNote: "/3+ш" },
      { code: "10042", name: "Др.Уна жамц давстай аяга угаагч хөөс 3000", price: 36000, sale: 35200, saleNote: "/3+ш" },
      { code: "10007", name: "Др.Уна жамц давстай аяга угаагч хөөс 500", price: 11700, sale: 11400, saleNote: "/3+ш" },
      { code: "11127", name: "Др.Уна нимбэгтэй аяга угаагч хөөс 3000", price: 36000, sale: 35200, saleNote: "/3+ш" },
      { code: "11126", name: "Др.Уна нимбэгтэй аяга угаагч хөөс 500", price: 11700, sale: 11400, saleNote: "/3+ш" },
      { code: "11128", name: "Др.Уна нимбэгтэй аяга угаагч хөөс 5000", price: 52200, sale: 51000, saleNote: "/3+ш" },
      { code: "11108", name: "Др.Уна тэжээлийн хөөсөн саван 300", price: 6800, sale: 6600, saleNote: "/3+ш" },
      { code: "11114", name: "Др.Уна тэжээлийн хөөсөн саван 450", price: 9000, sale: 8700, saleNote: "/3+ш" },
      { code: "11120", name: "Др.Уна цагаан будааны хандтай биеийн саван 500", price: 22500, sale: 22000, saleNote: "/3+ш" },
      { code: "11119", name: "Др.Уна цагаан будааны хандтай биеийн тос 500", price: 22500, sale: 22000, saleNote: "/3+ш" },
      { code: "11115", name: "Др.Уна чийгшүүлэгчтэй гарын хөөсөн саван 300", price: 6800, sale: 6600, saleNote: "/3+ш" },
      { code: "11115", name: "Др.Уна чийгшүүлэгчтэй хөөсөн саван 300", price: 6800, sale: 6600, saleNote: "/3+ш" },
      { code: "10034", name: "Др.Уна чийгшүүлэгчтэй хөөсөн саван 450", price: 9000, sale: 8700, saleNote: "/3+ш" },
      { code: "10040", name: "Др.Уна шүд цайруулах оо 100", price: 8600, sale: 8400, saleNote: "/3+ш" },
      { code: "10045", name: "Др.Уна эрдэсстэй ампультай маск 450", price: 25000, sale: 22000 },
      { code: "10048", name: "Др.Уна эрдэсстэй биеийн тос 250", price: 25000, sale: 22000 },
      { code: "10062", name: "Др.Уна эрдэсстэй үс, биеийн шампунь 450", price: 25000, sale: 22000 }
    ],
    maalai: [
      { code: "10016", name: "Маалай моолой биеийн тос 250", price: 12200, sale: 11900, saleNote: "/3+ш" },
      { code: "10018", name: "Маалай моолой гарын хөөсөн саван 300", price: 8000, sale: 7800, saleNote: "/3+ш" },
      { code: "11091", name: "Маалай моолой гарын шингэн саван 250", price: 7200, sale: 7000, saleNote: "/3+ш" },
      { code: "11118", name: "Маалай моолой үс биеийн хөөсөн шампунь", price: 12200, sale: 119000, saleNote: "/3+ш" },
      { code: "10015", name: "Маалай моолой хүүхдийн багц", price: 36000, sale: 35500, saleNote: "/3+ш" },
      { code: "10019", name: "Маалай моолой чадарганатай хүүхдийн шүдний оо 80", price: 7200, sale: 7000, saleNote: "/3+ш" },
      { code: "10020", name: "Маалай моолой шампунь, биеийн саван 250", price: 12200, sale: 11900, saleNote: "/3+ш" }
    ],
    khalgai1000: [
      { code: "11136", name: "Халгай буурал үсний шампунь 1000", price: 35000, sale: 34200, saleNote: "/3+ш" },
      { code: "11150", name: "Халгай гэмтэлтэй үсний шампунь 1000", price: 26100, sale: 25500, saleNote: "/3+ш" },
      { code: "10038", name: "Халгай нано үс ургуулах шампунь 1000", price: 35000, sale: 34200, saleNote: "/3+ш" },
      { code: "11117", name: "Халгай тослог үсний эсрэг шампунь 1000", price: 26100, sale: 25500, saleNote: "/3+ш" },
      { code: "10026", name: "Халгай тэжээлийн шампунь 1000", price: 26100, sale: 25500, saleNote: "/3+ш" },
      { code: "10001", name: "Халгай үсний ангижруулагч 1000", price: 26100, sale: 25500, saleNote: "/3+ш" },
      { code: "11116", name: "Халгай хагны эсрэг шампунь 1000", price: 26100, sale: 25500, saleNote: "/3+ш" }
    ],
    buural: [
      { code: "10009", name: "Халгай буурал үсний эсрэг ангижруулагч 450", price: 20000, sale: 19400, saleNote: "/3+ш" },
      { code: "10011", name: "Халгай буурал үсний эсрэг маск 200", price: 18000, sale: 17200, saleNote: "/3+ш" },
      { code: "11143", name: "Халгай буурал үсний эсрэг серум 100", price: 20000 },
      { code: "10012", name: "Халгай буурал үсний эсрэг уураг 250", price: 30000, sale: 29000, saleNote: "/3+ш" },
      { code: "10013", name: "Халгай буурал үсний эсрэг шампунь 450", price: 20000, sale: 19400, saleNote: "/3+ш" }
    ],
    khalgai250: [
      { code: "11145", name: "Халгай гэмтэлтэй үсний шампунь 250", price: 9700, sale: 9500, saleNote: "/3+ш" },
      { code: "11146", name: "Халгай тослог үсний эсрэг шампунь 250", price: 9700, sale: 9500, saleNote: "/3+ш" },
      { code: "10036", name: "Халгай тэжээлийн шампунь 250", price: 9700, sale: 9500, saleNote: "/3+ш" },
      { code: "10004", name: "Халгай үсний ангижруулагч 250", price: 9700, sale: 9500, saleNote: "/3+ш" },
      { code: "11144", name: "Халгай хагны эсрэг шампунь 250", price: 9700, sale: 9500, saleNote: "/3+ш" }
    ],
    khalgai450: [
      { code: "11148", name: "Халгай гэмтэлтэй үсний шампунь 450", price: 15200, sale: 14800, saleNote: "/3+ш" },
      { code: "11149", name: "Халгай тослог үсний эсрэг шампунь 450", price: 15200, sale: 14800, saleNote: "/3+ш" },
      { code: "10037", name: "Халгай тэжээлийн шампунь 450", price: 15200, sale: 14800, saleNote: "/3+ш" },
      { code: "10006", name: "Халгай үсний ангижруулагч 450", price: 15200, sale: 14900, saleNote: "/3+ш" },
      { code: "11147", name: "Халгай хагны эсрэг шампунь 450", price: 15200, sale: 14800, saleNote: "/3+ш" }
    ],
    nano: [
      { code: "10005", name: "Халгай нано үс ургуулах ангижруулагч 400", price: 17600 },
      { code: "10021", name: "Халгай нано үс ургуулах маск 200", price: 13400, sale: 13200, saleNote: "/3+ш" },
      { code: "10039", name: "Халгай нано үс ургуулах шампунь 550", price: 22400, sale: 22000, saleNote: "/3+ш" },
      { code: "10028", name: "Халгай үс ургуулах серум 100", price: 20000 },
      { code: "10025", name: "Халгай үс ургуулах тэжээлийн тос 400", price: 13400, sale: 13200, saleNote: "/3+ш" }
    ],
    khalgai5000: [
      { code: "11131", name: "Халгай Нано үс ургуулах шампунь 5000", price: 90000, sale: 88000, saleNote: "/3+ш" },
      { code: "11132", name: "Халгай тэжээлийн шампунь 5000", price: 82800, sale: 81000, saleNote: "/3+ш" },
      { code: "11134", name: "Халгай үсний ангижруулагч 5000", price: 82800, sale: 81000, saleNote: "/3+ш" },
      { code: "11133", name: "Халгай хагны эсрэг шампунь 5000", price: 82800, sale: 81000, saleNote: "/3+ш" }
    ],
    other: [
      { code: "10043", name: "Халгай үс ургуулах хатуу шампунь 70", price: 13500, sale: 13200, saleNote: "/3+ш" },
      { code: "10022", name: "Халгай чадарганатай тэжээлийн маск 200", price: 13400, sale: 13200, saleNote: "/3+ш" },
      { code: "10044", name: "Халгай чадарганатай хатуу ангижруулагч 70", price: 13500, sale: 13200, saleNote: "/3+ш" },
      { code: "", name: "Цаасан уут", price: 400 },
      { code: "", name: "Эко тор", price: 600 }
    ]
  }
};

const defaultServiceSettingsData = structuredClone(serviceSettingsData);

function restoreCoreServiceSettingsIfMissing() {
  let changed = false;
  if (!Array.isArray(serviceSettingsData.single) || !serviceSettingsData.single.length) {
    serviceSettingsData.single = structuredClone(defaultServiceSettingsData.single);
    changed = true;
  }
  if (!Array.isArray(serviceSettingsData.course) || !serviceSettingsData.course.length) {
    serviceSettingsData.course = structuredClone(defaultServiceSettingsData.course);
    changed = true;
  }
  const productCount = Object.values(serviceSettingsData.products || {})
    .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  if (!productCount) {
    serviceSettingsData.products = structuredClone(defaultServiceSettingsData.products);
    changed = true;
  }
  if (changed) saveServiceSettings();
}

const SERVICE_SETTINGS_KEY = `${STORAGE_KEY}:service-settings`;

function loadServiceSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SERVICE_SETTINGS_KEY) || "null");
    if (!saved) return;
    if (saved.data) {
      serviceSettingsData.single = Array.isArray(saved.data.single) ? saved.data.single : serviceSettingsData.single;
      serviceSettingsData.course = Array.isArray(saved.data.course) ? saved.data.course : serviceSettingsData.course;
      serviceSettingsData.products = saved.data.products && typeof saved.data.products === "object" ? saved.data.products : serviceSettingsData.products;
    }
    if (Array.isArray(saved.groups) && saved.groups.length) {
      productGroups.splice(0, productGroups.length, ...saved.groups);
    }
    refreshProductGroupCounts();
  } catch (error) {
    localStorage.removeItem(SERVICE_SETTINGS_KEY);
  }
}

function saveServiceSettings() {
  localStorage.setItem(SERVICE_SETTINGS_KEY, JSON.stringify({
    data: serviceSettingsData,
    groups: productGroups
  }));
  queueServerStateSave();
}

function resetPrototypeProductCatalog() {
  if (localStorage.getItem(PROTOTYPE_SERVICE_RESET_KEY) === "1") return;
  Object.keys(serviceSettingsData.products || {}).forEach(key => {
    serviceSettingsData.products[key] = [];
  });
  refreshProductGroupCounts();
  saveServiceSettings();
  localStorage.setItem(PROTOTYPE_SERVICE_RESET_KEY, "1");
}

const productGroups = [
  ["gift", "Бэлгийн карт", 3],
  ["bundle", "Багц бүтээгдэхүүн", 14],
  ["druna", "Dr.Una брэнд", 19],
  ["maalai", "Маалай Моолой", 7],
  ["khalgai1000", "Халгай 1000", 7],
  ["buural", "Халгай Буурал үс", 5],
  ["khalgai250", "Халгай 250", 5],
  ["khalgai450", "Халгай 450", 5],
  ["nano", "Халгай Nano", 5],
  ["khalgai5000", "Халгай 5000", 4],
  ["other", "Халгай брэнд бусад", 5]
];

function productGroupCount(key) {
  return serviceSettingsData.products[key]?.length || 0;
}

function refreshProductGroupCounts() {
  productGroups.forEach(group => {
    group[2] = productGroupCount(group[0]);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return structuredClone(defaultState);
    return clearTransientState({ ...structuredClone(defaultState), ...saved });
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function clearTransientState(source) {
  const next = structuredClone(source);
  next.selectedCustomerId = null;
  (next.customers || []).forEach(customer => {
    clearCustomerUiState(customer);
  });
  (next.customerGroups || []).forEach(group => {
    delete group.editingName;
    delete group.directoryExpanded;
  });
  return next;
}

function clearCustomerUiState(customer) {
  if (!customer) return;
  delete customer.profileServiceOpen;
  delete customer.profileServiceKind;
  delete customer.profileServiceEditingIndex;
  delete customer.profileServiceEditMode;
  delete customer.profileKassGroup;
  delete customer.profileKassCart;
  delete customer.profileKassEditingIndex;
  delete customer.profileKassDraftSalon;
  delete customer.profileKassDraftDate;
  delete customer.profileInfoEditing;
  delete customer.profileJoinGroupOpen;
  (customer.serviceHistory || []).forEach(item => {
    delete item.expandedVisit;
    delete item.diagnosisOpen;
    delete item.paymentFormOpen;
  });
}

function saveState() {
  localStateMutationVersion += 1;
  const createdAt = auditNowText();
  state.audit.forEach(item => {
    if (!Object.prototype.hasOwnProperty.call(item, "createdAt")) item.createdAt = createdAt;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clearTransientState(state)));
  } catch (error) {
    console.warn("Local storage save skipped", error);
    if (["127.0.0.1", "localhost"].includes(window.location.hostname)) showToast("Browser-ийн хадгалах зай дүүрсэн байна");
  }
  queueServerStateSave();
}

function stripLegacyEmbeddedImages(targetState = {}) {
  const arrayKeys = new Set(["gallery", "images", "generalPhotos", "scopePhotos"]);
  const valueKeys = new Set(["coverImage", "beforeImage", "afterImage"]);
  let removed = 0;
  const isEmbeddedImage = value => typeof value === "string" && /^data:image\//i.test(value.trim());
  const walk = value => {
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, item]) => {
      if (arrayKeys.has(key) && Array.isArray(item)) {
        value[key] = item.map(entry => {
          if (!isEmbeddedImage(entry)) return entry;
          removed += 1;
          return "";
        });
        if (key === "gallery") value[key] = value[key].filter(Boolean);
        return;
      }
      if (valueKeys.has(key) && isEmbeddedImage(item)) {
        value[key] = "";
        removed += 1;
        return;
      }
      walk(item);
    });
  };
  walk(targetState);
  return removed;
}

function serverStateData() {
  return {
    ...clearTransientState(state),
    _serviceSettings: {
      data: structuredClone(serviceSettingsData),
      groups: structuredClone(productGroups)
    }
  };
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableJsonValue(value[key]);
      return result;
    }, {});
}

function stableJsonStringify(value) {
  return JSON.stringify(stableJsonValue(value));
}

async function serverApi(path, options = {}) {
  const response = await fetch(`${SERVER_API_BASE}/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "KhalgaiSalon",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({ ok: false, message: "Server хариу буруу байна." }));
  if (!response.ok) {
    const error = new Error(payload.message || "Server холболт амжилтгүй.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function applyServerData(data = {}) {
  const selectedCustomerId = Number(state?.selectedCustomerId || 0);
  const incoming = structuredClone(data || {});
  const serviceSettings = incoming._serviceSettings;
  delete incoming._serviceSettings;
  state = clearTransientState({ ...structuredClone(defaultState), ...incoming });
  ensureEmployeeCustomerBonusRule(state);
  applyPendingCustomerProfileUpdates(state);
  if (activeView === "profile" && selectedCustomerId && state.customers.some(customer => Number(customer.id) === selectedCustomerId && !customer.deleted)) {
    state.selectedCustomerId = selectedCustomerId;
  }
  const customerNamesChanged = normalizeCustomerNamesWithoutSurname(state);
  const embeddedImagesRemoved = stripLegacyEmbeddedImages(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (storageError) {
    localStorage.removeItem(STORAGE_KEY);
  }
  if (serviceSettings) {
    if (serviceSettings.data) {
      serviceSettingsData.single = Array.isArray(serviceSettings.data.single) ? serviceSettings.data.single : serviceSettingsData.single;
      serviceSettingsData.course = Array.isArray(serviceSettings.data.course) ? serviceSettings.data.course : serviceSettingsData.course;
      serviceSettingsData.products = serviceSettings.data.products && typeof serviceSettings.data.products === "object" ? serviceSettings.data.products : serviceSettingsData.products;
    }
    if (Array.isArray(serviceSettings.groups) && serviceSettings.groups.length) {
      productGroups.splice(0, productGroups.length, ...serviceSettings.groups);
    }
    try {
      localStorage.setItem(SERVICE_SETTINGS_KEY, JSON.stringify(serviceSettings));
    } catch (storageError) {
      localStorage.removeItem(SERVICE_SETTINGS_KEY);
    }
  }
  return customerNamesChanged || embeddedImagesRemoved > 0;
}

async function saveServerStateNow() {
  if (!serverStorageReady) return;
  if (serverSaveInFlight) {
    serverSavePending = true;
    return;
  }
  serverSaveInFlight = true;
  const savingMutationVersion = localStateMutationVersion;
  try {
    const result = await serverApi("state.php", {
      method: "PUT",
      body: JSON.stringify({ revision: serverStorageRevision, data: serverStateData() })
    });
    serverStorageRevision = Number(result.revision || serverStorageRevision);
    pendingCustomerProfileUpdates.forEach((update, customerId) => {
      if (Number(update.mutationVersion || 0) <= savingMutationVersion) pendingCustomerProfileUpdates.delete(customerId);
    });
  } catch (error) {
    if (error.status === 409 && error.payload?.conflict) {
      try {
        const remote = await serverApi("state.php");
        serverStorageRevision = Number(remote.revision || 0);
        applyServerData(remote.data || {});
        rerenderAll();
        setView(activeView);
        const retryingProfileUpdate = pendingCustomerProfileUpdates.size > 0;
        if (retryingProfileUpdate) serverSavePending = true;
        showToast(retryingProfileUpdate
          ? "Шинэ мэдээлэлтэй нэгтгээд профайлын өөрчлөлтийг дахин хадгалж байна"
          : "Өөр хэрэглэгч мэдээлэл шинэчилсэн тул хамгийн сүүлийн хувилбарыг ачааллаа. Үйлдлээ дахин хийнэ үү");
        return;
      } catch (refreshError) {
        console.error("Conflict refresh failed", refreshError);
      }
    }
    console.error("Server save failed", error);
    showToast("Server хадгалалт түр амжилтгүй боллоо");
  } finally {
    serverSaveInFlight = false;
    if (serverSavePending) {
      serverSavePending = false;
      queueServerStateSave(100);
    }
  }
}

function queueServerStateSave(delay = 450) {
  if (!serverStorageReady) return;
  clearTimeout(serverSaveTimer);
  serverSaveTimer = setTimeout(() => {
    serverSaveTimer = null;
    void saveServerStateNow();
  }, delay);
}

function hideServerLogin() {
  document.getElementById("serverLoginOverlay")?.remove();
}

function showServerLogin(message = "Системд нэвтэрнэ үү") {
  let overlay = document.getElementById("serverLoginOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "serverLoginOverlay";
    overlay.className = "server-login-overlay";
    overlay.innerHTML = `
      <form class="server-login-card" id="serverLoginForm" novalidate>
        <img src="assets/khalgai-salon-logo.png" alt="Халгай салбар">
        <h1>Системд нэвтрэх</h1>
        <p id="serverLoginMessage"></p>
        <label>Нэвтрэх нэр<input class="input" id="serverLoginUsername" autocomplete="username" required></label>
        <label>Нууц үг<input class="input" id="serverLoginPassword" type="password" autocomplete="current-password" required></label>
        <button class="primary-btn" type="submit">Нэвтрэх</button>
      </form>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#serverLoginForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      try {
        const loginResult = await serverApi("login.php", {
          method: "POST",
          body: JSON.stringify({
            username: overlay.querySelector("#serverLoginUsername").value.trim(),
            password: overlay.querySelector("#serverLoginPassword").value
          })
        });
        applyActiveAccount(loginResult.user);
        hideServerLogin();
        await synchronizeServerState();
        rerenderAll();
        setView(activeView);
      } catch (error) {
        overlay.querySelector("#serverLoginMessage").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }
  overlay.querySelector("#serverLoginMessage").textContent = message;
}

async function synchronizeServerState(expectedLocalVersion = null) {
  const remote = await serverApi("state.php");
  if (expectedLocalVersion !== null && expectedLocalVersion !== localStateMutationVersion) return false;
  serverStorageRevision = Number(remote.revision || 0);
  if (remote.empty) {
    serverStorageReady = true;
    await saveServerStateNow();
    showToast("Одоогийн мэдээллийг server database-д хадгаллаа");
    return false;
  }
  const localJson = stableJsonStringify(serverStateData());
  const remoteJson = stableJsonStringify(remote.data || {});
  if (localJson !== remoteJson) {
    const customerNamesChanged = applyServerData(remote.data || {});
    serverStorageReady = true;
    if (customerNamesChanged) await saveServerStateNow();
    return true;
  }
  serverStorageReady = true;
  return false;
}

async function initializeServerStorage() {
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    hideServerLogin();
    rerenderAll();
    setView(activeView);
    return;
  }
  try {
    const status = await serverApi("status.php");
    if (!status.authenticated) {
      showServerLogin("Server database-д нэвтэрч мэдээллээ ачаална уу");
      return;
    }
    applyActiveAccount(status.user);
    await synchronizeServerState();
    await loadDatabaseBackups({ silent: true });
    rerenderAll();
    setView(activeView);
  } catch (error) {
    if (error.status === 401) {
      showServerLogin(error.message);
      return;
    }
    console.error("Server storage unavailable", error);
    showServerLogin(error.message || "Server database тохиргоо хийгдээгүй байна");
  }
}

const AUTO_REFRESH_VIEWS = new Set(["bookings", "customers", "kass", "vouchers", "giftCards", "groups", "audit", "dashboard", "performance"]);

async function refreshServerStateForView(viewName = activeView) {
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  if (!serverStorageReady || serverRefreshInFlight || serverSaveTimer || serverSaveInFlight || serverSavePending) return;
  const refreshVersion = localStateMutationVersion;
  serverRefreshInFlight = true;
  try {
    const changed = await synchronizeServerState(refreshVersion);
    if (!changed || activeView !== viewName) return;
    rerenderAll();
    if (activeView !== "performance") renderInfoHeader(activeView);
  } catch (error) {
    console.error("Server refresh failed", error);
  } finally {
    serverRefreshInFlight = false;
  }
}

function auditNowText() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function removePaginationDemoData() {
  if (!state.paginationDemoSeedV1) return;
  const seededOn = "2026-07-17";
  const salons = state.salons.map(item => item.name).filter(Boolean);
  const staffList = state.staff.filter(item => item.status !== "inactive");
  const demoDate = offset => {
    const date = new Date(`${seededOn}T12:00:00`);
    date.setDate(date.getDate() - offset);
    return localDateText(date);
  };
  const demoCustomers = state.customers.filter(customer =>
    /^Demo хэрэглэгч \d{3}$/.test(String(customer.name || "")) ||
    (customer.serviceHistory || []).some(item => item.demoPagination)
  );
  const demoPhones = new Set(demoCustomers.map(customer => String(customer.phone || "")));

  state.customers = state.customers.filter(customer => !demoCustomers.includes(customer));
  state.bookings = state.bookings.filter(booking => {
    const phone = String(booking.phone || "");
    return !demoPhones.has(phone) && !/^70000\d{3}$/.test(phone);
  });
  state.voucherLogs = state.voucherLogs.filter(log => !/^Demo хэрэглэгч \d{3}$/.test(String(log.customer || "")));
  state.giftCards = state.giftCards.filter(card => !/^GC-1\d{6}$/.test(String(card.cardNumber || "")));
  state.audit = state.audit.filter(item => !String(item.meta || "").includes("• Demo бүртгэл "));

  const kassMatches = (item, generatedIndex) => {
    const expectedDate = demoDate(generatedIndex % 60);
    return item.date === expectedDate &&
      item.createdAt === expectedDate &&
      item.salon === (salons[generatedIndex % Math.max(salons.length, 1)] || "Хан-Уул салбар") &&
      item.staff === (staffList[generatedIndex % Math.max(staffList.length, 1)]?.name || "Ариундулам");
  };
  const kassOffset = Array.from({ length: Math.min(50, state.kassSchedules.length) + 1 }, (_, offset) => offset)
    .find(offset => kassMatches(state.kassSchedules.at(-1) || {}, state.kassSchedules.length - offset));
  if (kassOffset !== undefined) {
    while (state.kassSchedules.length > kassOffset && kassMatches(state.kassSchedules.at(-1), state.kassSchedules.length - kassOffset)) {
      state.kassSchedules.pop();
    }
  }

  const assignmentMatches = (item, generatedIndex) => {
    const staff = staffList[generatedIndex % Math.max(staffList.length, 1)] || {};
    const from = staff.salon || salons[0] || "Хан-Уул салбар";
    const destination = salons.find(name => name !== from) || salons[0] || "Төв салбар";
    const expectedDate = demoDate(generatedIndex % 50);
    return item.staff === (staff.name || "Ариундулам") &&
      item.from === from && item.to === destination &&
      item.startDate === expectedDate && item.endDate === expectedDate &&
      item.startTime === "09:00" && item.endTime === "20:00" &&
      item.reason === (generatedIndex % 2 ? "Салбарын ачаалал нөхөх" : "Ажилтан түр орлон ажиллах");
  };
  const assignmentOffset = Array.from({ length: Math.min(50, state.assignments.length) + 1 }, (_, offset) => offset)
    .find(offset => assignmentMatches(state.assignments.at(-1) || {}, state.assignments.length - offset));
  if (assignmentOffset !== undefined) {
    while (state.assignments.length > assignmentOffset && assignmentMatches(state.assignments.at(-1), state.assignments.length - assignmentOffset)) {
      state.assignments.pop();
    }
  }

  delete state.paginationDemoSeedV1;
  state.paginationDemoCleanupV1 = true;
  saveState();
}

function ensurePaginationDemoData() {
  if (state.paginationDemoSeedV1) return;
  const targetCount = 115;
  const today = todayText();
  const salons = state.salons.map(item => item.name).filter(Boolean);
  const staffList = state.staff.filter(item => item.status !== "inactive");
  const serviceNames = ["Үс ургуулах эмчилгээ", "Хуйхны оношилгоо", "Гүн цэвэрлэгээ", "Толгойн бариа", "Арчилгааны бүтээгдэхүүн"];
  const paymentMethods = ["card", "cash", "qpay", "transfer"];
  const demoDate = offset => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - offset);
    return localDateText(date);
  };
  const nextCollectionId = collection => Math.max(0, ...collection.map(item => Number(item.id) || 0)) + 1;

  state.customers = Array.isArray(state.customers) ? state.customers : [];
  let activeCustomerCount = state.customers.filter(item => !item.deleted && !item.deletedAt).length;
  let customerId = nextCollectionId(state.customers);
  while (activeCustomerCount < targetCount) {
    const index = activeCustomerCount + 1;
    const salon = salons[index % Math.max(salons.length, 1)] || "Хан-Уул салбар";
    const staff = staffList[index % Math.max(staffList.length, 1)]?.name || "Ариундулам";
    const service = serviceNames[index % serviceNames.length];
    const method = paymentMethods[index % paymentMethods.length];
    const amount = 35000 + (index % 12) * 7500;
    const time = `${String(9 + (index % 11)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
    state.customers.push({
      id: customerId,
      name: `Demo хэрэглэгч ${String(index).padStart(3, "0")}`,
      phone: String(70000000 + index),
      type: index % 9 === 0 ? "Тусгай хэрэглэгч" : "Хэрэглэгч",
      bonus: index % 9 === 0 ? "10%" : "2%",
      activeCourse: false,
      course: "",
      unpaid: false,
      spent: amount,
      balance: 0,
      last: today,
      registeredAt: demoDate(index % 45),
      age: 24 + (index % 30),
      gender: index % 4 === 0 ? "Эрэгтэй" : "Эмэгтэй",
      district: ["Хан-Уул", "Баянгол", "Чингэлтэй", "Сүхбаатар"][index % 4],
      khoroo: `${1 + (index % 20)}-р хороо`,
      salon,
      groupId: null,
      groupRole: "",
      currentTreatment: null,
      serviceHistory: [{
        demoPagination: true,
        kind: "single",
        title: service,
        service,
        date: today,
        time,
        createdAt: today,
        staff,
        salon,
        price: amount,
        basePrice: amount,
        balance: 0,
        payments: [{ paidAmount: amount, amount, date: today, time, createdAt: `${today} ${time}`, method }],
        signed: true
      }]
    });
    customerId += 1;
    activeCustomerCount += 1;
  }
  ensureCustomerWorkflowData();

  state.bookings = Array.isArray(state.bookings) ? state.bookings : [];
  let bookingId = nextCollectionId(state.bookings);
  while (state.bookings.length < targetCount) {
    const index = state.bookings.length + 1;
    state.bookings.push({
      id: bookingId++,
      salon: salons[index % Math.max(salons.length, 1)] || "Хан-Уул салбар",
      date: demoDate(index % 35),
      time: `${String(9 + (index % 10)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
      phone: String(70000000 + ((index % targetCount) + 1)),
      source: index % 3 === 0 ? "site" : "admin",
      status: index % 4 === 0 ? "pending" : "confirmed"
    });
  }

  state.kassSchedules = Array.isArray(state.kassSchedules) ? state.kassSchedules : [];
  let kassId = nextCollectionId(state.kassSchedules);
  while (state.kassSchedules.length < targetCount) {
    const index = state.kassSchedules.length + 1;
    state.kassSchedules.push({
      id: kassId++,
      date: demoDate(index % 60),
      salon: salons[index % Math.max(salons.length, 1)] || "Хан-Уул салбар",
      staff: staffList[index % Math.max(staffList.length, 1)]?.name || "Ариундулам",
      createdAt: demoDate(index % 60)
    });
  }

  state.assignments = Array.isArray(state.assignments) ? state.assignments : [];
  let assignmentId = nextCollectionId(state.assignments);
  while (state.assignments.length < targetCount) {
    const index = state.assignments.length + 1;
    const staff = staffList[index % Math.max(staffList.length, 1)] || {};
    const from = staff.salon || salons[0] || "Хан-Уул салбар";
    const destination = salons.find(name => name !== from) || salons[0] || "Төв салбар";
    const date = demoDate(index % 50);
    state.assignments.push({
      id: assignmentId++,
      staffId: Number(staff.id) || null,
      staff: staff.name || "Ариундулам",
      from,
      to: destination,
      startDate: date,
      endDate: date,
      startTime: "09:00",
      endTime: "20:00",
      reason: index % 2 ? "Салбарын ачаалал нөхөх" : "Ажилтан түр орлон ажиллах",
      status: "active"
    });
  }

  state.voucherLogs = Array.isArray(state.voucherLogs) ? state.voucherLogs : [];
  let voucherId = nextCollectionId(state.voucherLogs);
  while (state.voucherLogs.length < targetCount) {
    const index = state.voucherLogs.length + 1;
    const role = state.voucherRoles[index % Math.max(state.voucherRoles.length, 1)] || {};
    state.voucherLogs.push({
      id: voucherId++,
      date: demoDate(index % 60),
      time: `${String(9 + (index % 11)).padStart(2, "0")}:${index % 2 ? "15" : "45"}`,
      customer: `Demo хэрэглэгч ${String(index).padStart(3, "0")}`,
      phone: String(70000000 + index),
      roleName: role.name || "Менежер",
      rolePosition: role.position || "Салбарын эрхлэгч",
      amount: 20000 + (index % 10) * 10000,
      note: index % 2 ? "Урамшууллын эрх" : "Хэрэглэгчийн ваучер"
    });
  }

  state.giftCards = Array.isArray(state.giftCards) ? state.giftCards : [];
  let giftCardId = nextCollectionId(state.giftCards);
  while (state.giftCards.length < targetCount) {
    const index = state.giftCards.length + 1;
    const amount = [50000, 75000, 100000, 150000][index % 4];
    state.giftCards.push({
      id: giftCardId,
      cardNumber: `GC-${String(1000000 + giftCardId)}`,
      status: index % 10 === 0 ? "inactive" : "new",
      amount,
      remainingAmount: amount,
      createdAt: demoDate(index % 70),
      expiryDate: "2026-12-31",
      usage: []
    });
    giftCardId += 1;
  }

  state.audit = Array.isArray(state.audit) ? state.audit : [];
  const auditTypes = ["booking_created", "customer_updated", "payment_created", "service_created", "staff_assigned", "kass_schedule_saved"];
  while (state.audit.length < targetCount) {
    const index = state.audit.length + 1;
    state.audit.push({
      title: auditTypes[index % auditTypes.length],
      meta: `Менежер • Demo бүртгэл ${String(index).padStart(3, "0")} • ${demoDate(index % 45)}`
    });
  }

  state.paginationDemoSeedV1 = true;
  saveState();
}

function scheduleDefaults() {
  return {
    ...defaultState.scheduleSettings,
    ...(state.scheduleSettings || {})
  };
}

function ensureSalonSchedule(salon) {
  const defaults = scheduleDefaults();
  if (!salon) return defaults;
  salon.schedule = {
    ...defaults,
    ...(salon.schedule || {})
  };
  return salon.schedule;
}

function migrateSalonSchedules() {
  state.salons.forEach(salon => ensureSalonSchedule(salon));
  delete state.scheduleSettings;
}

function selectedScheduleSalonName() {
  if (isSalonAccount()) return activeAccount.salon;
  return document.getElementById("scheduleSalon")?.value || state.salons[0]?.name || "";
}

function scheduleConfig(salonName = selectedScheduleSalonName()) {
  const salon = state.salons.find(item => item.name === salonName) || state.salons[0];
  return ensureSalonSchedule(salon);
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + (minutes || 0);
}

function minutesToTime(value) {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function generateTimeOptions(start, end, duration) {
  const step = Math.max(Number(duration) || 30, 5);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes < startMinutes) return [];
  const options = [];
  for (let current = startMinutes; current <= endMinutes; current += step) {
    options.push(minutesToTime(current));
  }
  return options;
}

function bookingOptionsForSalon(salonName) {
  const config = scheduleConfig(salonName || state.salons[0]?.name);
  return generateTimeOptions(config.workStart, config.workEnd, config.duration);
}

function refreshBookingTimeOptions(salonName) {
  const config = scheduleConfig(salonName || state.salons[0]?.name);
  bookingTimeOptions = generateTimeOptions(config.workStart, config.workEnd, config.duration);
}

function scheduleFormConfig() {
  const config = scheduleConfig();
  return {
    workStart: document.getElementById("scheduleWorkStart")?.value || config.workStart,
    workEnd: document.getElementById("scheduleWorkEnd")?.value || config.workEnd,
    weekendStart: document.getElementById("scheduleWeekendStart")?.value || config.weekendStart,
    weekendEnd: document.getElementById("scheduleWeekendEnd")?.value || config.weekendEnd,
    duration: Math.max(Number(document.getElementById("scheduleDuration")?.value) || config.duration, 5)
  };
}

function renderSchedulePreview() {
  const config = scheduleFormConfig();
  const slots = generateTimeOptions(config.workStart, config.workEnd, config.duration);
  const previewCount = document.getElementById("schedulePreviewCount");
  const previewSlots = document.getElementById("schedulePreviewSlots");
  const hint = document.getElementById("scheduleHint");
  if (previewCount) previewCount.textContent = `Нийт ${slots.length} цагийн сонголт:`;
  if (previewSlots) previewSlots.innerHTML = slots.map(time => `<span>${time}</span>`).join("");
  if (hint) hint.textContent = `${config.duration} мин → ${slots.slice(0, 3).join(", ")}... · нэг цагт ${document.getElementById("scheduleCapacity")?.value || 4} хүн`;
}

function renderScheduleSettings(selectedName = selectedScheduleSalonName()) {
  const scheduleSalon = document.getElementById("scheduleSalon");
  if (!scheduleSalon) return;
  const salons = accountSalons();
  const requestedSalon = isSalonAccount() ? activeAccount.salon : selectedName;
  const selectedSalon = salons.some(salon => salon.name === requestedSalon) ? requestedSalon : salons[0]?.name || "";
  scheduleSalon.innerHTML = salons.map(salon => `<option value="${salon.name}">${salon.name}</option>`).join("");
  scheduleSalon.value = selectedSalon;
  scheduleSalon.disabled = isSalonAccount();
  const config = scheduleConfig(scheduleSalon.value);
  document.getElementById("scheduleWorkStart").value = config.workStart;
  document.getElementById("scheduleWorkEnd").value = config.workEnd;
  document.getElementById("scheduleWeekendStart").value = config.weekendStart;
  document.getElementById("scheduleWeekendEnd").value = config.weekendEnd;
  document.getElementById("scheduleDuration").value = config.duration;
  document.getElementById("scheduleCapacity").value = getSalonCapacity(scheduleSalon.value);
  renderSchedulePreview();
  enhanceNativeSelects(["scheduleSalon"]);
  enhanceScheduleTimeInputs();
}

function setScheduleSection(name = "holidays") {
  const selected = name === "holidays" ? "holidays" : "schedule";
  document.querySelectorAll("[data-schedule-section]").forEach(button => {
    const active = button.dataset.scheduleSection === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("scheduleSettingsPanel")?.classList.toggle("hidden", selected !== "schedule");
  document.getElementById("scheduleHolidaysPanel")?.classList.toggle("hidden", selected !== "holidays");
  if (selected === "schedule") renderScheduleSettings();
  if (selected === "holidays") renderHolidaySettings();
}

function saveScheduleSettings() {
  const scheduleSalon = document.getElementById("scheduleSalon");
  if (!scheduleSalon) return;
  const salonName = isSalonAccount() ? activeAccount.salon : scheduleSalon.value;
  const salon = state.salons.find(item => item.name === salonName);
  if (!salon) return;
  if (!canAccessSalon(salon.name)) return showToast("Зөвхөн өөрийн салбарын хуваарийг засна");
  salon.schedule = {
    workStart: document.getElementById("scheduleWorkStart").value || "09:00",
    workEnd: document.getElementById("scheduleWorkEnd").value || "19:00",
    weekendStart: document.getElementById("scheduleWeekendStart").value || "10:00",
    weekendEnd: document.getElementById("scheduleWeekendEnd").value || "19:00",
    duration: Math.max(Number(document.getElementById("scheduleDuration").value) || 30, 5)
  };
  salon.slotCapacity = Math.max(Number(document.getElementById("scheduleCapacity").value) || 1, 1);
  delete state.scheduleSettings;
  refreshBookingTimeOptions(salon.name);
  saveState();
  renderScheduleSettings(salon.name);
  renderInfoHeader(activeView);
  showToast("Цагийн хуваарь хадгалагдлаа");
}

const titles = {
  groups: ["Групп", "Бүртгэлтэй групп, гишүүд, хэрэглээ болон бонусын мэдээлэл"],
  customers: ["Хэрэглэгчид", "Нэгдсэн хэрэглэгчийн сан, курсийн явц, төлбөрийн тэмдэглэгээ"],
  kass: ["Касс хуваарь", "Өдрийн касс, ээлж, хаалтын хяналт"],
  kassRevenue: ["Касс орлого", "Салбарын орлого, төлбөрийн хэлбэр болон гүйлгээний жагсаалт"],
  services: ["Үйлчилгээ", "Үйлчилгээний бүртгэл, нэмэгдэл үнэ, төлбөрийн урсгал"],
  payments: ["Касс орлого", "Төлбөр, bonus, voucher орлогын бүртгэл"],
  performance: ["Гүйцэтгэл", "Ажилтны үйлчилгээ, салбар дамжсан ажил ба урамшууллын тооцоо"],
  reports: ["Тайлан", "Салбар, хэрэглэгч, ажилтны Excel тайлан"],
  bookings: ["Цаг захиалга", "Хэрэглэгчийн хүсэлт болон ресепшний хяналт"],
  staff: ["Ажилтан", "Үндсэн салбар, Вип ажилтан, томилгоо"],
  catalog: ["Бараа, үйлчилгээ", "Админаас удирдах үйлчилгээ, бүтээгдэхүүний сан"],
  loyalty: ["Бонус / Ваучер", "Бонус хувь, ваучер, ажилтны хөнгөлөлт"],
  dashboard: ["Хяналтын самбар", "Орлого, үйлчилгээ, хэрэглэгч болон салбарын нэгдсэн үзүүлэлт"],
  settings: ["Тохиргоо", "Зургийн тоо, нэмэгдэл үнэ, цаг захиалгын ерөнхий тохиргоо"],
  settingsServices: ["Үйлчилгээ", "Нэг удаа, курс, кассын үйлчилгээний master тохиргоо"],
  audit: ["Үйлдлийн түүх", "Системд хийсэн өөрчлөлт бүрийн бүртгэл"],
  profile: ["Хэрэглэгчийн профайл", "Бүх салбарын үйлчилгээний түүх"]
};

function badge(text, tone = "gray") {
  return `<span class="badge ${tone}">${text}</span>`;
}

function trashIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"></path>
    </svg>
  `;
}

function editIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17.5V20h2.5L17.1 9.4l-2.5-2.5L4 17.5Zm12-12 2.5 2.5 1.1-1.1a1.8 1.8 0 0 0 0-2.5 1.8 1.8 0 0 0-2.5 0L16 5.5Z"></path>
    </svg>
  `;
}

function statusIcon(path, title) {
  return `<i aria-label="${title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg></i>`;
}

function noteStatusIcon() {
  return statusIcon("M5 4h14v16H5V4Zm3 4v2h8V8H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z", "Оношилгоо бичигдсэн");
}

function generalPhotoStatusIcon() {
  return statusIcon("M4 6h4l1.5-2h5L16 6h4v14H4V6Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", "Ерөнхий зураг орсон");
}

function scopePhotoStatusIcon() {
  return statusIcon("M12 3c4.4 0 8 3.1 8 7 0 5.2-5.7 10.1-7.2 11.2a1.3 1.3 0 0 1-1.6 0C9.7 20.1 4 15.2 4 10c0-3.9 3.6-7 8-7Zm0 4a3 3 0 0 0-3 3c0 2 2 3 3 3s3-1 3-3a3 3 0 0 0-3-3Z", "Хуйх, оношилгооны зураг орсон");
}

function signatureStatusIcon() {
  return statusIcon("M4 17c3-4 5-6 7-6 1.5 0 2 1.1 1 2.5-.5.8-1.2 1.5-2 2.2 2.2-.4 3.9-1.6 6-4.2l1.5 1.3c-2.8 3.6-5.4 5.2-8.8 5.2H4v-1Zm12.5 1.5 3-3 1.5 1.5-4.5 4.5-2.8-2.8 1.4-1.4 1.4 1.2Z", "Хэрэглэгч баталгаажуулсан");
}

function normalizeBranchName(value) {
  return String(value || "")
    .replaceAll("Manager", "Менежер")
    .replaceAll("Хан-Уул salon", "Хан-Уул салбар")
    .replaceAll("Төв salon", "Төв салбар")
    .replaceAll("Вип salon", "Вип салбар")
    .replaceAll("Бүх salon", "Бүх салбар")
    .replaceAll("salon", "салбар")
    .replaceAll("Salon", "Салбар");
}

function normalizePositionName(value) {
  return String(value || "").replaceAll("Master массажист", "Мастер массажист");
}

function normalizeStoredNames() {
  const branchFields = ["name", "salon", "from", "to", "salons", "meta"];
  const walk = value => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.keys(value).forEach(key => {
      if (typeof value[key] === "string") {
        if (branchFields.includes(key)) value[key] = normalizeBranchName(value[key]);
        if (key === "position") value[key] = normalizePositionName(value[key]);
      } else if (Array.isArray(value[key]) && branchFields.includes(key)) {
        value[key] = value[key].map(item => typeof item === "string" ? normalizeBranchName(item) : item);
      } else {
        walk(value[key]);
      }
    });
  };
  walk(state);
}

function ensureHumanResourcesData() {
  state.staff = state.staff.map((item, index) => ({
    ...item,
    phone: item.phone || humanResourceSeed[index]?.phone || "",
    position: normalizePositionName(item.position || (item.vip ? "Мастер массажист" : "Массажист")),
    bonusCommission: Number(item.bonusCommission ?? parseFloat(item.commission) ?? 10),
    kassCommission: Number(item.kassCommission ?? 2),
    status: item.status || "active"
  }));
  saveState();
}

function assignmentTimeOptions(selected = "09:00") {
  const options = [];
  for (let minutes = 9 * 60; minutes <= 20 * 60; minutes += 30) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    options.push(`<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`);
  }
  return options.join("");
}

function ensureHumanResourceShell() {
  const submenu = document.getElementById("settingsSubmenu");
  if (submenu && !document.querySelector('[data-view="settingsHumanResources"]')) {
    const button = document.createElement("button");
    button.className = "nav-subitem";
    button.type = "button";
    button.dataset.view = "settingsHumanResources";
    button.textContent = "Хүний нөөц";
    submenu.appendChild(button);
    button.addEventListener("click", () => setView("settingsHumanResources"));
  }

  if (document.getElementById("settingsHumanResourcesView")) return;
  const section = document.createElement("section");
  section.className = "view";
  section.id = "settingsHumanResourcesView";
  section.innerHTML = `
    <div class="hr-section-tabs service-settings-tabs" role="tablist" aria-label="Хүний нөөцийн хэсэг">
      <button class="hr-section-tab service-main-tab active" type="button" role="tab" data-hr-tab="assignment" aria-selected="true">Томилгоо</button>
      <button class="hr-section-tab service-main-tab" type="button" role="tab" data-hr-tab="staff" aria-selected="false">Ажилтны бүртгэл</button>
    </div>
    <div class="hr-tab-panel hidden" id="hrStaffTab" role="tabpanel">
    <section class="branch-add-shell human-resource-shell">
      <div class="branch-add-title"><span id="hrFormTitle">Ажилтан нэмэх</span></div>
      <form id="hrStaffForm" class="clean-form human-resource-form">
        <label>Нэр
          <input id="hrStaffName" class="input" required>
        </label>
        <label>Утасны дугаар
          <input id="hrStaffPhone" class="input" maxlength="8" inputmode="numeric">
        </label>
        <label>Салбар
          <select id="hrStaffSalon" class="input"></select>
        </label>
        <label>Албан тушаал
          <select id="hrStaffPosition" class="input">
            <option>Мастер массажист</option>
            <option>Массажист</option>
            <option>Касс</option>
          </select>
        </label>
        <label>Үйлчилгээ %
          <input id="hrStaffBonus" class="input" type="number" min="0" max="100" step="0.01" value="10" required>
        </label>
        <label>Касс %
          <input id="hrStaffKass" class="input" type="number" min="0" max="100" step="0.01" value="2">
        </label>
        <label class="hr-status-field">Статус
          <select id="hrStaffStatus" class="input">
            <option value="active">Идэвхтэй</option>
            <option value="inactive">Идэвхгүй</option>
          </select>
        </label>
        <div class="form-actions hr-form-actions">
          <button type="button" class="secondary-btn icon-action hidden" id="hrCancelEdit" aria-label="Болих">×</button>
          <button type="submit" class="primary-btn" id="hrStaffSubmit">Нэмэх</button>
        </div>
      </form>
    </section>
    <section class="panel wide human-resource-panel">
      <div class="table-wrap">
        <table class="human-resource-table">
          <thead>
            <tr>
              <th>Нэр</th>
              <th>Утас</th>
              <th>Салбар</th>
              <th>Албан тушаал</th>
              <th>Үйлчилгээ %</th>
              <th>Касс %</th>
              <th>Статус</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody id="hrStaffRows"></tbody>
        </table>
      </div>
    </section>
    </div>
    <div class="hr-tab-panel active" id="hrAssignmentTab" role="tabpanel">
    <section class="assignment-shell">
      <form id="hrAssignmentForm" class="clean-form assignment-form">
        <label>Ажилтан
          <select id="hrAssignmentStaff" class="input" required></select>
        </label>
        <label>Очих салбар
          <select id="hrAssignmentSalon" class="input" required></select>
        </label>
        <label>Эхлэх өдөр
          <input id="hrAssignmentStartDate" class="input" type="date" required>
        </label>
        <label>Дуусах өдөр
          <input id="hrAssignmentEndDate" class="input" type="date" required>
        </label>
        <label>Эхлэх цаг
          <select id="hrAssignmentStartTime" class="input" required>${assignmentTimeOptions("09:00")}</select>
        </label>
        <label>Дуусах цаг
          <select id="hrAssignmentEndTime" class="input" required>${assignmentTimeOptions("20:00")}</select>
        </label>
        <label class="assignment-reason-field">Шалтгаан
          <input id="hrAssignmentReason" class="input" placeholder="Ж: Хүн хүч дутсан">
        </label>
        <div class="assignment-form-actions">
          <button class="secondary-btn icon-action hidden" id="hrAssignmentCancel" type="button" aria-label="Засахаа болих">×</button>
          <button class="primary-btn" id="hrAssignmentSubmit" type="submit">Томилох</button>
        </div>
      </form>
    </section>
    <section class="panel assignment-list-card">
      <div class="assignment-list-toolbar">
        <label>Ажилтны нэр
          <input class="input" id="hrAssignmentNameSearch" type="search" placeholder="Нэрээр хайх">
        </label>
        <label>Эхлэх огноо
          <input class="input" id="hrAssignmentFromSearch" type="date">
        </label>
        <label>Дуусах огноо
          <input class="input" id="hrAssignmentToSearch" type="date">
        </label>
        <button class="secondary-btn clear-icon-btn" id="hrAssignmentSearchClear" type="button" aria-label="Хайлт цэвэрлэх">×</button>
      </div>
      <div class="table-wrap assignment-table-wrap">
        <table class="booking-table assignment-table">
          <thead>
            <tr>
              <th>Ажилтан</th>
              <th>Үндсэн салбар</th>
              <th>Очих салбар</th>
              <th>Хугацаа</th>
              <th>Шалтгаан</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody id="hrAssignmentRows"></tbody>
        </table>
      </div>
      <div class="pagination-row assignment-pagination" id="hrAssignmentPagination"></div>
    </section>
    </div>
  `;
  const anchor = document.getElementById("settingsServicesView") || document.getElementById("settingsGeneralView");
  anchor?.parentNode?.insertBefore(section, anchor.nextSibling);
}

function setHumanResourceTab(name = "assignment") {
  document.querySelectorAll(".hr-section-tab").forEach(button => {
    const active = button.dataset.hrTab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("hrAssignmentTab")?.classList.toggle("hidden", name !== "assignment");
  document.getElementById("hrAssignmentTab")?.classList.toggle("active", name === "assignment");
  document.getElementById("hrStaffTab")?.classList.toggle("hidden", name !== "staff");
  document.getElementById("hrStaffTab")?.classList.toggle("active", name === "staff");
}

function setPerformanceTab(name = "revenue") {
  activePerformanceTab = name === "staff" ? "staff" : "revenue";
  document.querySelectorAll(".performance-section-tab").forEach(button => {
    const active = button.dataset.performanceTab === activePerformanceTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("performanceRevenueTab")?.classList.toggle("hidden", activePerformanceTab !== "revenue");
  document.getElementById("performanceStaffTab")?.classList.toggle("hidden", activePerformanceTab !== "staff");
  if (activePerformanceTab === "revenue") {
    renderKassRevenue();
    renderInfoHeader("kassRevenue");
  } else {
    renderPerformance();
    renderInfoHeader("performance");
  }
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function bonusPercentForSpent(spent) {
  return pricePolicy().bonusTiers.reduce((pct, tier) => Number(spent) >= Number(tier.threshold) ? Number(tier.percent) : pct, 0);
}

function customerDefaultWorkflow(customer) {
  const groupSeed = defaultState.customerGroups.find(group => group.members.includes(customer.id));
  const isPrimaryCourse = customer.id === 1;
  const isSecondCourse = customer.id === 2;
  return {
    salon: customer.id === 2 ? "Вип салбар" : "Хан-Уул салбар",
    groupId: groupSeed?.id || null,
    groupRole: groupSeed?.adminCustomerId === customer.id ? "admin" : groupSeed ? "member" : "",
    currentTreatment: customer.activeCourse ? {
      id: `tr-${customer.id}`,
      service: isSecondCourse ? "Үс ургуулах курс эмчилгээ" : "Үүргийн курс эмчилгээ",
      salon: customer.id === 2 ? "Вип салбар" : "Хан-Уул салбар",
      staff: isSecondCourse ? "Номинзул" : "Ариундулам",
      progress: customer.course || "Курс",
      stage: isPrimaryCourse ? "Оношилгоо хийгдсэн" : "QR хүлээгдэж буй",
      photos: isPrimaryCourse ? 3 : 1,
      photoLimit: generalSettings().diagnosisPhotoLimit,
      qrStatus: isPrimaryCourse ? "Хүлээгдэж буй" : "Илгээгдсэн",
      paymentBalance: customer.unpaid ? 185000 : 0,
      startedAt: customer.last || todayText()
    } : null,
    serviceHistory: [
      {
        title: customer.course || "Гүн тэжээлийн эмчилгээ",
        meta: `${customer.id === 2 ? "Вип салбар" : "Хан-Уул салбар"} • ${customer.last || todayText()} • ${customer.activeCourse ? "Курсийн явц" : "Төлбөр төлөгдсөн"}`,
        photos: customer.activeCourse ? 2 : 0,
        qr: customer.activeCourse ? "Баталгаажуулалт хүлээгдэж буй" : "Хаагдсан"
      },
      {
        title: "Оношилгоо",
        meta: "Оношилгооны зураг • бүх салбарт харагдана",
        photos: customer.id === 3 ? 0 : 2,
        qr: "Зөвхөн харах"
      }
    ]
  };
}

function ensureCustomerWorkflowData() {
  const fallbackCustomers = new Map(defaultState.customers.map(customer => [Number(customer.id), customer]));
  const permanentlyDeletedIds = new Set((state.permanentlyDeletedCustomerIds || []).map(Number));
  state.customers = state.customers.filter(customer => !permanentlyDeletedIds.has(Number(customer.id)));
  if (!state.databaseOperationalDataCleared) {
    defaultState.customers.forEach(customer => {
      if (permanentlyDeletedIds.has(Number(customer.id))) return;
      if (!state.customers.some(item => Number(item.id) === Number(customer.id))) {
        state.customers.push(structuredClone(customer));
      }
    });
  }
  const defaultGroups = structuredClone(defaultState.customerGroups);
  if (!state.databaseOperationalDataCleared) {
    defaultGroups.forEach(group => {
      if (!state.customerGroups.some(item => Number(item.id) === Number(group.id))) {
        state.customerGroups.push(group);
      }
    });
  }
  state.customers = state.customers.map(customer => {
    const defaults = customerDefaultWorkflow(customer);
    const fallback = fallbackCustomers.get(Number(customer.id)) || {};
    const hasFallback = fallbackCustomers.has(Number(customer.id));
    const serviceHistory = Array.isArray(customer.serviceHistory)
      ? customer.serviceHistory
      : defaults.serviceHistory;
    const cleanServiceHistory = !hasFallback && serviceHistory.length === 2 &&
      serviceHistory.some(item => item.title === "Оношилгоо") &&
      serviceHistory.some(item => item.title === (customer.course || "Гүн тэжээлийн эмчилгээ"))
        ? []
        : serviceHistory;
    const birthYear = customer.birthYear || birthYearFromAge(customer.age || fallback.age);
    return {
      ...customer,
      salon: customer.salon || defaults.salon,
      groupId: customer.groupId ?? defaults.groupId,
      groupRole: customer.groupRole || defaults.groupRole,
      currentTreatment: customer.currentTreatment === undefined ? defaults.currentTreatment : customer.currentTreatment,
      serviceHistory: cleanServiceHistory,
      birthYear,
      age: birthYear ? customerAge({ birthYear }) : customer.age || fallback.age || "",
      gender: customer.gender || fallback.gender || "",
      district: customer.district || fallback.district || "",
      khoroo: customer.khoroo || fallback.khoroo || "",
      registeredAt: customer.registeredAt || customer.last || todayText(),
      deleted: Boolean(customer.deleted || customer.deletedAt)
    };
  });
}

function ensureExpiredServiceDemoData() {
  if (state.expiredServiceDemoSeededV1) return;
  const customer = state.customers.find(item => Number(item.id) === 1) || state.customers.find(item => !item.deleted);
  if (!customer) return;
  customer.serviceHistory = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  const exists = customer.serviceHistory.some(item => item.demoKey === "expired-service-edit-lock");
  if (!exists) {
    customer.serviceHistory.push({
      demoKey: "expired-service-edit-lock",
      kind: "single",
      title: "Хугацаа дууссан demo үйлчилгээ",
      service: "Хугацаа дууссан demo үйлчилгээ",
      date: "2026-07-01",
      createdAt: "2026-07-01",
      staff: "Ариундулам",
      salon: "Хан-Уул салбар",
      price: 55000,
      balance: 0,
      basePrice: 55000,
      vipRoom: false,
      vipRoomFee: 0,
      masterStaffFee: 0,
      paymentMethod: "Demo",
      diagnosis: {
        types: ["Эрүүл"],
        note: "Хугацаа өнгөрсөн үед засах, устгах icon идэвхгүй болохыг шалгах demo.",
        generalPhotos: ["demo-general"],
        scopePhotos: ["demo-scope"]
      },
      signed: true
    });
  }
  state.expiredServiceDemoSeededV1 = true;
  saveState();
}

function customerGroup(customer) {
  return state.customerGroups.find(group => Number(group.id) === Number(customer.groupId)) || null;
}

function groupMembers(group) {
  if (!group) return [];
  const memberIds = (group.members || []).map(Number);
  return state.customers.filter(customer => memberIds.includes(Number(customer.id)));
}

function groupBonusInfo(group) {
  if (!group) return null;
  const spent = Number(group.spent2y || 0);
  const percent = bonusPercentForSpent(spent);
  const pool = Number(group.bonusPool ?? Math.round(spent * percent / 100));
  const used = Number(group.usedBonus || 0);
  return {
    spent,
    percent,
    pool,
    used,
    balance: Math.max(0, pool - used)
  };
}

function applyGroupPayment(group, paidAmount, bonusAmount, paidDate, options = {}) {
  if (!group) return null;
  const spentAmount = Math.max(0, Number(paidAmount || 0));
  const usedAmount = Math.max(0, Number(bonusAmount || 0));
  const nextSpent = Math.max(0, Number(group.spent2y || 0) + spentAmount);
  const bonusPercent = bonusPercentForSpent(nextSpent);
  const bonusEligibleAmount = options.bonusEligible === false ? 0 : spentAmount;
  const bonusEarned = Math.round(bonusEligibleAmount * bonusPercent / 100);

  group.spent2y = nextSpent;
  group.bonusPool = Math.max(0, Number(group.bonusPool || 0) + bonusEarned);
  group.usedBonus = Math.max(0, Number(group.usedBonus || 0) + usedAmount);

  return {
    groupId: group.id,
    groupSpentAmount: spentAmount,
    groupBonusEligibleAmount: bonusEligibleAmount,
    groupBonusEarned: bonusEarned,
    groupBonusPercent: bonusPercent,
    groupBonusUsed: usedAmount,
    groupPaymentDate: paidDate || todayText()
  };
}

function reverseGroupPayment(payment, fallbackGroup = null) {
  const groupId = Number(payment?.groupId || 0);
  const group = state.customerGroups.find(item => Number(item.id) === groupId) || fallbackGroup;
  if (!group) return;

  const spentAmount = Math.max(0, Number(payment?.groupSpentAmount || 0));
  const bonusEarned = Math.max(0, Number(payment?.groupBonusEarned || 0));
  const bonusUsed = Math.max(0, Number(payment?.groupBonusUsed ?? payment?.bonusAmount ?? 0));
  group.spent2y = Math.max(0, Number(group.spent2y || 0) - spentAmount);
  group.bonusPool = Math.max(0, Number(group.bonusPool || 0) - bonusEarned);
  group.usedBonus = Math.max(0, Number(group.usedBonus || 0) - bonusUsed);
}

function reverseGiftCardPayment(payment, customer = null, historyItem = null) {
  if (payment?.method !== "gift_card") return;
  const card = findGiftCard(payment.referenceLabel || payment.giftCardNumber || "");
  if (!card) return;
  const restoredAmount = Math.max(0, Number(payment.paidAmount || payment.amount || 0));
  card.remainingAmount = Math.min(Number(card.amount || 0), Number(card.remainingAmount || 0) + restoredAmount);
  if (card.status !== "inactive") card.status = card.remainingAmount <= 0 ? "used" : "new";

  card.usage = Array.isArray(card.usage) ? card.usage : [];
  const usageId = payment.giftCardUsageId;
  let usageIndex = usageId ? card.usage.findIndex(item => item.id === usageId) : -1;
  if (usageIndex < 0) {
    const serviceName = historyItem?.service || historyItem?.title || "";
    usageIndex = card.usage.findIndex(item =>
      Number(item.amount || 0) === restoredAmount &&
      (!customer || !item.phone || String(item.phone) === String(customer.phone || "")) &&
      (!serviceName || !item.service || item.service === serviceName) &&
      (!payment.date || !item.date || item.date === payment.date)
    );
  }
  if (usageIndex >= 0) card.usage.splice(usageIndex, 1);
}

function treatmentStageClass(treatment) {
  if (!treatment) return "idle";
  if (Number(treatment.paymentBalance || 0) > 0) return "payment";
  if (String(treatment.qrStatus || "").includes("Хүлээгдэж")) return "qr";
  return "ready";
}

function humanResourceStatusText(status) {
  return status === "inactive" ? "Идэвхгүй" : "Идэвхтэй";
}

function giftCardStatus(card) {
  if (card.status === "inactive") return "inactive";
  if (Number(card.remainingAmount) <= 0) return "used";
  if (Number(card.remainingAmount) < Number(card.amount)) return "partial";
  return "fresh";
}

function giftCardStatusText(card) {
  const status = giftCardStatus(card);
  if (status === "inactive") return "Идэвхгүй";
  if (status === "used") return "Дууссан";
  if (status === "partial") return "Ашиглаж байгаа";
  return "Идэвхтэй";
}

function giftCardCanEdit(card) {
  return giftCardStatus(card) === "fresh";
}

function populateHumanResourceSalonSelect(selected = "") {
  const select = document.getElementById("hrStaffSalon");
  if (!select) return;
  const salons = accountSalons();
  const requestedSalon = isSalonAccount() ? activeAccount.salon : selected;
  select.innerHTML = salons.map(salon => `<option value="${salon.name}">${salon.name}</option>`).join("");
  select.value = salons.some(salon => salon.name === requestedSalon) ? requestedSalon : salons[0]?.name || "";
  select.disabled = isSalonAccount();
}

function customerTypeOptions(selected = "") {
  return state.customerTypes.map(type => `<option ${type === selected ? "selected" : ""}>${type}</option>`).join("");
}

function renderCustomerTypeFilter() {
  const filter = document.getElementById("customerTypeFilter");
  if (!filter) return;
  const current = filter.value || "all";
  filter.innerHTML = `
    <option value="all">Бүгд</option>
    ${state.customerTypes.map(type => `<option value="${type}" ${type === current ? "selected" : ""}>${type}</option>`).join("")}
  `;
  if (current !== "all" && !state.customerTypes.includes(current)) filter.value = "all";
}

function removeRetiredViews() {
  retiredViews.forEach(name => {
    document.querySelectorAll(`[data-view="${name}"], [data-view-target="${name}"]`).forEach(item => item.remove());
    document.getElementById(`${name}View`)?.remove();
  });
}

function ensureBranchStatusField() {
  if (document.getElementById("branchStatus")) return;
  const actions = document.querySelector("#branchForm .form-actions");
  if (!actions) return;
  const label = document.createElement("label");
  label.className = "branch-status-field hidden";
  label.innerHTML = `Статус
    <select class="input" id="branchStatus">
      <option value="active">Идэвхтэй</option>
      <option value="inactive">Идэвхгүй</option>
    </select>
  `;
  actions.parentNode.insertBefore(label, actions);
}

function serviceCountForMain(key) {
  if (key === "single") return serviceSettingsData.single.length;
  if (key === "course") return serviceSettingsData.course.length;
  return Object.values(serviceSettingsData.products).reduce((sum, items) => sum + items.length, 0);
}

function serviceCodeBadge(code) {
  return code ? `<span class="code-badge">${code}</span>` : "";
}

function cleanServiceName(name) {
  return String(name || "")
    .replace(/\s*\/\s*\d+\s*удаагийн\s*оролт\s*\/\s*/gi, " ")
    .replace(/\s*\/\s*хүүхэд\s*\/\s*/gi, " ")
    .replace(/\s*[Хх]үүхэд\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function standardServiceName(name, kind) {
  return cleanServiceName(name);
}

function serviceVisitText(item) {
  const match = String(item.visits || item.name || "").match(/(\d+)\s*удаа/);
  return match ? `${match[1]} удаа` : item.visits || "";
}

function saleQtyText(item) {
  const match = String(item.saleNote || "").match(/\d+/);
  return match ? `x${match[0]}` : "";
}

function salePriceCell(item) {
  if (!item.sale) return `<span class="muted-dash">—</span>`;
  const saleQty = saleQtyText(item);
  return `<strong class="sale-price">${money(item.sale)}</strong>${saleQty ? `<span class="sale-note"> ${saleQty}</span>` : ""}`;
}

function pricePolicy() {
  state.pricePolicy = {
    ...structuredClone(defaultState.pricePolicy),
    ...(state.pricePolicy || {})
  };
  return state.pricePolicy;
}

function customerTypeRule(type) {
  state.customerTypeRules = {
    ...structuredClone(defaultState.customerTypeRules),
    ...(state.customerTypeRules || {})
  };
  if (!state.customerTypeRules[type]) {
    state.customerTypeRules[type] = {
      bonusPercent: type === "Тусгай хэрэглэгч" || type === "Ажилтан" ? 10 : 2,
      dynamic: type !== "Ажилтан"
    };
  }
  return state.customerTypeRules[type];
}

function ensureEmployeeCustomerBonusRule(targetState) {
  if (!targetState) return false;
  let changed = false;
  targetState.customerTypes = Array.isArray(targetState.customerTypes) ? targetState.customerTypes : [];
  if (!targetState.customerTypes.includes("Ажилтан")) {
    targetState.customerTypes.push("Ажилтан");
    changed = true;
  }
  targetState.customerTypeRules = targetState.customerTypeRules && typeof targetState.customerTypeRules === "object"
    ? targetState.customerTypeRules
    : {};
  const currentRule = targetState.customerTypeRules["Ажилтан"] || {};
  if (Number(currentRule.bonusPercent) !== 10 || currentRule.dynamic !== false) changed = true;
  targetState.customerTypeRules["Ажилтан"] = {
    ...currentRule,
    bonusPercent: 10,
    dynamic: false
  };
  targetState.customers = (Array.isArray(targetState.customers) ? targetState.customers : []).map(customer => {
    if (customer.type !== "Ажилтан" || customer.bonus === "10%") return customer;
    changed = true;
    return { ...customer, bonus: "10%" };
  });
  targetState.employeeCustomerBonusRuleV2 = true;
  return changed;
}

function applyPendingCustomerProfileUpdates(targetState) {
  if (!targetState || !pendingCustomerProfileUpdates.size) return;
  pendingCustomerProfileUpdates.forEach((update, customerId) => {
    const customer = (targetState.customers || []).find(item => Number(item.id) === Number(customerId));
    if (!customer) return;
    const { mutationVersion, ...profile } = update;
    Object.assign(customer, profile);
  });
}

function bonusTierSummary() {
  return pricePolicy().bonusTiers
    .map(tier => `${formatNumber(tier.threshold)}₮→${tier.percent}%`)
    .join(" · ");
}

function renderPricePolicySettings() {
  const policy = pricePolicy();
  const vipRoom = document.getElementById("vipRoomFee");
  const masterStaff = document.getElementById("masterStaffFee");
  const tierSummary = document.getElementById("bonusTierSummary");
  if (!vipRoom || !masterStaff) return;
  vipRoom.value = policy.vipRoomFee;
  masterStaff.value = policy.masterStaffFee;
  if (tierSummary) tierSummary.textContent = bonusTierSummary();
  renderCustomerTypeManager();
  enhanceNativeSelects(["customerTypeDynamic"]);
}

function savePricePolicy(event) {
  event.preventDefault();
  state.pricePolicy = {
    ...pricePolicy(),
    vipRoomFee: Number(formValue("vipRoomFee")) || 0,
    masterStaffFee: Number(formValue("masterStaffFee")) || 0
  };
  saveState();
  renderInfoHeader(activeView);
  showToast("Үнийн бодлого хадгалагдлаа");
}

function renderCustomerTypeManager() {
  const manager = document.getElementById("customerTypeManager");
  if (!manager) return;
  manager.innerHTML = state.customerTypes.map(type => {
    const rule = customerTypeRule(type);
    return `
      <tr>
        <td><strong>${type}</strong></td>
        <td>${rule.bonusPercent}%</td>
        <td>${rule.dynamic ? "Дүрмээр бодогдоно" : "Байнгын"}</td>
        <td>
          <div class="table-actions">
            <button class="secondary-btn icon-action customer-type-edit" type="button" data-type="${type}" aria-label="Засах">${editIcon()}</button>
            ${type === "Хэрэглэгч" ? "" : `<button class="danger-btn icon-danger customer-type-delete" type="button" data-type="${type}" aria-label="Устгах">${trashIcon()}</button>`}
          </div>
        </td>
      </tr>
    `;
  }).join("");
  manager.querySelectorAll(".customer-type-edit").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      const rule = customerTypeRule(type);
      customerTypeEditingName = type;
      document.getElementById("customerTypeName").value = type;
      document.getElementById("customerTypeBonus").value = rule.bonusPercent;
      document.getElementById("customerTypeDynamic").value = String(Boolean(rule.dynamic));
      document.getElementById("customerTypeSubmit").textContent = "Хадгалах";
      enhanceNativeSelects(["customerTypeDynamic"]);
    });
  });
  manager.querySelectorAll(".customer-type-delete").forEach(button => {
    button.addEventListener("click", () => {
      if (!requireDeleteCode()) return;
      const type = button.dataset.type;
      state.customerTypes = state.customerTypes.filter(item => item !== type);
      delete state.customerTypeRules[type];
      state.customers = state.customers.map(customer => customer.type === type ? { ...customer, type: "Хэрэглэгч" } : customer);
      customerTypeEditingName = customerTypeEditingName === type ? null : customerTypeEditingName;
      saveState();
      renderCustomerTypeFilter();
      renderCustomerTypeManager();
      renderCustomers();
      renderInfoHeader(activeView);
    });
  });
}

function saveCustomerType(event) {
  event.preventDefault();
  const input = document.getElementById("customerTypeName");
  const name = input?.value.trim();
  const bonusPercent = Number(formValue("customerTypeBonus"));
  const dynamic = document.getElementById("customerTypeDynamic")?.value !== "false";
  if (!name) return;
  if (customerTypeEditingName && customerTypeEditingName !== name) {
    state.customerTypes = state.customerTypes.map(type => type === customerTypeEditingName ? name : type);
    state.customers = state.customers.map(customer => customer.type === customerTypeEditingName ? { ...customer, type: name } : customer);
    delete state.customerTypeRules[customerTypeEditingName];
  } else if (!state.customerTypes.includes(name)) {
    state.customerTypes.push(name);
  }
  state.customerTypeRules[name] = {
    bonusPercent: Number.isFinite(bonusPercent) ? bonusPercent : 0,
    dynamic
  };
  customerTypeEditingName = null;
  input.value = "";
  document.getElementById("customerTypeBonus").value = "";
  document.getElementById("customerTypeDynamic").value = "true";
  document.getElementById("customerTypeSubmit").textContent = "Нэмэх";
  saveState();
  renderCustomerTypeFilter();
  renderCustomerTypeManager();
  renderInfoHeader(activeView);
  showToast("Хэрэглэгчийн төрөл нэмэгдлээ");
}

function generalSettings() {
  state.generalSettings = {
    ...structuredClone(defaultState.generalSettings),
    ...(state.generalSettings || {})
  };
  if (Number(state.generalSettings.kassEditDays) <= 0) {
    state.generalSettings.kassEditDays = defaultState.generalSettings.kassEditDays;
  }
  if (Number(state.generalSettings.serviceEditDays) <= 0) {
    state.generalSettings.serviceEditDays = defaultState.generalSettings.serviceEditDays;
  }
  return state.generalSettings;
}

function renderGeneralSettings() {
  const settings = generalSettings();
  const deleteCode = document.getElementById("deleteActionCode");
  const kassDays = document.getElementById("kassEditDays");
  const serviceDays = document.getElementById("serviceEditDays");
  const captureMode = document.getElementById("diagnosisCaptureMode");
  const captureSize = document.getElementById("diagnosisCaptureSize");
  if (deleteCode) deleteCode.value = settings.deleteCode;
  if (kassDays) kassDays.value = settings.kassEditDays;
  if (serviceDays) serviceDays.value = settings.serviceEditDays;
  if (captureMode) captureMode.value = settings.diagnosisCaptureMode || "fixed";
  if (captureSize) captureSize.value = settings.diagnosisCaptureSize || "1280x960";
  toggleDiagnosisCaptureSizeSetting();
  enhanceNativeSelects(["diagnosisCaptureMode", "diagnosisCaptureSize"]);
  renderDiagnosisTypes();
}

function toggleDiagnosisCaptureSizeSetting() {
  const fixed = formValue("diagnosisCaptureMode") !== "native";
  document.getElementById("diagnosisCaptureSizeField")?.classList.toggle("hidden", !fixed);
}

function saveGeneralSettings(event) {
  event.preventDefault();
  state.generalSettings = {
    ...generalSettings(),
    deleteCode: formValue("deleteActionCode") || "1989",
    kassEditDays: Number(formValue("kassEditDays")) || generalSettings().kassEditDays,
    serviceEditDays: Number(formValue("serviceEditDays")) || generalSettings().serviceEditDays,
    diagnosisCaptureMode: formValue("diagnosisCaptureMode") === "native" ? "native" : "fixed",
    diagnosisCaptureSize: formValue("diagnosisCaptureSize") || "1280x960",
    diagnosisJpegQuality: 0.92
  };
  saveState();
  renderInfoHeader(activeView);
  showToast("Ерөнхий тохиргоо хадгалагдлаа");
}

function renderDiagnosisTypes() {
  const list = document.getElementById("diagnosisTypeList");
  if (!list) return;
  list.innerHTML = state.diagnosisTypes.map(type => `
    <span class="service-category-chip">
      ${type}
      <button type="button" data-type="${type}" aria-label="Устгах">×</button>
    </span>
  `).join("");
  list.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      if (!requireDeleteCode()) return;
      state.diagnosisTypes = state.diagnosisTypes.filter(type => type !== button.dataset.type);
      saveState();
      renderDiagnosisTypes();
      renderInfoHeader(activeView);
    });
  });
}

function saveDiagnosisType(event) {
  event.preventDefault();
  const input = document.getElementById("diagnosisTypeName");
  const name = input?.value.trim();
  if (!name || state.diagnosisTypes.includes(name)) return;
  state.diagnosisTypes.push(name);
  input.value = "";
  saveState();
  renderDiagnosisTypes();
  renderInfoHeader(activeView);
  showToast("Оношилгоо нэмэгдлээ");
}

function monthText(dateText = todayText()) {
  return String(dateText).slice(0, 7);
}

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.floor((to - from) / 86400000);
}

function canEditKassSchedule(item) {
  const configuredDays = Number(generalSettings().kassEditDays);
  const allowedDays = configuredDays > 0 ? configuredDays : defaultState.generalSettings.kassEditDays;
  const age = daysBetween(item.date, todayText());
  return age <= allowedDays;
}

function kassScheduleConflict(date, salon, staff, editingId = null) {
  return state.kassSchedules.find(item => {
    if (Number(item.id) === Number(editingId)) return false;
    if (item.date !== date) return false;
    return item.salon === salon || item.staff === staff;
  });
}

function kassConflictMessage(conflict, salon, staff) {
  if (!conflict) return "";
  if (conflict.salon === salon) return "Энэ салбарт тухайн өдөр касс бүртгэгдсэн байна";
  if (conflict.staff === staff) return "Энэ ажилтан тухайн өдөр өөр салбарт касс дээр байна";
  return "Касс хуваарь давхардаж байна";
}

function populateKassSelects() {
  const salons = accountSalons();
  const salon = document.getElementById("kassSalon");
  const staff = document.getElementById("kassStaff");
  const filter = document.getElementById("kassSalonFilter");
  const staffFilter = document.getElementById("kassStaffFilter");
  const currentSalonValue = isSalonAccount() ? activeAccount.salon : (salon?.value || salons[0]?.name || "");
  const staffList = isSalonAccount()
    ? accountStaff({ activeOnly: true })
    : accountStaff({ activeOnly: true }).filter(staffItem => !currentSalonValue || staffItem.salon === currentSalonValue);
  const formSalonOptions = salons.map(salonItem => `<option value="${salonItem.name}">${salonItem.name}</option>`).join("");
  const filterSalonOptions = `${isSalonAccount() ? "" : `<option value="">Бүх салбар</option>`}${formSalonOptions}`;
  const staffOptions = staffList.map(staff => `<option value="${staff.name}">${staff.name}</option>`).join("");
  const salonValue = currentSalonValue;
  const staffValue = staff?.value || staffList[0]?.name || "";
  const filterValue = isSalonAccount() ? activeAccount.salon : (filter?.value || "");
  const staffFilterValue = staffFilter?.value || "";
  const filterStaffList = accountStaff({ activeOnly: true }).filter(item => !filterValue || item.salon === filterValue);
  if (salon) {
    salon.innerHTML = formSalonOptions;
    salon.value = salons.some(item => item.name === salonValue) ? salonValue : salons[0]?.name || "";
    salon.disabled = isSalonAccount();
  }
  if (staff) {
    staff.innerHTML = staffOptions;
    staff.value = staffList.some(item => item.name === staffValue) ? staffValue : staffList[0]?.name || "";
  }
  if (filter) {
    filter.innerHTML = filterSalonOptions;
    filter.value = salons.some(item => item.name === filterValue) ? filterValue : "";
    filter.disabled = isSalonAccount();
  }
  if (staffFilter) {
    staffFilter.innerHTML = `<option value="">Бүх ажилтан</option>${filterStaffList.map(item => `<option value="${htmlSafe(item.name)}">${htmlSafe(item.name)}</option>`).join("")}`;
    staffFilter.value = filterStaffList.some(item => item.name === staffFilterValue) ? staffFilterValue : "";
  }
  enhanceNativeSelects(["kassSalon", "kassStaff", "kassStaffFilter", "kassSalonFilter"]);
}

function resetKassForm() {
  kassEditingId = null;
  const form = document.getElementById("kassScheduleForm");
  if (!form) return;
  form.reset();
  document.getElementById("kassStartDate").value = todayText();
  document.getElementById("kassEndDate").value = todayText();
  document.getElementById("kassSubmit").textContent = "Нэмэх";
  populateKassSelects();
}

function kassRevenueServiceName(item = {}) {
  if (Array.isArray(item.products) && item.products.length) {
    return item.products.map(product => product.name || product.product || "Бүтээгдэхүүн").join(", ");
  }
  return item.service || item.title || "Үйлчилгээ";
}

function kassRevenueSourceRows() {
  const rows = [];
  state.customers.forEach(customer => {
    (customer.serviceHistory || []).forEach((item, historyIndex) => {
      const payments = Array.isArray(item.payments) ? item.payments : [];
      const salon = item.salon || item.branch || customer.salon || "—";
      const service = kassRevenueServiceName(item);
      if (payments.length) {
        payments.forEach((payment, paymentIndex) => {
          const amount = Number(payment.paidAmount || payment.amount || 0);
          if (amount <= 0) return;
          const createdAt = String(payment.createdAt || "");
          rows.push({
            id: `${customer.id}-${historyIndex}-${paymentIndex}`,
            date: payment.date || createdAt.slice(0, 10) || item.date || customer.last || todayText(),
            time: /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(createdAt) ? createdAt.slice(11, 16) : payment.time || "",
            customer: customer.name || "—",
            phone: customer.phone || "—",
            service,
            salon,
            method: payment.method || "card",
            amount
          });
        });
        return;
      }
      const paid = servicePaidAmount(item);
      if (paid <= 0) return;
      rows.push({
        id: `${customer.id}-${historyIndex}-legacy`,
        date: item.date || customer.last || todayText(),
        time: item.time || "",
        customer: customer.name || "—",
        phone: customer.phone || "—",
        service,
        salon,
        method: item.paymentMethod || "card",
        amount: paid
      });
    });
  });
  return rows;
}

function initializeKassRevenueFilters() {
  const from = document.getElementById("kassRevenueFrom");
  const to = document.getElementById("kassRevenueTo");
  const salon = document.getElementById("kassRevenueSalon");
  if (!from || !to || !salon) return;
  if (!from.value) from.value = todayText();
  if (!to.value) to.value = todayText();
  if (!salon.dataset.ready) {
    const availableSalons = isSalonAccount() ? state.salons.filter(item => item.name === activeAccount.salon) : state.salons;
    salon.innerHTML = `${isSalonAccount() ? "" : `<option value="">Бүх салбар</option>`}${availableSalons.map(item => `<option value="${htmlSafe(item.name)}">${htmlSafe(item.name)}</option>`).join("")}`;
    salon.value = isSalonAccount() ? activeAccount.salon : "";
    salon.disabled = isSalonAccount();
    salon.dataset.ready = "true";
    enhanceNativeSelects(["kassRevenueSalon"]);
  }
}

function renderKassRevenue() {
  const rowsBox = document.getElementById("kassRevenueRows");
  if (!rowsBox) return;
  initializeKassRevenueFilters();
  const showSalonColumn = ["admin", "manager"].includes(activeAccount.role);
  const revenueTable = rowsBox.closest(".kass-revenue-table");
  revenueTable?.classList.toggle("kass-revenue-own-salon", !showSalonColumn);
  const headRow = document.getElementById("kassRevenueHeadRow");
  if (headRow) {
    headRow.innerHTML = `<th>Огноо</th><th>Цаг</th><th>Овог нэр</th><th>Утас</th><th>Авсан үйлчилгээ</th>${showSalonColumn ? "<th>Салбар</th>" : ""}<th>Төлбөр</th><th>Үнийн дүн</th>`;
  }
  const from = document.getElementById("kassRevenueFrom")?.value || "";
  const to = document.getElementById("kassRevenueTo")?.value || "";
  const salon = isSalonAccount() ? activeAccount.salon : (document.getElementById("kassRevenueSalon")?.value || "");
  const filtered = kassRevenueSourceRows()
    .filter(row => !from || row.date >= from)
    .filter(row => !to || row.date <= to)
    .filter(row => !salon || row.salon === salon)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const total = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const methodTotals = filtered.reduce((totals, row) => {
    totals[row.method] = Number(totals[row.method] || 0) + Number(row.amount || 0);
    return totals;
  }, {});
  document.getElementById("kassRevenueTotal").textContent = money(total);
  document.getElementById("kassRevenueCount").textContent = `${filtered.length} төлбөр`;
  document.getElementById("kassRevenueMethods").innerHTML = Object.entries(methodTotals).map(([method, amount]) => `
    <div class="kass-revenue-method"><span>${htmlSafe(paymentMethodOptionsLabel(method) || method)}</span><strong>${money(amount)}</strong></div>
  `).join("") || `<span class="muted">Төлбөрийн мэдээлэл алга</span>`;

  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  kassRevenuePage = Math.min(Math.max(kassRevenuePage, 1), pageCount);
  const pageRows = filtered.slice((kassRevenuePage - 1) * pageSize, kassRevenuePage * pageSize);
  rowsBox.innerHTML = pageRows.map(row => `
    <tr>
      <td>${htmlSafe(row.date)}</td>
      <td class="kass-revenue-time">${htmlSafe(row.time || "—")}</td>
      <td>${htmlSafe(row.customer)}</td>
      <td>${htmlSafe(row.phone)}</td>
      <td class="kass-revenue-service-cell">${htmlSafe(row.service)}</td>
      ${showSalonColumn ? `<td>${htmlSafe(row.salon)}</td>` : ""}
      <td class="kass-revenue-payment-method">${htmlSafe(paymentMethodOptionsLabel(row.method) || row.method)}</td>
      <td><strong class="kass-revenue-amount">${money(row.amount)}</strong></td>
    </tr>
  `).join("") || `<tr><td colspan="${showSalonColumn ? 8 : 7}" class="empty-state">Сонгосон хугацаанд орлого бүртгэгдээгүй</td></tr>`;

  const pagination = document.getElementById("kassRevenuePagination");
  if (pagination) {
    pagination.innerHTML = filtered.length > pageSize ? `
      <button class="secondary-btn" type="button" id="kassRevenuePrev" ${kassRevenuePage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${kassRevenuePage} / ${pageCount}</span>
      <button class="secondary-btn" type="button" id="kassRevenueNext" ${kassRevenuePage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("kassRevenuePrev")?.addEventListener("click", () => { kassRevenuePage -= 1; renderKassRevenue(); });
    document.getElementById("kassRevenueNext")?.addEventListener("click", () => { kassRevenuePage += 1; renderKassRevenue(); });
  }
}

function renderKassSchedule() {
  populateKassSelects();
  if (!document.getElementById("kassStartDate")?.value) resetKassForm();
  const rows = document.getElementById("kassRows");
  const pagination = document.getElementById("kassPagination");
  const fromDate = document.getElementById("kassFromFilter")?.value || "";
  const toDate = document.getElementById("kassToFilter")?.value || "";
  const staffSearch = document.getElementById("kassStaffFilter")?.value.trim().toLowerCase() || "";
  const salonFilter = isSalonAccount() ? activeAccount.salon : (document.getElementById("kassSalonFilter")?.value || "");
  const filtered = [...state.kassSchedules]
    .filter(item => !fromDate || item.date >= fromDate)
    .filter(item => !toDate || item.date <= toDate)
    .filter(item => !staffSearch || item.staff.toLowerCase().includes(staffSearch))
    .filter(item => !salonFilter || item.salon === salonFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  kassPage = Math.min(Math.max(kassPage, 1), pageCount);
  const pageRows = filtered.slice((kassPage - 1) * pageSize, kassPage * pageSize);
  if (rows) {
    rows.innerHTML = pageRows.map(item => {
      const editable = canEditKassSchedule(item);
      return `
        <tr class="${editable ? "" : "locked-row"}">
          <td>${dateWithWeekday(item.date)}${item.date === todayText() ? ` <span class="status-text">өнөөдөр</span>` : ""}</td>
          <td>${item.staff}</td>
          <td>${item.salon}</td>
          <td>
            <div class="table-actions">
              <button class="secondary-btn icon-action kass-edit" type="button" data-id="${item.id}" aria-label="Засах" ${editable ? "" : "disabled"}>${editIcon()}</button>
              <button class="danger-btn icon-danger kass-delete" type="button" data-id="${item.id}" aria-label="Устгах" ${editable ? "" : "disabled"}>${trashIcon()}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    rows.querySelectorAll(".kass-edit").forEach(button => button.addEventListener("click", () => editKassSchedule(Number(button.dataset.id))));
    rows.querySelectorAll(".kass-delete").forEach(button => button.addEventListener("click", () => deleteKassSchedule(Number(button.dataset.id))));
  }
  if (pagination) {
    pagination.innerHTML = filtered.length > pageSize ? `
      <button class="secondary-btn" type="button" id="kassPrevPage" ${kassPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${kassPage} / ${pageCount}</span>
      <button class="secondary-btn" type="button" id="kassNextPage" ${kassPage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("kassPrevPage")?.addEventListener("click", () => {
      kassPage -= 1;
      renderKassSchedule();
    });
    document.getElementById("kassNextPage")?.addEventListener("click", () => {
      kassPage += 1;
      renderKassSchedule();
    });
  }
}

function saveKassSchedule(event) {
  event.preventDefault();
  const wasEditing = Boolean(kassEditingId);
  const startDate = formValue("kassStartDate");
  const endDate = formValue("kassEndDate") || startDate;
  let salon = formValue("kassSalon");
  const staff = formValue("kassStaff");
  if (!startDate || !endDate || !salon || !staff) return;
  if (isSalonAccount() && salon !== activeAccount.salon) {
    showToast("Өөр салбарын хуваарь нэмэх боломжгүй");
    return;
  }
  const allowedStaff = accountStaff({ activeOnly: true }).filter(item => item.salon === salon);
  if (!allowedStaff.some(item => item.name === staff)) {
    showToast("Идэвхтэй ажилтан сонгоно уу");
    return;
  }
  if (endDate < startDate) {
    showToast("Дуусах өдөр эхлэх өдрөөс өмнө байна");
    return;
  }
  if (kassEditingId) {
    const item = state.kassSchedules.find(row => Number(row.id) === Number(kassEditingId));
    if (!item || !canEditKassSchedule(item)) {
      showToast("Засах хугацаа дууссан байна");
      return;
    }
    const conflict = kassScheduleConflict(startDate, salon, staff, kassEditingId);
    if (conflict) {
      showToast(kassConflictMessage(conflict, salon, staff));
      return;
    }
    item.date = startDate;
    item.salon = salon;
    item.staff = staff;
  } else {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const conflict = kassScheduleConflict(value, salon, staff);
      if (conflict) {
        showToast(kassConflictMessage(conflict, salon, staff));
        return;
      }
    }
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      state.kassSchedules.unshift({ id: nextId(state.kassSchedules), date: value, salon, staff, createdAt: todayText() });
    }
  }
  state.audit.unshift({ title: "kass_schedule_saved", meta: `Менежер • ${staff} • ${salon} • ${startDate}` });
  saveState();
  resetKassForm();
  renderKassSchedule();
  renderInfoHeader(activeView);
  showToast(wasEditing ? "Касс хуваарь шинэчлэгдлээ" : "Касс хуваарь нэмэгдлээ");
}

function editKassSchedule(id) {
  const item = state.kassSchedules.find(row => Number(row.id) === Number(id));
  if (!item || !canEditKassSchedule(item)) {
    showToast("Засах хугацаа дууссан байна");
    return;
  }
  kassEditingId = id;
  document.getElementById("kassStartDate").value = item.date;
  document.getElementById("kassEndDate").value = item.date;
  document.getElementById("kassSalon").value = item.salon;
  populateKassSelects();
  document.getElementById("kassSalon").value = item.salon;
  document.getElementById("kassStaff").value = item.staff;
  document.getElementById("kassSubmit").textContent = "Хадгалах";
  enhanceNativeSelects(["kassSalon", "kassStaff"]);
}

function deleteKassSchedule(id) {
  const item = state.kassSchedules.find(row => Number(row.id) === Number(id));
  if (!item || !canEditKassSchedule(item)) {
    showToast("Устгах хугацаа дууссан байна");
    return;
  }
  if (!requireDeleteCode()) return;
  state.kassSchedules = state.kassSchedules.filter(row => Number(row.id) !== Number(id));
  saveState();
  renderKassSchedule();
  renderInfoHeader(activeView);
  showToast("Касс хуваарь устгагдлаа");
}

function serviceActionButtons(kind, index, group = "") {
  return `
    <div class="service-actions">
      <button class="secondary-btn icon-action service-edit" type="button" data-kind="${kind}" data-index="${index}" data-group="${group}" aria-label="Засах">${editIcon()}</button>
      <button class="danger-btn icon-danger service-delete" type="button" data-kind="${kind}" data-index="${index}" data-group="${group}" aria-label="Устгах">${trashIcon()}</button>
    </div>
  `;
}

function renderProductGroupControls() {
  refreshProductGroupCounts();
  const brand = document.getElementById("serviceBrand");
  const manager = document.getElementById("productGroupManager");
  if (brand) {
    brand.innerHTML = productGroups.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
    if (!serviceSettingsData.products[activeProductGroup]) activeProductGroup = productGroups[0]?.[0] || "gift";
    brand.value = activeProductGroup;
    enhanceNativeSelects(["serviceBrand"]);
  }
  if (manager) {
    manager.innerHTML = productGroups.map(([key, label, count]) => `
      <span class="service-category-chip">
        ${label} <small>${count}</small>
        <button type="button" data-group="${key}" aria-label="Устгах">×</button>
      </span>
    `).join("");
    manager.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        if (productGroups.length <= 1) {
          showToast("Ядаж нэг ангилал үлдэх хэрэгтэй");
          return;
        }
        const key = button.dataset.group;
        const itemCount = serviceSettingsData.products[key]?.length || 0;
        if (itemCount > 0) {
          showToast("Бараатай ангиллыг устгах боломжгүй");
          return;
        }
        if (!requireDeleteCode()) return;
        const index = productGroups.findIndex(group => group[0] === key);
        if (index >= 0) productGroups.splice(index, 1);
        delete serviceSettingsData.products[key];
        if (activeProductGroup === key) activeProductGroup = productGroups[0][0];
        saveServiceSettings();
        renderSettingsServices();
      });
    });
  }
}

function updateServiceFormMode() {
  const kind = document.getElementById("serviceKind")?.value || "single";
  document.querySelectorAll(".course-only").forEach(item => item.classList.toggle("hidden", kind !== "course"));
  document.querySelectorAll(".product-only").forEach(item => item.classList.toggle("hidden", kind !== "products"));
  document.querySelectorAll(".service-customer-field").forEach(item => item.classList.toggle("hidden", kind === "products"));
  enhanceNativeSelects(["serviceKind", "serviceCustomerType", "serviceBrand"]);
}

function serviceCollectionForRef(ref) {
  if (!ref) return [];
  if (ref.kind === "products") return serviceSettingsData.products[ref.group] || [];
  return serviceSettingsData[ref.kind] || [];
}

function resetServiceForm() {
  const form = document.getElementById("serviceSettingsForm");
  if (!form) return;
  form.reset();
  document.getElementById("serviceVisits").value = "4";
  document.getElementById("serviceSaleQty").value = "3";
  document.getElementById("serviceSubmitBtn").textContent = "Нэмэх";
  serviceEditingRef = null;
  updateServiceFormMode();
}

function fillServiceFormForEdit(kind, index, group = "") {
  const collection = kind === "products" ? serviceSettingsData.products[group] : serviceSettingsData[kind];
  const item = collection?.[index];
  if (!item) return;
  serviceEditingRef = { kind, index, group };
  document.getElementById("serviceKind").value = kind;
  updateServiceFormMode();
  document.getElementById("serviceCode").value = item.code || "";
  document.getElementById("serviceName").value = standardServiceName(item.name, kind);
  document.getElementById("servicePrice").value = item.price || "";
  document.getElementById("serviceCustomerType").value = item.customer || "Том хүн";
  document.getElementById("serviceVisits").value = parseInt(item.visits, 10) || 4;
  document.getElementById("serviceSaleQty").value = parseInt(item.saleNote, 10) || 3;
  document.getElementById("serviceSalePrice").value = item.sale || "";
  document.getElementById("serviceBrand").value = group || activeProductGroup;
  document.getElementById("serviceSubmitBtn").textContent = "Хадгалах";
  enhanceNativeSelects(["serviceKind", "serviceCustomerType", "serviceBrand"]);
  document.getElementById("serviceSettingsForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setChildAgeLimit(value) {
  const input = document.getElementById("childAgeLimit");
  const note = document.getElementById("childAgeNote");
  if (!input) return;
  const next = Math.max(1, Math.min(18, Number(value) || 1));
  input.value = String(next);
  if (note) note.innerHTML = `<strong>${next + 1}+</strong> настай бол том хүний үнээр бодогдоно.`;
}

function bindServiceSettingsForm() {
  const form = document.getElementById("serviceSettingsForm");
  const kind = document.getElementById("serviceKind");
  const groupForm = document.getElementById("productGroupForm");
  const ageMinus = document.getElementById("childAgeMinus");
  const agePlus = document.getElementById("childAgePlus");
  if (ageMinus && !ageMinus.dataset.bound) {
    ageMinus.addEventListener("click", () => setChildAgeLimit(Number(document.getElementById("childAgeLimit").value) - 1));
    ageMinus.dataset.bound = "1";
  }
  if (agePlus && !agePlus.dataset.bound) {
    agePlus.addEventListener("click", () => setChildAgeLimit(Number(document.getElementById("childAgeLimit").value) + 1));
    agePlus.dataset.bound = "1";
  }
  if (kind && !kind.dataset.bound) {
    kind.addEventListener("change", updateServiceFormMode);
    kind.dataset.bound = "1";
  }
  if (form && !form.dataset.bound) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const selectedKind = document.getElementById("serviceKind").value;
      const code = formValue("serviceCode");
      const name = formValue("serviceName");
      const price = Number(formValue("servicePrice")) || 0;
      if (!name || !price) return;
      const wasEditing = Boolean(serviceEditingRef);
      const itemPayload = { code, name: standardServiceName(name, selectedKind), price };
      if (selectedKind === "products") {
        const brand = document.getElementById("serviceBrand").value || activeProductGroup;
        const sale = Number(formValue("serviceSalePrice")) || 0;
        const saleQty = Number(formValue("serviceSaleQty")) || 3;
        serviceSettingsData.products[brand] = serviceSettingsData.products[brand] || [];
        const productPayload = {
          ...itemPayload,
          price,
          sale: sale || undefined,
          saleNote: sale && saleQty ? `/${saleQty}+ш` : undefined
        };
        if (serviceEditingRef) {
          const oldCollection = serviceCollectionForRef(serviceEditingRef);
          if (serviceEditingRef.kind === "products" && serviceEditingRef.group !== brand) oldCollection.splice(serviceEditingRef.index, 1);
          if (serviceEditingRef.kind === "products" && serviceEditingRef.group === brand) oldCollection[serviceEditingRef.index] = productPayload;
          if (serviceEditingRef.kind !== "products" || serviceEditingRef.group !== brand) serviceSettingsData.products[brand].unshift(productPayload);
        } else {
          serviceSettingsData.products[brand].unshift(productPayload);
        }
        activeServiceMainTab = "products";
        activeProductGroup = brand;
      } else {
        const item = {
          ...itemPayload,
          customer: document.getElementById("serviceCustomerType").value,
          price
        };
        if (selectedKind === "course") item.visits = `${Number(formValue("serviceVisits")) || 1} удаа`;
        if (serviceEditingRef) {
          const oldCollection = serviceCollectionForRef(serviceEditingRef);
          if (serviceEditingRef.kind === selectedKind) oldCollection[serviceEditingRef.index] = item;
          if (serviceEditingRef.kind !== selectedKind) {
            oldCollection.splice(serviceEditingRef.index, 1);
            serviceSettingsData[selectedKind].unshift(item);
          }
        } else {
          serviceSettingsData[selectedKind].unshift(item);
        }
        activeServiceMainTab = selectedKind;
      }
      resetServiceForm();
      saveServiceSettings();
      renderSettingsServices();
      showToast(wasEditing ? "Үйлчилгээ шинэчлэгдлээ" : "Үйлчилгээ нэмэгдлээ");
    });
    form.dataset.bound = "1";
  }
  if (groupForm && !groupForm.dataset.bound) {
    groupForm.addEventListener("submit", event => {
      event.preventDefault();
      const name = formValue("productGroupName");
      if (!name) return;
      const key = `custom_${Date.now()}`;
      productGroups.push([key, name, 0]);
      serviceSettingsData.products[key] = [];
      activeServiceMainTab = "products";
      activeProductGroup = key;
      document.getElementById("productGroupName").value = "";
      saveServiceSettings();
      renderSettingsServices();
      showToast("Ангилал нэмэгдлээ");
    });
    groupForm.dataset.bound = "1";
  }
  renderProductGroupControls();
  setChildAgeLimit(Number(document.getElementById("childAgeLimit")?.value || 9));
  updateServiceFormMode();
}

function renderSettingsServices() {
  bindServiceSettingsForm();
  const mainTabs = [
    ["single", "Нэг удаа"],
    ["course", "Курс"],
    ["products", "Касс"]
  ];
  const mainTabsEl = document.getElementById("serviceMainTabs");
  const groupTabsEl = document.getElementById("serviceProductTabs");
  const headEl = document.getElementById("serviceSettingsHead");
  const rowsEl = document.getElementById("serviceSettingsRows");
  if (!mainTabsEl || !groupTabsEl || !headEl || !rowsEl) return;

  mainTabsEl.innerHTML = mainTabs.map(([key, label]) => `
    <button class="service-main-tab ${activeServiceMainTab === key ? "active" : ""}" type="button" data-tab="${key}">
      ${label} <span>${serviceCountForMain(key)}</span>
    </button>
  `).join("");

  groupTabsEl.innerHTML = activeServiceMainTab === "products" ? productGroups.map(([key, label, count]) => `
    <button class="service-product-tab ${activeProductGroup === key ? "active" : ""}" type="button" data-group="${key}">
      ${label} <span>(${count})</span>
    </button>
  `).join("") : "";

  if (activeServiceMainTab === "products") {
    const items = serviceSettingsData.products[activeProductGroup] || [];
    headEl.innerHTML = `
      <tr>
        <th>Код</th>
        <th>Нэр</th>
        <th>Үнэ</th>
        <th>Sale үнэ</th>
        <th></th>
      </tr>
    `;
    rowsEl.innerHTML = items.map((item, index) => `
      <tr>
        <td>${serviceCodeBadge(item.code)}</td>
        <td><strong>${item.name}</strong></td>
        <td><strong>${money(item.price)}</strong></td>
        <td>${salePriceCell(item)}</td>
        <td>${serviceActionButtons("products", index, activeProductGroup)}</td>
      </tr>
    `).join("");
  } else {
    const isCourse = activeServiceMainTab === "course";
    const items = serviceSettingsData[activeServiceMainTab];
    headEl.innerHTML = `
      <tr>
        <th>Код</th>
        <th>Нэр</th>
        <th>Хэрэглэгч</th>
        <th>Үнэ</th>
        ${isCourse ? "<th>Оролт</th>" : ""}
        <th></th>
      </tr>
    `;
    rowsEl.innerHTML = items.map((item, index) => `
      <tr>
        <td>${serviceCodeBadge(item.code)}</td>
        <td><strong>${standardServiceName(item.name, activeServiceMainTab)}</strong></td>
        <td><span class="service-customer-text">${item.customer}</span></td>
        <td><strong>${money(item.price)}</strong></td>
        ${isCourse ? `<td><span class="service-visit-text">${serviceVisitText(item)}</span></td>` : ""}
        <td>${serviceActionButtons(activeServiceMainTab, index)}</td>
      </tr>
    `).join("");
  }

  mainTabsEl.querySelectorAll(".service-main-tab").forEach(button => {
    button.addEventListener("click", () => {
      activeServiceMainTab = button.dataset.tab;
      renderSettingsServices();
    });
  });
  groupTabsEl.querySelectorAll(".service-product-tab").forEach(button => {
    button.addEventListener("click", () => {
      activeProductGroup = button.dataset.group;
      renderSettingsServices();
    });
  });
  rowsEl.querySelectorAll(".service-edit").forEach(button => {
    button.addEventListener("click", () => {
      fillServiceFormForEdit(button.dataset.kind, Number(button.dataset.index), button.dataset.group || "");
    });
  });
  rowsEl.querySelectorAll(".service-delete").forEach(button => {
    button.addEventListener("click", () => {
      if (!requireDeleteCode()) return;
      const ref = {
        kind: button.dataset.kind,
        index: Number(button.dataset.index),
        group: button.dataset.group || ""
      };
      const collection = serviceCollectionForRef(ref);
      collection.splice(ref.index, 1);
      if (serviceEditingRef && serviceEditingRef.kind === ref.kind && serviceEditingRef.index === ref.index && serviceEditingRef.group === ref.group) resetServiceForm();
      saveServiceSettings();
      renderSettingsServices();
      showToast("Үйлчилгээ устлаа");
    });
  });
}

function bookingStatusText(status) {
  if (status === "confirmed") return "Баталгаажсан";
  if (status === "rejected") return "Татгалзсан";
  return "Хүлээгдэж буй";
}

function bookingStatusTone(status) {
  if (status === "confirmed") return "green";
  if (status === "rejected") return "gray";
  return "pink";
}

function bookingStatusLabel(status) {
  return `<span class="status-text ${bookingStatusTone(status)}${status === "pending" ? " pending" : ""}">${bookingStatusText(status)}</span>`;
}

function bookingSourceText(source, status) {
  const normalizedSource = source || (status === "confirmed" ? "admin" : "site");
  return normalizedSource === "admin" ? "Админ" : "Хэрэглэгч";
}

function dateWithWeekday(dateText) {
  const weekdays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${dateText} · ${weekdays[date.getDay()]}`;
}

function parseDisplayDate(value) {
  const clean = value.trim();
  if (!clean) return "";
  const match = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return clean;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function todayText() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeText(dateText = todayText()) {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateText} ${hours}:${minutes}`;
}

function currentYear() {
  return Number(todayText().slice(0, 4)) || new Date().getFullYear();
}

function birthYearFromAge(ageValue) {
  const age = Number(ageValue);
  return age > 0 ? currentYear() - age : "";
}

function customerAge(customer = {}) {
  const birthYear = Number(customer.birthYear || 0);
  if (birthYear > 0) return Math.max(0, currentYear() - birthYear);
  return Number(customer.age || 0) || "";
}

function setCustomerAgeFromInput(customer, ageValue) {
  const birthYear = birthYearFromAge(ageValue);
  customer.birthYear = birthYear;
  customer.age = birthYear ? customerAge({ birthYear }) : "";
}

function ensureCustomerAgeData() {
  let changed = false;
  state.customers = state.customers.map(customer => {
    const birthYear = customer.birthYear || birthYearFromAge(customer.age);
    if (!customer.birthYear && birthYear) changed = true;
    return {
      ...customer,
      birthYear,
      age: birthYear ? customerAge({ birthYear }) : customer.age
    };
  });
  if (changed) saveState();
}

function currentTimeText() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function isPastDate(dateText) {
  return Boolean(dateText) && dateText < todayText();
}

function isPastBookingTime(dateText, timeText) {
  if (!dateText || !timeText) return false;
  if (isPastDate(dateText)) return true;
  return dateText === todayText() && timeToMinutes(timeText) <= timeToMinutes(currentTimeText());
}

const districtNames = ["Хан-Уул", "Чингэлтэй", "Баянзүрх", "Баянгол", "Сонгинохайрхан", "Сүхбаатар", "Налайх", "Багануур", "Багахангай"];

function districtOptions(selected = "") {
  return districtNames.map(name => `<option ${name === selected ? "selected" : ""}>${name}</option>`).join("");
}

function districtFilterOptions(selected = "all") {
  return `<option value="all">Бүх дүүрэг</option>${districtNames.map(name => `<option value="${name}" ${name === selected ? "selected" : ""}>${name}</option>`).join("")}`;
}
function makeStats(items) {
  return items
    .map(([label, value]) => `${label}: <span>${value}</span>`)
    .join('<span class="info-divider">|</span>');
}

function topCustomerDistrict(customers) {
  const counts = customers.reduce((acc, customer) => {
    const district = customer.district || "Тодорхойгүй";
    acc[district] = (acc[district] || 0) + 1;
    return acc;
  }, {});
  const [district] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["-"];
  return district;
}

function averageCustomerAge(customers) {
  const ages = customers.map(customer => Number(customerAge(customer))).filter(Boolean);
  if (!ages.length) return "-";
  return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
}

function customerGenderSummary(customers) {
  const female = customers.filter(customer => customer.gender === "Эмэгтэй").length;
  const male = customers.filter(customer => customer.gender === "Эрэгтэй").length;
  return `Эм ${female} / Эр ${male}`;
}

function infoForView(name) {
  const bookings = state.bookings;
  const customers = state.customers;
  const services = state.services;
  const staff = state.staff;
  const catalog = state.catalog;
  const today = todayText();
  const performanceReport = buildPerformanceReport();
  const currentMonthKass = state.kassSchedules
    .filter(item => monthText(item.date) === monthText(today))
    .filter(item => !isSalonAccount() || item.salon === activeAccount.salon)
    .reduce((acc, item) => {
      acc[item.staff] = (acc[item.staff] || 0) + 1;
      return acc;
    }, {});
  const currentMonthKassStats = Object.entries(currentMonthKass)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => [name, `${count} өдөр`]);

  const bookingStats = [
    ["Нийт", bookings.length],
    ["Баталгаажсан", bookings.filter(item => item.status === "confirmed").length],
    ["Хүлээгдэж буй", bookings.filter(item => item.status === "pending").length],
    ["Өнөөдөр", bookings.filter(item => item.date === today).length]
  ];

  const info = {
    bookings: ["НИЙТ ЗАХИАЛГА", bookingStats],
    customers: ["НИЙТ ХЭРЭГЛЭГЧ", [
      ["Нийт", customers.length],
      ["Идэвхтэй курс", customers.filter(item => item.activeCourse).length],
      ["Төлбөр дутуу", customers.filter(item => item.unpaid).length],
      ["Хүйс", customerGenderSummary(customers)],
      ["Дундаж нас", averageCustomerAge(customers)],
      ["Их дүүрэг", topCustomerDistrict(customers)]
    ]],
    kass: ["ЭНЭ САРЫН КАСС", currentMonthKassStats.length ? currentMonthKassStats : [["Бүртгэл", "алга"]]],
    kassRevenue: (() => {
      const rows = kassRevenueSourceRows().filter(row => !isSalonAccount() || row.salon === activeAccount.salon);
      return ["КАСС ОРЛОГО", [
        ["Нийт орлого", money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0))],
        ["Төлбөр", rows.length],
        ["Салбар", isSalonAccount() ? activeAccount.salon : new Set(rows.map(row => row.salon)).size]
      ]];
    })(),
    services: ["ҮЙЛЧИЛГЭЭНИЙ БҮРТГЭЛ", [
      ["Нийт", services.length],
      ["Идэвхтэй курс", customers.filter(item => item.activeCourse).length],
      ["Вип нэмэлттэй", services.filter(item => item.total > 90000).length],
      ["Өнөөдөр", services.length]
    ]],
    payments: ["КАСС ОРЛОГО", [
      ["Нийт орлого", "4,820,000₮"],
      ["Төлөгдсөн", 2],
      ["Дутуу", 1],
      ["Бонус ашиглалт", "180,000₮"]
    ]],
    dashboard: (() => {
      const month = dashboardSelectedMonth();
      const salon = dashboardSelectedSalon();
      const snapshot = dashboardSnapshot(month, salon);
      const mode = dashboardSelectedViewMode();
      const modeTitles = { overview: "ЕРӨНХИЙ ТОЙМ", operations: "ӨДРИЙН АЖИЛЛАГАА", cashflow: "МӨНГӨН УРСГАЛ", system: "СИСТЕМИЙН ХЯНАЛТ" };
      const modeStats = {
        overview: [["Хугацаа", month.label], ["Хамрах хүрээ", salon || "Нийт салбар"], ["Орлого", money(snapshot.revenue)], ["Үйлчилгээ", formatNumber(snapshot.visits)]],
        operations: [["Өдөр", today], ["Хамрах хүрээ", salon || "Нийт салбар"], ["Захиалга", Math.max(12, Math.round(96 * (salon ? dashboardBranch(salon).share : 1)))], ["Дүүргэлт", `${snapshot.occupancy}%`]],
        cashflow: [["Хугацаа", month.label], ["Хамрах хүрээ", salon || "Нийт салбар"], ["Орлого", money(snapshot.revenue)], ["Авлага", money(snapshot.outstanding)]],
        system: [["Хамрах хүрээ", salon || "Нийт систем"], ["Өнөөдрийн үйлдэл", Math.round(512 * (salon ? dashboardBranch(salon).share : 1))], ["Сүүлийн backup", "03:10"], ["Анхааруулга", 28]]
      };
      return [modeTitles[mode] || modeTitles.overview, modeStats[mode] || modeStats.overview];
    })(),
    performance: ["ГҮЙЦЭТГЭЛ", [
      ["Хугацаа", performanceReport.periodLabel],
      ["Ажилтан", performanceReport.rows.length],
      ["Үйлчилгээ", performanceReport.singleCount + performanceReport.courseCount],
      ["Орлого", money(performanceReport.revenue)],
      ["Урамшуулал", money(performanceReport.commission)]
    ]],
    reports: ["ТАЙЛАН", [
      ["Сарын орлого", "128,400,000₮"],
      ["Курс дуусаагүй", 126],
      ["Төлбөр дутуу", 17],
      ["Excel татах", 3]
    ]],
    branches: ["САЛБАР", [
      ["Салбар", state.salons.length],
      ["Идэвхтэй", state.salons.filter(item => item.active !== false).length],
      ["Идэвхгүй", state.salons.filter(item => item.active === false).length]
    ]],
    staff: ["АЖИЛТАН", [
      ["Нийт", staff.length],
      ["Идэвхтэй", staff.filter(item => item.status === "active").length],
      ["Вип", staff.filter(item => item.vip).length],
      ["Томилгоо", state.assignments.length]
    ]],
    catalog: ["ҮЙЛЧИЛГЭЭНИЙ САН", [
      ["Нийт", catalog.length],
      ["Үйлчилгээ", catalog.filter(item => item.type === "service").length],
      ["Курс", catalog.filter(item => item.type === "course").length],
      ["Бүтээгдэхүүн", catalog.filter(item => item.type === "product").length]
    ]],
    loyalty: ["БОНУС / ВАУЧЕР", [
      ["Бонус үлдэгдэл", "18,900,000₮"],
      ["Тусгай хэрэглэгч", customers.filter(item => item.type === "Тусгай хэрэглэгч").length],
      ["Ажилтан", customers.filter(item => item.type === "Ажилтан").length],
      ["Ваучер", 2]
    ]],
    vouchers: ["ВАУЧЕР", [
      ["Роль", state.voucherRoles.length],
      ["Нийт ашиглалт", state.voucherLogs.length],
      ["Нийт дүн", money(state.voucherLogs.reduce((sum, item) => sum + Number(item.amount || 0), 0))]
    ]],
    giftCards: ["БЭЛГИЙН КАРТ", [
      ["Нийт", state.giftCards.length],
      ["Идэвхтэй", state.giftCards.filter(card => giftCardStatus(card) === "fresh").length],
      ["Ашиглаж байгаа", state.giftCards.filter(card => giftCardStatus(card) === "partial").length],
      ["Дууссан", state.giftCards.filter(card => giftCardStatus(card) === "used").length]
    ]],
    settings: ["ТОХИРГОО", [
      ["Зургийн тоо", 5],
      ["Вип өрөө", "20,000₮"],
      ["Вип ажилтан", "15,000₮"],
      ["Эхлэх бонус", "2%"]
    ]],
    settingsServices: ["ҮЙЛЧИЛГЭЭНИЙ ТОХИРГОО", [
      ["Нэг удаа", 12],
      ["Курс", 14],
      ["Касс", 79],
      ["Дэд ангилал", productGroups.length]
    ]],
    settingsSchedule: ["ЦАГИЙН ХУВААРЬ", [
      ["Салбар", state.salons.length],
      ["Хан-Уул суудал", state.salons[0]?.slotCapacity || 4],
      ["Төв суудал", state.salons[1]?.slotCapacity || 6],
      ["Вип суудал", state.salons[2]?.slotCapacity || 4]
    ]],
    settingsHolidays: ["АМРАЛТЫН ӨДӨР", [
      ["Нийт", state.holidays.length],
      ["Өнөөдрөөс хойш", state.holidays.filter(item => item.date >= today).length],
      ["Салбар", new Set(state.holidays.map(item => item.salon)).size]
    ]],
    settingsGeneral: ["ЕРӨНХИЙ ТОХИРГОО", [
      ["Үйлчилгээ засах/устгах хоног", generalSettings().serviceEditDays],
      ["Касс, томилгоо", generalSettings().kassEditDays],
      ["Зургийн хэмжээ", generalSettings().diagnosisCaptureMode === "native" ? "Камерын үндсэн" : generalSettings().diagnosisCaptureSize],
      ["Оношилгоо", state.diagnosisTypes.length]
    ]],
    settingsCatalog: ["КАТАЛОГИ", [
      ["Төрөл", "FlipHTML5"],
      ["Чирэх заавар", homepageSettings().catalog.dragHintEnabled === false ? "Нуусан" : "Харуулна"]
    ]],
    settingsResults: ["ҮР ДҮН", [
      ["Нийт", homepageSettings().results.posts.length],
      ["Нийтэлсэн", homepageSettings().results.posts.filter(item => item.published !== false).length]
    ]],
    settingsDatabase: ["ӨГӨГДЛИЙН САН", [
      ["Хэрэглэгч", state.customers.filter(item => !item.deleted).length],
      ["Цаг захиалга", state.bookings.length],
      ["Төлбөр", kassRevenueSourceRows().length],
      ["Backup", databaseBackups().length]
    ]],
    settingsUsers: ["ХЭРЭГЛЭГЧИЙН ЭРХ", [
      ["Нийт", systemUsers.length],
      ["Админ", systemUsers.filter(item => item.role === "admin" && item.active).length],
      ["Менежер", systemUsers.filter(item => item.role === "manager" && item.active).length],
      ["Салбарын эрх", systemUsers.filter(item => item.role === "salon" && item.active).length],
      ["Идэвхгүй", systemUsers.filter(item => !item.active).length]
    ]],
    settingsPricing: ["ҮНИЙН БОДЛОГО", [
      ["Вип өрөө", money(pricePolicy().vipRoomFee)],
      ["Мастер", money(pricePolicy().masterStaffFee)],
      ["Төрөл", state.customerTypes.length],
      ["Дүрмээр", state.customerTypes.filter(type => customerTypeRule(type).dynamic).length]
    ]],
    settingsDiscounts: ["ХЯМДРАЛ", [
      ["Нийт", state.discounts.length],
      ["Идэвхтэй", state.discounts.filter(item => item.startDate <= today && item.endDate >= today).length],
      ["Ирээдүй", state.discounts.filter(item => item.startDate > today).length],
      ["Салбар", new Set(state.discounts.flatMap(item => item.salons || [])).size]
    ]],
    settingsBonus: ["БОНУС ТОХИРГОО", [
      ["Хэрэглэгч", `${customerTypeRule("Хэрэглэгч").bonusPercent}%`],
      ["Дээд хувь", "10%"],
      ["2 жилийн дүрэм", "Асаалттай"],
      ["Ажилтан", "Тусдаа"]
    ]],
    settingsHumanResources: ["ХҮНИЙ НӨӨЦ", [
      ["Нийт", staff.length],
      ["Идэвхтэй", staff.filter(item => item.status !== "inactive").length],
      ["Идэвхгүй", staff.filter(item => item.status === "inactive").length],
      ["Түр томилгоо", state.assignments.length],
      ["Дундаж хувь", `${Math.round(staff.reduce((sum, item) => sum + Number(item.bonusCommission ?? parseFloat(item.commission) ?? 0), 0) / Math.max(staff.length, 1))}%`]
    ]],
    audit: ["ҮЙЛДЛИЙН ТҮҮХ", [
      ["Нийт", state.audit.length],
      ["Өнөөдөр", state.audit.length],
      ["Чухал үйлдэл", 4],
      ["Excel таталт", 1]
    ]],
    groups: ["ГРУПП", [
      ["Нийт групп", state.customerGroups.length],
      ["Нийт гишүүн", state.customerGroups.reduce((sum, group) => sum + (group.members || []).length, 0)],
      ["Нийт хэрэглээ", money(state.customerGroups.reduce((sum, group) => sum + Number(group.spent2y || 0), 0))],
      ["Бонус үлдэгдэл", money(state.customerGroups.reduce((sum, group) => sum + Number(groupBonusInfo(group)?.balance || 0), 0))]
    ]],
    profile: (() => {
      const customer = state.customers.find(item => Number(item.id) === Number(state.selectedCustomerId)) || customers[0];
      if (!customer) {
        return ["ХЭРЭГЛЭГЧИЙН СТАТИСТИК", [
          ["Нийт төлсөн", money(0)],
          ["Дутуу төлбөр", money(0)],
          ["Групп бонус", money(0)],
          ["Нэг удаа", 0],
          ["Курс", 0],
          ["Касс", 0]
        ]];
      }
      const group = customerGroup(customer);
      const bonus = groupBonusInfo(group);
      const stats = profileServiceStats(customer);
      return ["ХЭРЭГЛЭГЧИЙН СТАТИСТИК", [
        ["Нийт төлсөн", money(stats.totalPaid || 0)],
        ["Дутуу төлбөр", money(stats.totalBalance || 0)],
        ["Групп бонус", money(bonus?.balance || 0)],
        ["Нэг удаа", stats.single],
        ["Курс", stats.course],
        ["Касс", stats.kass]
      ]];
    })()
  };

  return info[name] || info.bookings;
}

function renderInfoHeader(name = activeView) {
  const panel = document.getElementById("infoHeader");
  if (panel) panel.classList.remove("hidden");
  const [title, stats] = infoForView(name);
  document.getElementById("infoTitle").textContent = title;
  document.getElementById("infoStats").innerHTML = makeStats(stats);
  document.getElementById("infoExcelBtn")?.classList.toggle("hidden", !["vouchers", "giftCards", "performance"].includes(name));
}

function dashboardSelectedMonth() {
  const key = document.getElementById("dashboardMonth")?.value;
  return dashboardDemoData.months.find(item => item.key === key) || dashboardDemoData.months.at(-1);
}

function dashboardSelectedSalon() {
  if (isSalonAccount()) return activeAccount.salon;
  return document.getElementById("dashboardSalon")?.value || "";
}

function dashboardBranch(name) {
  const exact = dashboardDemoData.branches.find(item => item.name === name);
  if (exact) return exact;
  const normalized = String(name || "").toLowerCase();
  const alias = normalized.includes("чингэлтэй")
    ? dashboardDemoData.branches.find(item => item.name === "Төв салбар")
    : normalized.includes("хан-уул") || normalized.includes("хан уул")
      ? dashboardDemoData.branches.find(item => item.name === "Хан-Уул салбар")
      : normalized.includes("вип")
        ? dashboardDemoData.branches.find(item => item.name === "Вип салбар")
        : null;
  if (alias) return { ...alias, name };
  const salonIndex = Math.max(0, state.salons.findIndex(item => item.name === name));
  const template = dashboardDemoData.branches[salonIndex % dashboardDemoData.branches.length];
  return { ...template, name: name || template.name };
}

function dashboardSnapshot(month, salon = "") {
  const branch = salon ? dashboardBranch(salon) : null;
  const share = branch?.share || 1;
  return {
    revenue: Math.round(month.revenue * share),
    payments: Math.round(month.payments * share),
    visits: Math.round(month.visits * share),
    products: Math.round(month.products * share),
    newCustomers: month.newCustomers,
    outstanding: Math.round(month.outstanding * share),
    completion: Math.max(0, Math.min(100, month.completion + (branch?.completionDelta || 0))),
    occupancy: Math.max(0, Math.min(100, month.occupancy + (branch?.occupancyDelta || 0)))
  };
}

function dashboardCompactMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `${(amount / 1000000).toLocaleString("mn-MN", { maximumFractionDigits: 1 })} сая ₮`;
  if (amount >= 1000) return `${Math.round(amount / 1000).toLocaleString("en-US")} мян ₮`;
  return money(amount);
}

function dashboardTrendSvg(monthKey, salon) {
  const endIndex = Math.max(0, dashboardDemoData.months.findIndex(item => item.key === monthKey));
  const months = dashboardDemoData.months.slice(Math.max(0, endIndex - 5), endIndex + 1);
  const values = months.map(month => dashboardSnapshot(month, salon).revenue);
  const max = Math.max(...values, 1) * 1.08;
  const min = Math.min(...values) * .9;
  const chartHeight = 154;
  const bottom = 190;
  const x = index => 54 + (months.length === 1 ? 0 : index * (596 / (months.length - 1)));
  const y = value => 24 + ((max - value) / Math.max(max - min, 1)) * chartHeight;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `M ${x(0)} ${bottom} L ${values.map((value, index) => `${x(index)} ${y(value)}`).join(" L ")} L ${x(values.length - 1)} ${bottom} Z`;
  const guides = [0, 1, 2, 3].map(index => {
    const guideY = 24 + index * (chartHeight / 3);
    const value = max - index * ((max - min) / 3);
    return `<line x1="54" y1="${guideY}" x2="650" y2="${guideY}" class="dashboard-chart-grid"/><text x="46" y="${guideY + 4}" text-anchor="end" class="dashboard-chart-axis">${Math.round(value / 1000000)}с</text>`;
  }).join("");
  const labels = months.map((month, index) => `<text x="${x(index)}" y="215" text-anchor="middle" class="dashboard-chart-axis">${month.short}</text>`).join("");
  const dots = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" class="dashboard-chart-dot"><title>${monthLabelForDashboard(months[index])}: ${money(value)}</title></circle>`).join("");
  return `<svg class="dashboard-line-chart" viewBox="0 0 680 224" role="img" aria-label="Сарын орлогын өөрчлөлт">${guides}<path d="${area}" class="dashboard-chart-area"/><polyline points="${points}" class="dashboard-chart-line"/>${dots}${labels}</svg>`;
}

function monthLabelForDashboard(month) {
  return month?.label || "";
}

function dashboardAllowedBranches() {
  if (isSalonAccount()) return [dashboardBranch(activeAccount.salon)];
  const selected = dashboardSelectedSalon();
  const names = selected ? [selected] : state.salons.map(item => item.name);
  return names.map(dashboardBranch);
}

function dashboardRowsForBranches(month) {
  return dashboardAllowedBranches().map(branch => ({
    ...branch,
    ...dashboardSnapshot(month, branch.name)
  }));
}

function dashboardProgressRows(items, valueKey, formatter = value => value) {
  const max = Math.max(...items.map(item => Number(item[valueKey] || 0)), 1);
  return items.map(item => `
    <div class="dashboard-progress-row">
      <div class="dashboard-progress-meta"><strong>${htmlSafe(item.name)}</strong><span>${formatter(item[valueKey])}</span></div>
      <div class="dashboard-progress-track"><span style="width:${Math.max(5, Number(item[valueKey] || 0) / max * 100)}%"></span></div>
    </div>
  `).join("");
}

const DASHBOARD_CHART_MODE_KEY = "khalgai_dashboard_chart_modes_v1";
let dashboardChartModes = (() => {
  try {
    return { revenue: "line", branch: "bar", services: "donut", payments: "bar", staff: "bar", ...JSON.parse(localStorage.getItem(DASHBOARD_CHART_MODE_KEY) || "{}") };
  } catch (error) {
    return { revenue: "line", branch: "bar", services: "donut", payments: "bar", staff: "bar" };
  }
})();

function dashboardChartIcon(mode) {
  const paths = {
    line: `<polyline points="3,16 8,10 13,13 21,5"></polyline>`,
    bar: `<rect x="3" y="11" width="4" height="9"></rect><rect x="10" y="6" width="4" height="14"></rect><rect x="17" y="3" width="4" height="17"></rect>`,
    donut: `<circle cx="12" cy="12" r="8"></circle><path d="M12 4v8h8"></path>`,
    table: `<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14"></path>`
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[mode] || paths.bar}</svg>`;
}

function dashboardChartControls(key, modes) {
  const labels = { line: "Шугаман", bar: "Багана", donut: "Дугуй", table: "Хүснэгт" };
  return `<div class="dashboard-chart-controls" aria-label="Chart төрөл">${modes.map(mode => `<button class="dashboard-chart-mode ${dashboardChartModes[key] === mode ? "active" : ""}" type="button" data-dashboard-chart="${key}" data-dashboard-mode="${mode}" title="${labels[mode]}">${dashboardChartIcon(mode)}</button>`).join("")}</div>`;
}

function dashboardSimpleTable(headers, rows) {
  return `<div class="table-wrap dashboard-mini-table-wrap"><table class="dashboard-mini-table"><thead><tr>${headers.map(item => `<th>${item}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((item, index) => `<td class="${index ? "amount-cell" : ""}">${item}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function dashboardVerticalBars(items, valueKey, formatter = value => value) {
  const max = Math.max(...items.map(item => Number(item[valueKey] || 0)), 1);
  return `<div class="dashboard-vertical-bars">${items.map(item => `<div class="dashboard-vertical-bar"><div class="dashboard-vertical-bar-value">${formatter(item[valueKey])}</div><div class="dashboard-vertical-bar-track"><span style="height:${Math.max(7, Number(item[valueKey] || 0) / max * 100)}%"></span></div><small>${htmlSafe(item.short || item.name)}</small></div>`).join("")}</div>`;
}

function dashboardDonutMarkup(items, total, valueKey = "share") {
  const sum = items.reduce((result, item) => result + Number(item[valueKey] || 0), 0) || 1;
  let offset = 0;
  const gradient = items.map(item => {
    const size = Number(item[valueKey] || 0) / sum * 100;
    const part = `${item.color} ${offset}% ${offset + size}%`;
    offset += size;
    return part;
  }).join(",");
  const totalText = Number(total) >= 1000000 ? `${(Number(total) / 1000000).toFixed(1)}сая` : formatNumber(total);
  return `<div class="dashboard-donut-layout"><div class="dashboard-donut" style="background:conic-gradient(${gradient})"><span><strong>${totalText}</strong><small>нийт</small></span></div><div class="dashboard-legend">${items.map(item => `<div><i style="background:${item.color}"></i><span>${htmlSafe(item.name)}</span><strong>${item.share}%</strong></div>`).join("")}</div></div>`;
}

function dashboardCustomerDemographics() {
  const customers = state.customers.filter(item => !item.deleted && !item.deletedAt);
  const total = customers.length;
  const count = predicate => customers.filter(predicate).length;
  const demographicItem = (name, value, color) => ({
    name,
    value,
    share: total ? Math.round(value / total * 100) : 0,
    color
  });
  const ageValue = customer => Number(customerAge(customer) || customer.age || 0);
  const districtCounts = customers.reduce((result, customer) => {
    const name = customer.district || "Мэдээлэлгүй";
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
  return {
    genders: [
      demographicItem("Эмэгтэй", count(item => item.gender === "Эмэгтэй"), "#60bf63"),
      demographicItem("Эрэгтэй", count(item => item.gender === "Эрэгтэй"), "#9bcf91"),
      demographicItem("Мэдээлэлгүй", count(item => !item.gender), "#dfe9d7")
    ],
    ages: [
      { name: "18–24", value: count(item => ageValue(item) >= 18 && ageValue(item) <= 24) },
      { name: "25–34", value: count(item => ageValue(item) >= 25 && ageValue(item) <= 34) },
      { name: "35–44", value: count(item => ageValue(item) >= 35 && ageValue(item) <= 44) },
      { name: "45–54", value: count(item => ageValue(item) >= 45 && ageValue(item) <= 54) },
      { name: "55+", value: count(item => ageValue(item) >= 55) }
    ],
    districts: Object.entries(districtCounts).map(([name, value]) => ({ name, value }))
  };
}

function dashboardStaffRows(month, salon) {
  const available = state.staff.filter(item => item.status !== "inactive" && (!salon || item.salon === salon));
  const fallback = ["Ариундулам", "Номинзул", "Мөнхзул", "Урантогоос", "Уранцэцэг", "Энхзул", "Оюундарь", "Бадамханд"];
  const source = available.length ? available.slice(0, 8) : fallback.map((name, index) => ({ name, salon: salon || state.salons[index % Math.max(state.salons.length, 1)]?.name || "Хан-Уул салбар" }));
  const snapshot = dashboardSnapshot(month, salon);
  return source.map((item, index) => {
    const rate = Math.max(.035, .105 - index * .009);
    const revenue = Math.round(snapshot.revenue * rate);
    const visits = Math.max(0, Math.round(snapshot.visits * rate * 1.55));
    const serviceReward = Math.round(revenue * .1);
    const kassReward = index % 3 === 0 ? Math.round(snapshot.products * rate * .02) : 0;
    return { name: item.name, homeSalon: item.salon || salon || "Үндсэн салбар", workedSalon: salon || item.salon || "Олон салбар", revenue, visits, serviceReward, kassReward, totalReward: serviceReward + kassReward };
  }).sort((a, b) => b.revenue - a.revenue);
}

const dashboardViewModes = [
  { value: "overview", label: "Ерөнхий тойм" },
  { value: "operations", label: "Өдрийн ажиллагаа" },
  { value: "cashflow", label: "Мөнгөн урсгал" },
  { value: "system", label: "Системийн хяналт" }
];

function dashboardAllowedViewModes() {
  const permissions = {
    admin: ["overview", "operations", "cashflow", "system"],
    manager: ["overview", "operations"],
    salon: ["operations"],
    finance: ["overview", "cashflow"],
    director: ["overview", "cashflow"]
  };
  const allowed = permissions[activeAccount.role] || ["overview"];
  return dashboardViewModes.filter(item => allowed.includes(item.value));
}

function dashboardSelectedViewMode() {
  const value = document.getElementById("dashboardViewMode")?.value;
  const allowed = dashboardAllowedViewModes();
  return allowed.some(item => item.value === value) ? value : allowed[0]?.value || "overview";
}

function dashboardOperationsHtml(month, salon, snapshot) {
  const scope = salon || "Нийт салбар";
  const today = todayText();
  const todayBookings = state.bookings.filter(item => item.date === today && (!salon || item.salon === salon));
  const bookings = todayBookings.length;
  const statusCount = status => todayBookings.filter(item => item.status === status).length;
  const bookingStatus = [
    { name: "Баталгаажсан", value: statusCount("confirmed"), share: bookings ? Math.round(statusCount("confirmed") / bookings * 100) : 0, color: "#60bf63" },
    { name: "Хүлээгдэж буй", value: statusCount("pending"), share: bookings ? Math.round(statusCount("pending") / bookings * 100) : 0, color: "#9bcf91" },
    { name: "Ирсэнгүй", value: statusCount("missed"), share: bookings ? Math.round(statusCount("missed") / bookings * 100) : 0, color: "#e5b65d" },
    { name: "Цуцалсан", value: statusCount("cancelled"), share: bookings ? Math.round(statusCount("cancelled") / bookings * 100) : 0, color: "#e38a8a" }
  ];
  const slots = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"].map(name => ({ name, value: todayBookings.filter(item => item.time?.startsWith(name.slice(0, 2))).length }));
  const activeTreatments = state.customers.filter(customer => customer.currentTreatment && (!salon || (customer.currentTreatment.salon || customer.salon) === salon)).length;
  const workingStaff = state.staff.filter(item => item.status !== "inactive" && (!salon || item.salon === salon)).length;
  const activeAssignments = state.assignments.filter(item => item.status !== "cancelled" && today >= item.startDate && today <= item.endDate && (!salon || item.to === salon)).length;
  const staff = dashboardStaffRows(month, salon).slice(0, 6).map(item => ({ ...item, load: Math.min(98, Math.round(item.visits / Math.max(snapshot.visits, 1) * 720)) }));
  return `
    <div class="dashboard-kpi-grid dashboard-purpose-kpis">
      <article class="dashboard-kpi"><span>Өнөөдрийн захиалга</span><strong>${bookings}</strong><small>${bookingStatus[1].value} хүлээгдэж буй</small></article>
      <article class="dashboard-kpi"><span>Одоо үйлчлүүлж байгаа</span><strong>${activeTreatments}</strong><small>Нийт салон, өрөөнд</small></article>
      <article class="dashboard-kpi"><span>Ажиллаж байгаа ажилтан</span><strong>${workingStaff}</strong><small>${activeAssignments} түр томилгоотой</small></article>
      <article class="dashboard-kpi"><span>Өнөөдрийн орлого</span><strong>${money(Math.round(snapshot.revenue / 26))}</strong><small>${scope}</small></article>
      <article class="dashboard-kpi"><span>Дутуу төлбөр</span><strong class="dashboard-kpi-alert">${money(Math.round(snapshot.outstanding / 5))}</strong><small>Өнөөдөр үүссэн</small></article>
      <article class="dashboard-kpi"><span>Цагийн дүүргэлт</span><strong>${snapshot.occupancy}%</strong><small>Оргил цаг 15:00–18:00</small></article>
    </div>
    <div class="dashboard-grid dashboard-purpose-grid">
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Захиалгын төлөв</h3><p>Өнөөдөр • ${scope}</p></div><strong>${bookings} захиалга</strong></div>
        ${dashboardDonutMarkup(bookingStatus, bookings, "value")}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Цагийн ачаалал</h3><p>Суудал, өрөөний дүүргэлт</p></div></div>
        ${dashboardVerticalBars(slots, "value", value => `${value}%`)}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Анхаарах ажил</h3><p>Өнөөдөр шийдвэрлэх зүйлс</p></div></div>
        <div class="dashboard-action-list">
          <div><i class="warning"></i><span>Баталгаажаагүй үйлчилгээ</span><strong>0</strong></div>
          <div><i class="danger"></i><span>Дутуу төлбөртэй хэрэглэгч</span><strong>${state.customers.filter(item => item.unpaid).length}</strong></div>
          <div><i></i><span>Дуусах дөхсөн курс</span><strong>0</strong></div>
          <div><i class="warning"></i><span>Барааны үлдэгдэл бага</span><strong>0</strong></div>
          <div><i></i><span>Кассын хаалт хүлээгдэж буй</span><strong>0</strong></div>
        </div>
      </section>
    </div>
    <section class="panel dashboard-card dashboard-table-card">
      <div class="dashboard-card-head"><div><h3>Ажилтны өнөөдрийн ачаалал</h3><p>Үйлчилгээ хийсэн салбараар тооцсон</p></div></div>
      <div class="dashboard-progress-list dashboard-staff-load-list">${dashboardProgressRows(staff.map(item => ({ name: `${item.name} • ${item.visits} оролт`, value: item.load })), "value", value => `${value}%`)}</div>
    </section>`;
}

function dashboardCashflowHtml(month, salon, snapshot) {
  const scope = salon || "Нийт салбар";
  const payments = dashboardDemoData.payments.map(item => ({ ...item, amount: Math.round(snapshot.revenue * item.share / 100) }));
  const sources = [
    { name: "Үйлчилгээ", amount: Math.round(snapshot.revenue * .57), share: 57, color: "#60bf63" },
    { name: "Курс", amount: Math.round(snapshot.revenue * .24), share: 24, color: "#91cf86" },
    { name: "Бараа", amount: Math.round(snapshot.revenue * .19), share: 19, color: "#c9dfbd" }
  ];
  const receivables = [
    { name: "0–7 хоног", amount: Math.round(snapshot.outstanding * .54) },
    { name: "8–30 хоног", amount: Math.round(snapshot.outstanding * .29) },
    { name: "31–60 хоног", amount: Math.round(snapshot.outstanding * .12) },
    { name: "60+ хоног", amount: Math.round(snapshot.outstanding * .05) }
  ];
  return `
    <div class="dashboard-kpi-grid dashboard-purpose-kpis">
      <article class="dashboard-kpi"><span>Нийт орлого</span><strong>${money(snapshot.revenue)}</strong><small>${month.label}</small></article>
      <article class="dashboard-kpi"><span>Үйлчилгээний орлого</span><strong>${money(sources[0].amount + sources[1].amount)}</strong><small>Нэг удаа болон курс</small></article>
      <article class="dashboard-kpi"><span>Барааны борлуулалт</span><strong>${money(snapshot.products)}</strong><small>${sources[2].share}% нийт орлогод</small></article>
      <article class="dashboard-kpi"><span>Дутуу төлбөр</span><strong class="dashboard-kpi-alert">${money(snapshot.outstanding)}</strong><small>${receivables[3].amount ? money(receivables[3].amount) : "0₮"} хугацаа хэтэрсэн</small></article>
      <article class="dashboard-kpi"><span>Бонус ашиглалт</span><strong>${money(Math.round(snapshot.revenue * .064))}</strong><small>Бонус бодогдохгүй төлбөр</small></article>
      <article class="dashboard-kpi"><span>Ваучер / бэлгийн карт</span><strong>${money(Math.round(snapshot.revenue * .08))}</strong><small>${formatNumber(Math.round(snapshot.payments * .08))} гүйлгээ</small></article>
    </div>
    <div class="dashboard-grid dashboard-purpose-grid">
      <section class="panel dashboard-card dashboard-card-wide">
        <div class="dashboard-card-head"><div><h3>Орлогын өөрчлөлт</h3><p>${scope} • сүүлийн 6 сар</p></div><strong>${dashboardCompactMoney(snapshot.revenue)}</strong></div>
        ${dashboardTrendSvg(month.key, salon)}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Орлогын эх үүсвэр</h3><p>${month.label}</p></div></div>
        ${dashboardDonutMarkup(sources, snapshot.revenue, "amount")}
      </section>
    </div>
    <div class="dashboard-grid">
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Төлбөрийн хэлбэр</h3><p>${formatNumber(snapshot.payments)} гүйлгээ</p></div></div>
        <div class="dashboard-payment-bar">${payments.map(item => `<span style="width:${item.share}%;background:${item.color}"></span>`).join("")}</div>
        <div class="dashboard-payment-list">${payments.map(item => `<div><span><i style="background:${item.color}"></i>${item.name}</span><strong>${money(item.amount)} <small>${item.share}%</small></strong></div>`).join("")}</div>
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Авлагын насжилт</h3><p>${money(snapshot.outstanding)} нийт</p></div></div>
        <div class="dashboard-progress-list">${dashboardProgressRows(receivables.map(item => ({ name: item.name, value: item.amount })), "value", dashboardCompactMoney)}</div>
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Сарын тулгалт</h3><p>Орлого ба кассын хаалт</p></div></div>
        <div class="dashboard-action-list">
          <div><i></i><span>Хаалт хийгдсэн өдөр</span><strong>16/18</strong></div>
          <div><i class="warning"></i><span>Тулгалтын зөрүүтэй</span><strong>2 өдөр</strong></div>
          <div><i></i><span>Буцаалт, цуцлалт</span><strong>${money(Math.round(snapshot.revenue * .009))}</strong></div>
          <div><i></i><span>Ажилтны урамшуулал</span><strong>${money(Math.round(snapshot.revenue * .087))}</strong></div>
        </div>
      </section>
    </div>`;
}

function dashboardSystemHtml(month, salon) {
  const scope = salon || "Нийт систем";
  const actions = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"].map(name => ({ name, value: 0 }));
  const activeCustomers = state.customers.filter(item => !item.deleted && !item.deletedAt);
  const deletedCustomers = state.customers.filter(item => item.deleted || item.deletedAt).length;
  const phoneCounts = activeCustomers.reduce((result, item) => {
    if (item.phone) result[item.phone] = (result[item.phone] || 0) + 1;
    return result;
  }, {});
  const duplicatePhones = Object.values(phoneCounts).filter(value => value > 1).length;
  const todayActions = state.audit.filter(item => String(item.createdAt || "").startsWith(todayText())).length;
  const backupCount = databaseBackups().length;
  const dataSizes = [
    { name: "Оношилгооны зураг", value: 0 },
    { name: "Үйлчилгээний түүх", value: activeCustomers.reduce((sum, item) => sum + (item.serviceHistory || []).length, 0) },
    { name: "Хэрэглэгч ба групп", value: activeCustomers.length + state.customerGroups.length },
    { name: "Төлбөр, касс", value: kassRevenueSourceRows().length },
    { name: "Цаг захиалга", value: state.bookings.length }
  ];
  return `
    <div class="dashboard-kpi-grid dashboard-purpose-kpis">
      <article class="dashboard-kpi"><span>Өнөөдрийн үйлдэл</span><strong>${formatNumber(todayActions)}</strong><small>${scope}</small></article>
      <article class="dashboard-kpi"><span>Зассан бүртгэл</span><strong>0</strong><small>Сүүлийн 24 цаг</small></article>
      <article class="dashboard-kpi"><span>Устгасан бүртгэл</span><strong>${deletedCustomers}</strong><small>Бүр мөсөн устгасан 0</small></article>
      <article class="dashboard-kpi"><span>Давхардсан хэрэглэгч</span><strong class="dashboard-kpi-alert">${duplicatePhones}</strong><small>Нэгтгэх шаардлагатай</small></article>
      <article class="dashboard-kpi"><span>Сүүлийн backup</span><strong class="dashboard-kpi-text">${backupCount ? "Backup байна" : "Мэдээлэлгүй"}</strong><small>${backupCount} хадгалсан хувилбар</small></article>
      <article class="dashboard-kpi"><span>Хадгалалтын хэмжээ</span><strong>0 GB</strong><small>Зураг 0 GB</small></article>
    </div>
    <div class="dashboard-grid dashboard-purpose-grid">
      <section class="panel dashboard-card dashboard-card-wide">
        <div class="dashboard-card-head"><div><h3>Системийн үйлдэл</h3><p>Сүүлийн 7 хоног • ${scope}</p></div></div>
        ${dashboardVerticalBars(actions, "value", formatNumber)}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Өгөгдлийн хэмжээ</h3><p>Ангилал тус бүрийн бүртгэл</p></div></div>
        <div class="dashboard-progress-list">${dashboardProgressRows(dataSizes, "value", formatNumber)}</div>
      </section>
    </div>
    <div class="dashboard-grid">
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Анхааруулга</h3><p>Шалгах шаардлагатай мэдээлэл</p></div></div>
        <div class="dashboard-action-list">
          <div><i class="danger"></i><span>Давхардсан утас</span><strong>${duplicatePhones}</strong></div>
          <div><i class="warning"></i><span>Зураггүй оношилгоо</span><strong>0</strong></div>
          <div><i class="warning"></i><span>Ажилтангүй үйлчилгээ</span><strong>0</strong></div>
          <div><i></i><span>Тохиргоогүй тусгай үнэ</span><strong>0</strong></div>
        </div>
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Backup төлөв</h3><p>Өгөгдлийн аюулгүй байдал</p></div></div>
        <div class="dashboard-action-list">
          <div><i></i><span>Өдөр тутмын backup</span><strong>Тохируулаагүй</strong></div>
          <div><i></i><span>Сүүлийн бүрэн backup</span><strong>—</strong></div>
          <div><i></i><span>Хадгалж буй хувилбар</span><strong>${backupCount}</strong></div>
          <div><i></i><span>Дараагийн backup</span><strong>—</strong></div>
        </div>
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Системийн төлөв</h3><p>Үндсэн үйлчилгээ</p></div></div>
        <div class="dashboard-action-list">
          <div><i></i><span>Өгөгдлийн сан</span><strong>Холбоогүй</strong></div>
          <div><i></i><span>Зураг хадгалалт</span><strong>0%</strong></div>
          <div><i></i><span>Камерын бүртгэл</span><strong>Бэлэн</strong></div>
          <div><i class="warning"></i><span>Сүүлийн алдаа</span><strong>0</strong></div>
        </div>
      </section>
    </div>`;
}

function renderDashboard() {
  const content = document.getElementById("dashboardContent");
  const modeSelect = document.getElementById("dashboardViewMode");
  const monthSelect = document.getElementById("dashboardMonth");
  const salonSelect = document.getElementById("dashboardSalon");
  if (!content || !modeSelect || !monthSelect || !salonSelect) return;

  const previousMode = modeSelect.value;
  const allowedModes = dashboardAllowedViewModes();
  modeSelect.innerHTML = allowedModes.map(item => `<option value="${item.value}">${item.label}</option>`).join("");
  modeSelect.value = allowedModes.some(item => item.value === previousMode) ? previousMode : allowedModes[0]?.value || "overview";

  const previousMonth = monthSelect.value || dashboardDemoData.months.at(-1).key;
  monthSelect.innerHTML = dashboardDemoData.months.slice().reverse().map(month => `<option value="${month.key}">${month.label}</option>`).join("");
  monthSelect.value = dashboardDemoData.months.some(month => month.key === previousMonth) ? previousMonth : dashboardDemoData.months.at(-1).key;

  const previousSalon = dashboardSelectedSalon();
  const allowedSalons = isSalonAccount() ? state.salons.filter(item => item.name === activeAccount.salon) : state.salons;
  salonSelect.innerHTML = `${isSalonAccount() ? "" : `<option value="">Нийт салбар</option>`}${allowedSalons.map(salon => `<option value="${htmlSafe(salon.name)}">${htmlSafe(salon.name)}</option>`).join("")}`;
  salonSelect.value = isSalonAccount() ? activeAccount.salon : (allowedSalons.some(item => item.name === previousSalon) ? previousSalon : "");
  salonSelect.disabled = isSalonAccount();
  syncNativeSelectProxy(modeSelect);
  syncNativeSelectProxy(monthSelect);
  syncNativeSelectProxy(salonSelect);

  const month = dashboardSelectedMonth();
  const salon = dashboardSelectedSalon();
  const snapshot = dashboardSnapshot(month, salon);
  const previousIndex = dashboardDemoData.months.findIndex(item => item.key === month.key) - 1;
  const previous = previousIndex >= 0 ? dashboardSnapshot(dashboardDemoData.months[previousIndex], salon) : snapshot;
  const growth = previous.revenue ? ((snapshot.revenue - previous.revenue) / previous.revenue * 100) : 0;
  const scopeText = salon || "Нийт салбар";
  document.getElementById("dashboardScopeNote").textContent = isSalonAccount() ? `${activeAccount.salon} • зөвхөн таны салбарын мэдээлэл` : `${scopeText} • бүртгэлийн өгөгдөл`;

  const viewMode = dashboardSelectedViewMode();
  if (viewMode === "operations") {
    content.innerHTML = dashboardOperationsHtml(month, salon, snapshot);
    return;
  }
  if (viewMode === "cashflow") {
    content.innerHTML = dashboardCashflowHtml(month, salon, snapshot);
    return;
  }
  if (viewMode === "system") {
    content.innerHTML = dashboardSystemHtml(month, salon);
    return;
  }

  const branchRows = dashboardRowsForBranches(month);
  const serviceRows = dashboardDemoData.services.map(item => ({ ...item, count: Math.round(snapshot.visits * item.share / 100) }));
  const paymentRows = dashboardDemoData.payments.map(item => ({ ...item, amount: Math.round(snapshot.revenue * item.share / 100) }));
  const monthIndex = dashboardDemoData.months.findIndex(item => item.key === month.key);
  const trendMonths = dashboardDemoData.months.slice(Math.max(0, monthIndex - 5), monthIndex + 1).map(item => ({ ...item, value: dashboardSnapshot(item, salon).revenue }));
  const demographics = dashboardCustomerDemographics();
  const activeCustomers = state.customers.filter(item => !item.deleted && !item.deletedAt);
  const customerCount = activeCustomers.length;
  const activeGroupCount = state.customerGroups.filter(group => (group.members || []).length > 0).length;
  const activeCourseCount = activeCustomers.filter(customer => customer.activeCourse || (customer.serviceHistory || []).some(item => item.kind === "course" && item.completed !== true)).length;
  const bonusBalance = activeCustomers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);
  const staffRows = dashboardStaffRows(month, salon);
  const topScale = salon ? dashboardBranch(salon).share : 1;
  const topServices = dashboardDemoData.topServices.map(([name, count, revenue]) => ({ name, count: Math.round(count * topScale), revenue: Math.round(revenue * topScale) }));

  const revenueVisual = dashboardChartModes.revenue === "bar"
    ? dashboardVerticalBars(trendMonths, "value", dashboardCompactMoney)
    : dashboardChartModes.revenue === "table"
      ? dashboardSimpleTable(["Сар", "Орлого"], trendMonths.map(item => [item.label, `<strong>${money(item.value)}</strong>`]))
      : dashboardTrendSvg(month.key, salon);
  const branchVisual = dashboardChartModes.branch === "table"
    ? dashboardSimpleTable(["Салбар", "Орлого", "Дүүргэлт"], branchRows.map(item => [htmlSafe(item.name), `<strong>${money(item.revenue)}</strong>`, `${item.occupancy}%`]))
    : `<div class="dashboard-progress-list">${dashboardProgressRows(branchRows, "revenue", dashboardCompactMoney)}</div><div class="dashboard-mini-stats"><span>Дүүргэлт <strong>${snapshot.occupancy}%</strong></span><span>Дуусгалт <strong>${snapshot.completion}%</strong></span></div>`;
  const serviceVisual = dashboardChartModes.services === "bar"
    ? `<div class="dashboard-progress-list">${dashboardProgressRows(serviceRows, "count", formatNumber)}</div>`
    : dashboardChartModes.services === "table"
      ? dashboardSimpleTable(["Төрөл", "Оролт", "Хувь"], serviceRows.map(item => [htmlSafe(item.name), formatNumber(item.count), `${item.share}%`]))
      : dashboardDonutMarkup(serviceRows, snapshot.visits, "share");
  const paymentVisual = dashboardChartModes.payments === "donut"
    ? dashboardDonutMarkup(paymentRows, snapshot.payments, "amount")
    : dashboardChartModes.payments === "table"
      ? dashboardSimpleTable(["Төлбөр", "Дүн", "Хувь"], paymentRows.map(item => [item.name, `<strong>${money(item.amount)}</strong>`, `${item.share}%`]))
      : `<div class="dashboard-payment-bar">${paymentRows.map(item => `<span style="width:${item.share}%;background:${item.color}" title="${item.name}: ${money(item.amount)}"></span>`).join("")}</div><div class="dashboard-payment-list">${paymentRows.map(item => `<div><span><i style="background:${item.color}"></i>${item.name}</span><strong>${money(item.amount)} <small>${item.share}%</small></strong></div>`).join("")}</div>`;
  const staffVisual = dashboardChartModes.staff === "table"
    ? dashboardSimpleTable(["Ажилтан", "Үндсэн салбар", "Оролт", "Орлого", "Нийт урамшуулал"], staffRows.map(item => [htmlSafe(item.name), htmlSafe(item.homeSalon), formatNumber(item.visits), `<strong>${money(item.revenue)}</strong>`, money(item.totalReward)]))
    : dashboardVerticalBars(staffRows, "revenue", dashboardCompactMoney);

  content.innerHTML = `
    <div class="dashboard-kpi-grid">
      <article class="dashboard-kpi"><span>Нийт орлого</span><strong>${money(snapshot.revenue)}</strong><small class="${growth >= 0 ? "positive" : "negative"}">${growth >= 0 ? "↑" : "↓"} ${Math.abs(growth).toFixed(1)}% өмнөх сараас</small></article>
      <article class="dashboard-kpi"><span>Төлбөрийн тоо</span><strong>${formatNumber(snapshot.payments)}</strong><small>Дундаж ${money(Math.round(snapshot.revenue / Math.max(snapshot.payments, 1)))}</small></article>
      <article class="dashboard-kpi"><span>Үйлчилгээний оролт</span><strong>${formatNumber(snapshot.visits)}</strong><small>${snapshot.completion}% амжилттай дууссан</small></article>
      <article class="dashboard-kpi"><span>Барааны борлуулалт</span><strong>${money(snapshot.products)}</strong><small>Нийт орлогын ${Math.round(snapshot.products / Math.max(snapshot.revenue, 1) * 100)}%</small></article>
      <article class="dashboard-kpi"><span>Дутуу төлбөр</span><strong class="dashboard-kpi-alert">${money(snapshot.outstanding)}</strong><small>Нэхэмжлэх шаардлагатай</small></article>
      <article class="dashboard-kpi customer-kpi"><span>Нийт хэрэглэгч</span><strong>${formatNumber(customerCount)}</strong><small>+${month.newCustomers} шинэ • бүх салбар</small></article>
    </div>

    <div class="dashboard-grid dashboard-grid-top">
      <section class="panel dashboard-card dashboard-card-wide">
        <div class="dashboard-card-head"><div><h3>Орлогын өөрчлөлт</h3><p>${htmlSafe(scopeText)} • сүүлийн 6 сар</p></div><div class="dashboard-card-head-tools"><strong>${dashboardCompactMoney(snapshot.revenue)}</strong>${dashboardChartControls("revenue", ["line", "bar", "table"])}</div></div>
        ${revenueVisual}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>${branchRows.length > 1 ? "Салбарын орлого" : "Салбарын үзүүлэлт"}</h3><p>${month.label}</p></div>${dashboardChartControls("branch", ["bar", "table"])}</div>
        ${branchVisual}
      </section>
    </div>

    <div class="dashboard-grid">
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Үйлчилгээний бүтэц</h3><p>${formatNumber(snapshot.visits)} нийт оролт</p></div>${dashboardChartControls("services", ["donut", "bar", "table"])}</div>
        ${serviceVisual}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Төлбөрийн төрөл</h3><p>${money(snapshot.revenue)} нийт</p></div>${dashboardChartControls("payments", ["bar", "donut", "table"])}</div>
        ${paymentVisual}
      </section>
      <section class="panel dashboard-card">
        <div class="dashboard-card-head"><div><h3>Хэрэглэгч ба бонус</h3><p>Нэгдсэн хэрэглэгчийн мэдээлэл</p></div></div>
        <div class="dashboard-customer-list">
          <div><span>Нийт хэрэглэгч</span><strong>${formatNumber(customerCount)}</strong></div>
          <div><span>Идэвхтэй групп</span><strong>${formatNumber(activeGroupCount)}</strong></div>
          <div><span>Идэвхтэй курс</span><strong>${formatNumber(activeCourseCount)}</strong></div>
          <div><span>Бонус үлдэгдэл</span><strong>${money(bonusBalance)}</strong></div>
          <div><span>2 жил дуусах дөхсөн</span><strong>0</strong></div>
        </div>
      </section>
    </div>

    <section class="panel dashboard-card dashboard-demographic-card">
      <div class="dashboard-card-head"><div><h3>Хэрэглэгчийн бүтэц</h3><p>Бүх салбарын нэгдсэн хэрэглэгчийн мэдээлэл • салбараар шүүгдэхгүй</p></div><strong>${formatNumber(customerCount)} хэрэглэгч</strong></div>
      <div class="dashboard-demographic-grid">
        <article class="dashboard-demographic-block">
          <h4>Хүйс</h4>
          ${dashboardDonutMarkup(demographics.genders, customerCount, "value")}
        </article>
        <article class="dashboard-demographic-block">
          <h4>Насны бүлэг</h4>
          ${dashboardVerticalBars(demographics.ages, "value", formatNumber)}
        </article>
        <article class="dashboard-demographic-block">
          <h4>Амьдардаг дүүрэг</h4>
          <div class="dashboard-progress-list">${dashboardProgressRows(demographics.districts, "value", formatNumber)}</div>
        </article>
      </div>
    </section>

    <section class="panel dashboard-card dashboard-staff-card">
      <div class="dashboard-card-head"><div><h3>Ажилтны гүйцэтгэл</h3><p>${month.label} • ${htmlSafe(scopeText)} • түр томилгооны ажил үйлчилгээ хийсэн салбарт тооцогдоно</p></div>${dashboardChartControls("staff", ["bar", "table"])}</div>
      ${staffVisual}
    </section>

    <section class="panel dashboard-card dashboard-table-card">
      <div class="dashboard-card-head"><div><h3>Эрэлттэй үйлчилгээ, бүтээгдэхүүн</h3><p>${month.label} • ${htmlSafe(scopeText)}</p></div></div>
      <div class="table-wrap dashboard-table-wrap">
        <table class="dashboard-table">
          <thead><tr><th>№</th><th>Үйлчилгээ / бүтээгдэхүүн</th><th class="amount-cell">Тоо</th><th class="amount-cell">Орлого</th><th class="amount-cell">Нийтэд эзлэх</th></tr></thead>
          <tbody>${topServices.length ? topServices.map((item, index) => `<tr><td>${index + 1}</td><td><strong>${htmlSafe(item.name)}</strong></td><td class="amount-cell">${formatNumber(item.count)}</td><td class="amount-cell"><strong>${money(item.revenue)}</strong></td><td class="amount-cell">${Math.round(item.revenue / Math.max(snapshot.revenue, 1) * 100)}%</td></tr>`).join("") : `<tr><td colspan="5" class="empty-cell">Мэдээлэл байхгүй</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function dashboardXmlSafe(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dashboardWorksheet(name, rows) {
  const xmlRows = rows.map(row => `<Row>${row.map(value => {
    const numeric = typeof value === "number";
    return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${dashboardXmlSafe(value)}</Data></Cell>`;
  }).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${dashboardXmlSafe(name)}"><Table>${xmlRows}</Table></Worksheet>`;
}

function exportDashboardExcel() {
  const month = dashboardSelectedMonth();
  const salon = dashboardSelectedSalon();
  const scope = salon || "Нийт салбар";
  const viewMode = dashboardAllowedViewModes().find(item => item.value === dashboardSelectedViewMode())?.label || "Ерөнхий тойм";
  const snapshot = dashboardSnapshot(month, salon);
  const branchRows = dashboardRowsForBranches(month);
  const trendRows = dashboardDemoData.months.map(item => {
    const row = dashboardSnapshot(item, salon);
    return [item.label, row.revenue, row.payments, row.visits, row.products, row.outstanding, row.completion, row.occupancy];
  });
  const serviceRows = dashboardDemoData.services.map(item => [item.name, item.share, Math.round(snapshot.visits * item.share / 100)]);
  const paymentRows = dashboardDemoData.payments.map(item => [item.name, item.share, Math.round(snapshot.revenue * item.share / 100)]);
  const demographics = dashboardCustomerDemographics();
  const customerCount = state.customers.filter(item => !item.deleted && !item.deletedAt).length;
  const staffRows = dashboardStaffRows(month, salon);
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      ${dashboardWorksheet("Нэгдсэн үзүүлэлт", [
        ["Харагдац", viewMode], ["Хугацаа", month.label], ["Хамрах хүрээ", scope], ["Нийт орлого", snapshot.revenue], ["Төлбөрийн тоо", snapshot.payments], ["Үйлчилгээний оролт", snapshot.visits], ["Барааны борлуулалт", snapshot.products], ["Дутуу төлбөр", snapshot.outstanding], ["Дуусгалт %", snapshot.completion], ["Дүүргэлт %", snapshot.occupancy], ["Нийт хэрэглэгч", customerCount], ["Шинэ хэрэглэгч", month.newCustomers]
      ])}
      ${dashboardWorksheet("Сарын өөрчлөлт", [["Сар", "Орлого", "Төлбөр", "Оролт", "Бараа", "Дутуу төлбөр", "Дуусгалт %", "Дүүргэлт %"], ...trendRows])}
      ${dashboardWorksheet("Салбар", [["Салбар", "Орлого", "Төлбөр", "Оролт", "Дутуу төлбөр", "Дуусгалт %", "Дүүргэлт %"], ...branchRows.map(item => [item.name, item.revenue, item.payments, item.visits, item.outstanding, item.completion, item.occupancy])])}
      ${dashboardWorksheet("Үйлчилгээ", [["Төрөл", "Хувь %", "Оролтын тоо"], ...serviceRows])}
      ${dashboardWorksheet("Төлбөр", [["Төрөл", "Хувь %", "Дүн"], ...paymentRows])}
      ${dashboardWorksheet("Хэрэглэгчийн бүтэц", [
        ["Ангилал", "Нэр", "Хэрэглэгчийн тоо", "Хувь %"],
        ...demographics.genders.map(item => ["Хүйс", item.name, item.value, item.share]),
        ...demographics.ages.map(item => ["Нас", item.name, item.value, Math.round(item.value / Math.max(customerCount, 1) * 100)]),
        ...demographics.districts.map(item => ["Дүүрэг", item.name, item.value, Math.round(item.value / Math.max(customerCount, 1) * 100)])
      ])}
      ${dashboardWorksheet("Ажилтны гүйцэтгэл", [["Ажилтан", "Үндсэн салбар", "Ажилласан салбар", "Оролт", "Орлого", "Үйлчилгээний урамшуулал", "Кассын урамшуулал", "Нийт урамшуулал"], ...staffRows.map(item => [item.name, item.homeSalon, item.workedSalon, item.visits, item.revenue, item.serviceReward, item.kassReward, item.totalReward])])}
    </Workbook>`;
  const blob = new Blob(["\ufeff", workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `khalgai-dashboard-${month.key}-${salon ? salon.replace(/\s+/g, "-") : "all"}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Хяналтын самбарын Excel файл бэлтгэгдлээ");
}

function showToast(text = "Амжилттай хадгаллаа") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1900);
}

function openModal(title, subtitle, bodyHtml, afterRender) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalSubtitle").textContent = subtitle;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalBackdrop").classList.add("open");
  document.getElementById("modalBackdrop").setAttribute("aria-hidden", "false");
  if (typeof afterRender === "function") afterRender();
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
  document.getElementById("modalBackdrop").setAttribute("aria-hidden", "true");
  document.querySelector("#modalBackdrop .modal")?.classList.remove("diagnosis-image-modal");
}

function formValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function rerenderAll() {
  renderSalons();
  renderBranches();
  renderSettingsServices();
  renderPricePolicySettings();
  renderDiscountSettings();
  renderGeneralSettings();
  renderKassSchedule();
  renderHumanResources();
  renderHolidaySettings();
  renderAssignments();
  renderCustomers();
  renderKassSchedule();
  renderProfile();
  renderCatalog();
  renderStaff();
  renderBookings();
  renderServices();
  renderVouchers();
  renderGiftCards();
  renderGroupDirectory();
  renderPerformance();
  renderAudit();
  renderHomepageSettings();
  if (systemUsersLoaded) renderSystemUsers();
}

function setView(name) {
  releaseDiagnosisCameraSession();
  const adminViews = ["settingsCatalog", "branches", "settingsResults", "settingsServices", "settingsPricing", "groups", "settingsUsers", "settingsDatabase", "settingsGeneral", "audit"];
  const requestedScheduleSection = name === "settingsHolidays" ? "holidays" : null;
  if (name === "settingsHolidays") name = "settingsSchedule";
  if (retiredViews.has(name)) name = "bookings";
  if (adminViews.includes(name) && !isAdminAccount()) {
    showToast("Админ хэсэгт нэвтрэх эрхгүй байна");
    name = "bookings";
  }
  const previousView = activeView;
  if (previousView !== name) {
    state.customers.forEach(customer => clearCustomerUiState(customer));
    state.customerGroups.forEach(group => {
      group.editingName = false;
      group.directoryExpanded = false;
    });
    resetIncomingViewState(name);
  }
  activeView = name;
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === name));
  document.querySelectorAll(".nav-subitem").forEach(item => item.classList.toggle("active", item.dataset.view === name));
  const isSettingsView = adminViews.includes(name);
  document.getElementById("settingsToggle")?.classList.toggle("active", isSettingsView);
  document.getElementById("settingsSubmenu")?.classList.toggle("open", isSettingsView);
  document.getElementById("settingsToggle")?.setAttribute("aria-expanded", String(isSettingsView));

  const view = document.getElementById(`${name}View`);
  if (view) view.classList.add("active");

  if (name === "settingsServices") renderSettingsServices();
  if (name === "settingsHumanResources") renderHumanResources();
  if (name === "settingsSchedule") setScheduleSection(requestedScheduleSection || "holidays");
  if (name === "settingsPricing") renderPricePolicySettings();
  if (name === "settingsDiscounts") renderDiscountSettings();
  if (name === "settingsGeneral") renderGeneralSettings();
  if (name === "settingsCatalog") {
    activeHomepageSettingsTab = "catalog";
    renderHomepageSettings();
  }
  if (name === "settingsResults") {
    homepageSettings();
    document.getElementById("homepageResultsPanel")?.classList.remove("hidden");
    renderHomepageResults();
    enhanceNativeSelects(["homepageResultPublished"]);
  }
  if (name === "settingsDatabase") renderDatabaseSettings();
  if (name === "settingsUsers") loadSystemUsers();
  if (name === "dashboard") renderDashboard();
  if (name === "kass") renderKassSchedule();
  if (name === "vouchers") renderVouchers();
  if (name === "giftCards") renderGiftCards();
  if (name === "performance") setPerformanceTab("revenue");
  if (name === "groups") renderGroupDirectory();
  if (name === "audit") renderAudit();
  if (name === "profile") renderProfile();
  if (name !== "performance") renderInfoHeader(name);
  document.getElementById("sidebar").classList.remove("open");
  void refreshServerStateForView(name);
}

function resetIncomingViewState(name) {
  closeModal();
  const resetValues = values => Object.entries(values).forEach(([id, value]) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.value = value;
    if (control.tagName === "SELECT") syncNativeSelectProxy(control);
  });

  if (name === "customers") {
    resetValues({ customerSearch: "", customerDistrictFilter: "all", customerKhorooFilter: "", customerTypeFilter: "all", customerWorkFilter: "all" });
    customerSortMode = "date";
    customerPage = 1;
    state.selectedCustomerId = null;
  }
  if (name === "bookings") {
    resetValues({ bookingSearch: "", bookingSalonFilter: isSalonAccount() ? activeAccount.salon : "all", bookingDateFilter: "", bookingStatusFilter: "all" });
    bookingPage = 1;
  }
  if (name === "kass") {
    resetValues({ kassFromFilter: "", kassToFilter: "", kassSalonFilter: "all", kassStaffFilter: "all" });
    kassPage = 1;
    kassEditingId = null;
  }
  if (name === "vouchers") {
    resetValues({ voucherDateFilter: "", voucherCustomerFilter: "", voucherPhoneFilter: "", voucherRoleFilter: "all" });
    voucherPage = 1;
  }
  if (name === "giftCards") {
    resetValues({ giftCardNumberFilter: "", giftCardStatusFilter: "all", giftCardFromFilter: "", giftCardToFilter: "" });
    giftCardPage = 1;
    giftCardEditingId = null;
  }
  if (name === "groups") {
    resetValues({ groupDirectorySearch: "", groupDirectoryStatusFilter: "all" });
  }
  if (name === "audit") {
    resetValues({ auditActionFilter: "all" });
    auditPage = 1;
  }
  if (name === "settingsUsers") {
    resetValues({ systemUserSearch: "", systemUserRoleFilter: "all", systemUserStatusFilter: "all" });
    systemUserEditingId = null;
  }
}

function initials(name) {
  return name.trim().slice(0, 1);
}

function renderSalons() {
  const salonRows = document.getElementById("salonRows");
  if (salonRows) {
    salonRows.innerHTML = state.salons.map(salon => `
      <tr>
        <td><strong>${salon.name}</strong></td>
        <td>${salon.bookings}</td>
        <td>${money(salon.revenue)}</td>
        <td>${salon.staff}</td>
        <td>${badge(salon.status, salon.status.includes("хэрэгтэй") ? "yellow" : "green")}</td>
      </tr>
    `).join("");
  }

  const salonOptions = state.salons.map(s => `<option>${s.name}</option>`).join("");
  const assignSalon = document.getElementById("assignSalon");
  if (assignSalon) assignSalon.innerHTML = salonOptions;
  const bookingSalonMenu = document.querySelector("#bookingSalonDropdown .custom-select-menu");
  if (bookingSalonMenu) {
    const salons = accountSalons();
    const filter = document.getElementById("bookingSalonFilter");
    const selectedValue = isSalonAccount() ? activeAccount.salon : (filter?.value || "all");
    const validValue = selectedValue === "all" || salons.some(salon => salon.name === selectedValue) ? selectedValue : (isSalonAccount() ? activeAccount.salon : "all");
    if (filter) filter.value = validValue;
    bookingSalonMenu.innerHTML = `
      ${isSalonAccount() ? "" : `<button type="button" data-value="all" class="${validValue === "all" ? "active" : ""}">Бүх салбар</button>`}
      ${salons.map(s => `<button type="button" data-value="${s.name}" class="${validValue === s.name ? "active" : ""}">${s.name}</button>`).join("")}
    `;
    const selectedOption = [...bookingSalonMenu.querySelectorAll("button[data-value]")].find(option => option.dataset.value === validValue);
    const triggerText = document.querySelector("#bookingSalonDropdown .custom-select-trigger span");
    if (triggerText && selectedOption) triggerText.textContent = selectedOption.textContent;
    const trigger = document.querySelector("#bookingSalonDropdown .custom-select-trigger");
    if (trigger) trigger.disabled = isSalonAccount();
    document.getElementById("bookingSalonDropdown")?.classList.toggle("locked", isSalonAccount());
  }
}

function salonAddress(salon) {
  return salon.address || "Хаяг оруулаагүй";
}

function salonPhone(salon) {
  return salon.phone || "--------";
}

function branchPublicMedia(branch = {}) {
  const legacy = homepageSettings().salons?.[branch.id] || homepageSettings().salons?.[branch.name] || {};
  return {
    coverImage: branch.coverImage || legacy.coverImage || "",
    gallery: Array.isArray(branch.gallery) ? branch.gallery : (Array.isArray(legacy.gallery) ? legacy.gallery : []),
    mapUrl: branch.mapUrl || legacy.mapUrl || ""
  };
}

function renderBranchMediaDraft() {
  const cover = document.getElementById("branchCoverImage")?.value || "";
  const coverPreview = document.getElementById("branchCoverPreview");
  if (coverPreview) coverPreview.innerHTML = cover ? `<img src="${htmlSafe(cover)}" alt="Cover зураг"><button type="button" data-branch-cover-remove aria-label="Cover зураг арилгах">×</button>` : "";
  const gallery = document.getElementById("branchGalleryList");
  if (gallery) gallery.innerHTML = branchGalleryDraft.map((url, index) => `<span class="branch-gallery-item"><img src="${htmlSafe(url)}" alt="Slider зураг ${index + 1}"><button type="button" data-branch-gallery-remove="${index}" aria-label="Slider зураг хасах">×</button></span>`).join("");
}

function compressBranchImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Зургийг уншиж чадсангүй"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Зургийн файл буруу байна"));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadBranchImage(file, scope = "public") {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPEG, PNG эсвэл WebP зураг сонгоно уу");
  if (file.size > 12 * 1024 * 1024) throw new Error("Нэг зураг 12 MB-аас ихгүй байна");
  const compressed = await compressBranchImage(file);
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) return compressed;
  const blob = await fetch(compressed).then(response => response.blob());
  const form = new FormData();
  form.append("image", blob, `${Date.now()}.webp`);
  form.append("scope", scope === "private" ? "private" : "public");
  const response = await fetch("api/upload.php", {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Requested-With": "KhalgaiSalon" },
    body: form
  });
  const result = await response.json().catch(() => ({ ok: false, message: "Зураг upload хийсэнгүй" }));
  if (!response.ok || !result.ok || !result.url) throw new Error(result.message || "Зураг upload хийсэнгүй");
  return result.url;
}

function renderBranches() {
  ensureBranchStatusField();
  const directoryHeadline = document.getElementById("branchDirectoryHeadline");
  if (directoryHeadline) directoryHeadline.value = homepageSettings().booking.directoryHeadline || "ТА ӨӨРТ ОЙР САЛБАРТАА ЦАГ ЗАХИАЛААРАЙ";
  const rows = document.getElementById("branchRows");
  if (!rows) return;
  rows.innerHTML = state.salons.map(salon => `
    <tr>
      <td>${salon.id}</td>
      <td><strong>${salon.name}</strong></td>
      <td>${salonAddress(salon)}</td>
      <td>${salonPhone(salon)}</td>
      <td><span class="status-text ${salon.active === false ? "pink" : "green"}">${salon.active === false ? "Идэвхгүй" : "Идэвхтэй"}</span></td>
      <td>
        <div class="branch-actions">
          <button class="secondary-btn icon-action branch-edit" data-id="${salon.id}" aria-label="Засах">${editIcon()}</button>
          <button class="danger-btn icon-danger branch-delete" data-id="${salon.id}" aria-label="Устгах">${trashIcon()}</button>
        </div>
      </td>
    </tr>
  `).join("");

  rows.querySelectorAll(".branch-edit").forEach(button => {
    button.addEventListener("click", () => openBranchForm(Number(button.dataset.id)));
  });
  rows.querySelectorAll(".branch-delete").forEach(button => {
    button.addEventListener("click", () => deleteBranch(Number(button.dataset.id)));
  });
}

function openBranchForm(id) {
  const branch = state.salons.find(item => Number(item.id) === Number(id));
  if (branch && !requireEditCode()) return;
  branchEditingId = branch ? branch.id : null;
  ensureBranchStatusField();
  document.getElementById("branchSubmit").textContent = branch ? "Хадгалах" : "Хадгалах";
  document.getElementById("branchName").value = branch?.name || "";
  document.getElementById("branchPhone").value = branch?.phone || "";
  document.getElementById("branchAddress").value = branch?.address || "";
  const media = branchPublicMedia(branch || {});
  document.getElementById("branchMapUrl").value = media.mapUrl;
  document.getElementById("branchCoverImage").value = media.coverImage;
  branchGalleryDraft = [...media.gallery];
  renderBranchMediaDraft();
  document.querySelector(".branch-status-field")?.classList.toggle("hidden", !branch);
  const status = document.getElementById("branchStatus");
  if (status) status.value = branch?.active === false ? "inactive" : "active";
  document.getElementById("branchCancel")?.classList.toggle("hidden", !branch);
  document.getElementById("branchForm")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeBranchForm() {
  branchEditingId = null;
  document.getElementById("branchForm")?.reset();
  branchGalleryDraft = [];
  renderBranchMediaDraft();
  document.querySelector(".branch-status-field")?.classList.add("hidden");
  document.getElementById("branchCancel")?.classList.add("hidden");
}

function closeHolidayForm() {
  holidayEditingId = null;
  document.getElementById("holidayForm")?.reset();
  document.querySelectorAll(".holiday-branch-check").forEach(input => {
    input.checked = false;
  });
  const allCheck = document.getElementById("holidayAllSalons");
  if (allCheck) allCheck.checked = false;
  const dateInput = document.getElementById("holidayDate");
  if (dateInput) dateInput.value = todayText();
}

function isHolidayClosed(salonName, dateText) {
  return state.holidays.some(item => item.salon === salonName && item.date === dateText);
}

function holidayForDate(salonName, dateText) {
  return state.holidays.find(item => item.salon === salonName && item.date === dateText);
}

function isSalonAccount() {
  return activeAccount.role === "salon";
}

function isAdminAccount() {
  return activeAccount.role === "admin";
}

function accountSalons() {
  if (!isSalonAccount()) return state.salons;
  return state.salons.filter(salon => salon.name === activeAccount.salon);
}

function accountStaff({ activeOnly = false } = {}) {
  return state.staff.filter(staff =>
    (!activeOnly || staff.status !== "inactive") &&
    (!isSalonAccount() || staff.salon === activeAccount.salon)
  );
}

function canAccessSalon(salonName = "") {
  return !isSalonAccount() || salonName === activeAccount.salon;
}

function accountRoleLabel(role) {
  return ({ admin: "Админ", manager: "Менежер", salon: "Салбарын эрх" })[role] || "Хэрэглэгч";
}

function applyActiveAccount(account = {}) {
  activeAccount = {
    id: Number(account.id || 0),
    username: String(account.username || ""),
    displayName: String(account.displayName || account.display_name || account.username || "Хэрэглэгч"),
    role: ["admin", "manager", "salon"].includes(account.role) ? account.role : "salon",
    salon: String(account.salon || account.salon_name || "")
  };
  if (activeAccount.role === "salon" && !activeAccount.salon) activeAccount.salon = state.salons[0]?.name || "";
  const avatar = document.getElementById("sidebarUserAvatar");
  const name = document.getElementById("sidebarUserName");
  const scope = document.getElementById("sidebarUserScope");
  if (avatar) avatar.textContent = initials(activeAccount.displayName || activeAccount.username || "Х");
  if (name) name.textContent = activeAccount.displayName || accountRoleLabel(activeAccount.role);
  if (scope) scope.textContent = activeAccount.role === "salon" ? activeAccount.salon : `${accountRoleLabel(activeAccount.role)} • Бүх салбар`;
  document.querySelectorAll("[data-admin-only]").forEach(item => item.classList.toggle("hidden", !isAdminAccount()));
  ["kassRevenueSalon", "performanceSalon", "scheduleSalon"].forEach(id => {
    const field = document.getElementById(id);
    if (field) delete field.dataset.ready;
  });
  if (!isAdminAccount() && ["settingsCatalog", "branches", "settingsResults", "settingsServices", "settingsPricing", "groups", "settingsUsers", "settingsDatabase", "settingsGeneral", "audit"].includes(activeView)) activeView = "bookings";
}

function systemUserRoleLabel(role) {
  return accountRoleLabel(role);
}

function formatSystemUserDate(value) {
  if (!value) return "—";
  return String(value).replace("T", " ").slice(0, 16);
}

function updateSystemUserSalonField() {
  const role = document.getElementById("systemUserRole")?.value || "manager";
  document.getElementById("systemUserSalonField")?.classList.toggle("hidden", role !== "salon");
}

function populateSystemUserSalons(selected = "") {
  const select = document.getElementById("systemUserSalon");
  if (!select) return;
  const preferred = selected || select.value || state.salons.find(item => item.active !== false)?.name || state.salons[0]?.name || "";
  select.innerHTML = state.salons
    .filter(item => item.active !== false)
    .map(item => `<option value="${htmlSafe(item.name)}">${htmlSafe(item.name)}</option>`)
    .join("");
  if (Array.from(select.options).some(option => option.value === preferred)) select.value = preferred;
}

function resetSystemUserForm() {
  systemUserEditingId = null;
  systemUserMigratingLegacy = false;
  const form = document.getElementById("systemUserForm");
  if (!form) return;
  form.reset();
  document.getElementById("systemUserRole").value = "manager";
  document.getElementById("systemUserActive").value = "true";
  document.getElementById("systemUsername").readOnly = false;
  document.getElementById("systemUserRole").disabled = false;
  document.getElementById("systemUserActive").disabled = false;
  document.getElementById("systemUserPassword").required = true;
  document.getElementById("systemUserSubmit").textContent = "Хадгалах";
  document.getElementById("systemUserCancel").classList.add("hidden");
  populateSystemUserSalons();
  updateSystemUserSalonField();
  enhanceNativeSelects(["systemUserRole", "systemUserSalon", "systemUserActive"]);
}

function renderSystemUsers() {
  if (!isAdminAccount()) return;
  populateSystemUserSalons();
  const query = String(document.getElementById("systemUserSearch")?.value || "").trim().toLocaleLowerCase("mn-MN");
  const role = document.getElementById("systemUserRoleFilter")?.value || "";
  const status = document.getElementById("systemUserStatusFilter")?.value || "";
  const filtered = systemUsers.filter(user => {
    const matchesQuery = !query || `${user.displayName} ${user.username} ${user.salon || ""}`.toLocaleLowerCase("mn-MN").includes(query);
    const matchesRole = !role || user.role === role;
    const matchesStatus = !status || (status === "active" ? user.active : !user.active);
    return matchesQuery && matchesRole && matchesStatus;
  });
  const rows = document.getElementById("systemUserRows");
  if (rows) {
    rows.innerHTML = filtered.map(user => {
      const editingSelf = Number(user.id) === Number(activeAccount.id);
      const legacy = Boolean(user.legacy);
      return `<tr>
        <td><strong>${htmlSafe(user.displayName || user.username)}</strong>${legacy ? "<small>Одоогийн үндсэн нэвтрэлт</small>" : ""}</td>
        <td>${htmlSafe(user.username)}</td>
        <td><span class="user-role-label">${systemUserRoleLabel(user.role)}</span></td>
        <td>${user.role === "salon" ? htmlSafe(user.salon || "—") : "Бүх салбар"}</td>
        <td><span class="user-status-label ${user.active ? "active" : "inactive"}">${user.active ? "Идэвхтэй" : "Идэвхгүй"}</span></td>
        <td>${formatSystemUserDate(user.lastLoginAt)}</td>
        <td><div class="user-access-actions">
          <button class="secondary-btn" type="button" data-system-user-edit="${user.id}">Засах</button>
          <button class="${user.active ? "danger-btn" : "secondary-btn"}" type="button" data-system-user-toggle="${user.id}" ${legacy || editingSelf ? "disabled" : ""}>${user.active ? "Идэвхгүй" : "Идэвхжүүлэх"}</button>
        </div></td>
      </tr>`;
    }).join("");
  }
  document.getElementById("systemUserEmpty")?.classList.toggle("hidden", filtered.length !== 0);
  enhanceNativeSelects(["systemUserRole", "systemUserSalon", "systemUserActive", "systemUserRoleFilter", "systemUserStatusFilter"]);
  updateSystemUserSalonField();
}

async function loadSystemUsers(force = false) {
  if (!isAdminAccount() || (systemUsersLoaded && !force)) {
    renderSystemUsers();
    return;
  }
  try {
    const result = await serverApi("users.php");
    systemUsers = Array.isArray(result.users) ? result.users : [];
    systemUsersLoaded = true;
    renderSystemUsers();
    if (activeView === "settingsUsers") renderInfoHeader("settingsUsers");
  } catch (error) {
    if (error.status === 401) {
      showServerLogin(error.message);
      return;
    }
    showToast(error.message || "Хэрэглэгчийн жагсаалт ачаалсангүй");
  }
}

function editSystemUser(id) {
  const user = systemUsers.find(item => Number(item.id) === Number(id));
  if (!user) return;
  systemUserMigratingLegacy = Boolean(user.legacy);
  systemUserEditingId = systemUserMigratingLegacy ? null : Number(user.id);
  document.getElementById("systemUserDisplayName").value = user.displayName || "";
  document.getElementById("systemUsername").value = user.username || "";
  document.getElementById("systemUserPassword").value = "";
  document.getElementById("systemUserPassword").required = systemUserMigratingLegacy;
  document.getElementById("systemUserRole").value = user.role || "salon";
  populateSystemUserSalons(user.salon || "");
  document.getElementById("systemUserActive").value = user.active ? "true" : "false";
  document.getElementById("systemUsername").readOnly = systemUserMigratingLegacy;
  document.getElementById("systemUserRole").disabled = systemUserMigratingLegacy;
  document.getElementById("systemUserActive").disabled = systemUserMigratingLegacy;
  document.getElementById("systemUserSubmit").textContent = "Шинэчлэх";
  document.getElementById("systemUserCancel").classList.remove("hidden");
  enhanceNativeSelects(["systemUserRole", "systemUserSalon", "systemUserActive"]);
  updateSystemUserSalonField();
  document.getElementById("systemUserDisplayName")?.focus();
}

async function saveSystemUser(event) {
  event.preventDefault();
  const displayName = formValue("systemUserDisplayName");
  const username = formValue("systemUsername").toLowerCase();
  const password = document.getElementById("systemUserPassword")?.value || "";
  const role = formValue("systemUserRole");
  const salon = role === "salon" ? formValue("systemUserSalon") : "";
  const active = formValue("systemUserActive") === "true";
  const wasEditing = Boolean(systemUserEditingId) || systemUserMigratingLegacy;
  if (!displayName || !username) return showToast("Нэр болон нэвтрэх нэрийг оруулна уу");
  if (!systemUserEditingId && password.length < 8) return showToast("Нууц үг хамгийн багадаа 8 тэмдэгт байна");
  if (systemUserEditingId && password && password.length < 8) return showToast("Нууц үг хамгийн багадаа 8 тэмдэгт байна");
  if (role === "salon" && !salon) return showToast("Салбар сонгоно уу");
  const button = document.getElementById("systemUserSubmit");
  button.disabled = true;
  try {
    const result = await serverApi("users.php", {
      method: systemUserEditingId ? "PUT" : "POST",
      body: JSON.stringify({ id: systemUserEditingId, displayName, username, password, role, salon, active, migrateLegacy: systemUserMigratingLegacy })
    });
    if (systemUserMigratingLegacy && result.user) applyActiveAccount(result.user);
    state.audit.unshift({
      title: wasEditing ? "user_updated" : "user_created",
      meta: `${activeAccount.displayName || activeAccount.username} • ${displayName} • ${systemUserRoleLabel(role)}`
    });
    saveState();
    resetSystemUserForm();
    await loadSystemUsers(true);
    renderAudit();
    showToast(wasEditing ? "Хэрэглэгч шинэчлэгдлээ" : "Хэрэглэгч нэмэгдлээ");
  } catch (error) {
    showToast(error.message || "Хэрэглэгч хадгалсангүй");
  } finally {
    button.disabled = false;
  }
}

async function toggleSystemUser(id) {
  const user = systemUsers.find(item => Number(item.id) === Number(id));
  if (!user || user.legacy || Number(user.id) === Number(activeAccount.id)) return;
  try {
    await serverApi("users.php", {
      method: "PUT",
      body: JSON.stringify({
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        password: "",
        role: user.role,
        salon: user.salon || "",
        active: !user.active
      })
    });
    state.audit.unshift({ title: "user_status_changed", meta: `${activeAccount.displayName || activeAccount.username} • ${user.displayName} • ${user.active ? "Идэвхгүй" : "Идэвхтэй"}` });
    saveState();
    await loadSystemUsers(true);
    renderAudit();
    showToast(user.active ? "Хэрэглэгч идэвхгүй боллоо" : "Хэрэглэгч идэвхжлээ");
  } catch (error) {
    showToast(error.message || "Хэрэглэгчийн төлөв өөрчлөгдсөнгүй");
  }
}

function holidaySelectableSalons() {
  if (!isSalonAccount()) return state.salons;
  return state.salons.filter(salon => salon.name === activeAccount.salon);
}

function renderHolidaySettings() {
  const salonChecks = document.getElementById("holidaySalonChecks");
  const dateInput = document.getElementById("holidayDate");
  const list = document.getElementById("holidayList");
  if (salonChecks) {
    const selectableSalons = holidaySelectableSalons();
    const checkedValues = isSalonAccount() ? selectableSalons.map(salon => salon.name) : selectedHolidaySalons();
    salonChecks.innerHTML = `
      <div class="multi-select" id="holidaySalonSelect">
        <button class="multi-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span>Салбар сонгох</span>
          <strong class="multi-count">0</strong>
        </button>
        <div class="multi-select-menu" role="listbox">
          ${!isSalonAccount() ? `<label class="holiday-check"><input type="checkbox" id="holidayAllSalons"> Бүх салбар</label>` : ""}
          ${selectableSalons.map(salon => `
            <label class="holiday-check"><input type="checkbox" class="holiday-branch-check" value="${salon.name}" ${checkedValues.includes(salon.name) ? "checked" : ""} ${isSalonAccount() ? "disabled" : ""}> ${salon.name}</label>
          `).join("")}
        </div>
      </div>
    `;
    bindHolidayChecks();
  }
  if (dateInput) {
    dateInput.min = todayText();
    if (!dateInput.value) dateInput.value = todayText();
  }
  if (!list) return;
  const holidays = state.holidays
    .filter(holiday => canAccessSalon(holiday.salon))
    .slice()
    .sort((a, b) => `${a.date}${a.salon}`.localeCompare(`${b.date}${b.salon}`));
  list.innerHTML = holidays.map(holiday => `
    <div class="holiday-item">
      <div>
        <strong>${holiday.salon}</strong>
        <span>${dateWithWeekday(holiday.date)} · ${holiday.name}${holiday.note ? ` · ${holiday.note}` : ""}</span>
      </div>
      <div class="holiday-actions">
        <button class="secondary-btn icon-action holiday-edit" data-id="${holiday.id}" type="button" aria-label="Засах">${editIcon()}</button>
        <button class="danger-btn icon-danger holiday-delete" data-id="${holiday.id}" type="button" aria-label="Устгах">${trashIcon()}</button>
      </div>
    </div>
  `).join("") || `<div class="holiday-item"><div><strong>Амралтын өдөр бүртгэгдээгүй</strong><span>Шинээр амралтын өдөр нэмнэ үү</span></div></div>`;

  list.querySelectorAll(".holiday-edit").forEach(button => {
    button.addEventListener("click", () => editHoliday(Number(button.dataset.id)));
  });
  list.querySelectorAll(".holiday-delete").forEach(button => {
    button.addEventListener("click", () => deleteHoliday(Number(button.dataset.id)));
  });
}

function editHoliday(id) {
  const holiday = state.holidays.find(item => Number(item.id) === Number(id));
  if (!holiday || !canAccessSalon(holiday.salon)) return showToast("Өөр салбарын амралтын өдрийг засах эрхгүй");
  holidayEditingId = holiday.id;
  const dateInput = document.getElementById("holidayDate");
  const nameInput = document.getElementById("holidayName");
  if (dateInput) dateInput.value = holiday.date;
  if (nameInput) nameInput.value = holiday.name || "";
  renderHolidaySettings();
  document.querySelectorAll(".holiday-branch-check").forEach(input => {
    input.checked = input.value === holiday.salon;
  });
  updateHolidaySelectSummary();
  document.getElementById("holidayForm")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function selectedHolidaySalons() {
  return Array.from(document.querySelectorAll(".holiday-branch-check:checked")).map(input => input.value);
}

function updateHolidaySelectSummary() {
  const dropdown = document.getElementById("holidaySalonSelect");
  if (!dropdown) return;
  const selected = selectedHolidaySalons();
  const triggerText = dropdown.querySelector(".multi-select-trigger span");
  const count = dropdown.querySelector(".multi-count");
  dropdown.classList.toggle("has-value", selected.length > 0);
  if (count) count.textContent = selected.length;
  if (!triggerText) return;
  if (!selected.length) {
    triggerText.textContent = "Салбар сонгох";
  } else if (selected.length === 1) {
    triggerText.textContent = selected[0];
  } else if (selected.length === holidaySelectableSalons().length) {
    triggerText.textContent = "Бүх салбар";
  } else {
    triggerText.textContent = selected.join(", ");
  }
}

function bindHolidayChecks() {
  const dropdown = document.getElementById("holidaySalonSelect");
  const trigger = dropdown?.querySelector(".multi-select-trigger");
  const allCheck = document.getElementById("holidayAllSalons");
  const branchChecks = Array.from(document.querySelectorAll(".holiday-branch-check"));
  trigger?.addEventListener("click", () => {
    const isOpen = dropdown.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", event => {
    if (!dropdown || dropdown.contains(event.target)) return;
    dropdown.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  });
  if (allCheck) {
    allCheck.checked = branchChecks.length > 0 && branchChecks.every(input => input.checked);
    allCheck.addEventListener("change", () => {
      branchChecks.forEach(input => {
        input.checked = allCheck.checked;
      });
      updateHolidaySelectSummary();
    });
  }
  branchChecks.forEach(input => {
    input.addEventListener("change", () => {
      if (allCheck) allCheck.checked = branchChecks.length > 0 && branchChecks.every(item => item.checked);
      updateHolidaySelectSummary();
    });
  });
  updateHolidaySelectSummary();
}

function saveHoliday(event) {
  event.preventDefault();
  const selectedSalons = selectedHolidaySalons();
  const date = formValue("holidayDate");
  const name = formValue("holidayName");
  const note = "";
  if (!selectedSalons.length) {
    showToast("Салбар сонгоно уу");
    return;
  }
  if (selectedSalons.some(salon => !canAccessSalon(salon))) {
    showToast("Зөвхөн өөрийн салбарын амралтын өдрийг тохируулна");
    return;
  }
  if (!date || !name) return;
  if (isPastDate(date)) {
    showToast("Өнгөрсөн өдөр амралт нэмэх боломжгүй");
    return;
  }
  if (holidayEditingId) {
    state.holidays = state.holidays.filter(item => Number(item.id) !== Number(holidayEditingId));
  }
  selectedSalons.forEach(salon => {
    const existing = holidayForDate(salon, date);
    if (existing) {
      existing.name = name;
      existing.note = note;
    } else {
      state.holidays.unshift({ id: nextId(state.holidays), salon, date, name, note });
    }
  });
  state.audit.unshift({ title: "holiday_saved", meta: `Менежер • ${selectedSalons.join(", ")} • ${date} • ${name}` });
  saveState();
  closeHolidayForm();
  renderHolidaySettings();
  renderBookings();
  renderInfoHeader(activeView);
  showToast("Амралтын өдөр хадгалагдлаа");
}

function deleteHoliday(id) {
  const holiday = state.holidays.find(item => Number(item.id) === Number(id));
  if (!holiday || !canAccessSalon(holiday.salon)) return showToast("Өөр салбарын амралтын өдрийг устгах эрхгүй");
  if (!requireDeleteCode()) return;
  state.holidays = state.holidays.filter(item => Number(item.id) !== Number(id));
  state.audit.unshift({ title: "holiday_deleted", meta: "Менежер • амралтын өдөр устгасан" });
  saveState();
  renderHolidaySettings();
  renderBookings();
  renderInfoHeader(activeView);
  showToast("Амралтын өдөр устгагдлаа");
}

const discountWeekdays = [
  ["1", "Да"],
  ["2", "Мя"],
  ["3", "Лх"],
  ["4", "Пү"],
  ["5", "Ба"],
  ["6", "Бя"],
  ["0", "Ня"]
];

function discountSelectableSalons() {
  return isSalonAccount() ? state.salons.filter(salon => salon.name === activeAccount.salon) : state.salons;
}

function selectedDiscountSalons() {
  return Array.from(document.querySelectorAll(".discount-branch-check:checked")).map(input => input.value);
}

function selectedDiscountDays() {
  return Array.from(document.querySelectorAll(".discount-day-check:checked")).map(input => input.value);
}

function serviceDiscountKey(kind, item) {
  return `${kind}:${item.code || ""}:${item.name}`;
}

function selectedDiscountServices() {
  return Array.from(document.querySelectorAll(".discount-service-check:checked")).map(input => input.value);
}

function discountServiceGroups() {
  const singleAdult = serviceSettingsData.single.filter(item => item.customer !== "Хүүхэд");
  const singleChild = serviceSettingsData.single.filter(item => item.customer === "Хүүхэд");
  const courseAdult = serviceSettingsData.course.filter(item => item.customer !== "Хүүхэд");
  const courseChild = serviceSettingsData.course.filter(item => item.customer === "Хүүхэд");
  const productGroupsForDiscount = productGroups
    .map(([key, label]) => [label, `products:${key}`, serviceSettingsData.products[key] || []])
    .filter(([, , items]) => items.length);
  return [
    ["Нэг удаа — Том хүн", "single", singleAdult],
    ["Нэг удаа — Хүүхэд", "single", singleChild],
    ["Курс — Том хүн", "course", courseAdult],
    ["Курс — Хүүхэд", "course", courseChild],
    ...productGroupsForDiscount
  ].filter(([, , items]) => items.length);
}

function updateDiscountSalonSummary() {
  const dropdown = document.getElementById("discountSalonSelect");
  if (!dropdown) return;
  const selected = selectedDiscountSalons();
  const triggerText = dropdown.querySelector(".multi-select-trigger span");
  const count = dropdown.querySelector(".multi-count");
  dropdown.classList.toggle("has-value", selected.length > 0);
  if (count) count.textContent = selected.length;
  if (!triggerText) return;
  if (!selected.length) triggerText.textContent = "Салбар сонгох";
  else if (selected.length === 1) triggerText.textContent = selected[0];
  else if (selected.length === discountSelectableSalons().length) triggerText.textContent = "Бүх салбар";
  else triggerText.textContent = selected.join(", ");
}

function bindDiscountSalonChecks() {
  const dropdown = document.getElementById("discountSalonSelect");
  const trigger = dropdown?.querySelector(".multi-select-trigger");
  const allCheck = document.getElementById("discountAllSalons");
  const branchChecks = Array.from(document.querySelectorAll(".discount-branch-check"));
  trigger?.addEventListener("click", () => {
    const isOpen = dropdown.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", event => {
    if (!dropdown || dropdown.contains(event.target)) return;
    dropdown.classList.remove("open");
    trigger?.setAttribute("aria-expanded", "false");
  });
  if (allCheck) {
    allCheck.checked = branchChecks.length > 0 && branchChecks.every(input => input.checked);
    allCheck.addEventListener("change", () => {
      branchChecks.forEach(input => {
        input.checked = allCheck.checked;
      });
      updateDiscountSalonSummary();
    });
  }
  branchChecks.forEach(input => {
    input.addEventListener("change", () => {
      if (allCheck) allCheck.checked = branchChecks.length > 0 && branchChecks.every(item => item.checked);
      updateDiscountSalonSummary();
    });
  });
  updateDiscountSalonSummary();
}

function renderDiscountSalons(selected = []) {
  const target = document.getElementById("discountSalonChecks");
  if (!target) return;
  const selectableSalons = discountSelectableSalons();
  const checkedValues = isSalonAccount() ? selectableSalons.map(salon => salon.name) : selected;
  target.innerHTML = `
    <div class="multi-select" id="discountSalonSelect">
      <button class="multi-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span>Салбар сонгох</span>
        <strong class="multi-count">0</strong>
      </button>
      <div class="multi-select-menu" role="listbox">
        ${!isSalonAccount() ? `<label class="holiday-check"><input type="checkbox" id="discountAllSalons"> Бүх салбар</label>` : ""}
        ${selectableSalons.map(salon => `
          <label class="holiday-check"><input type="checkbox" class="discount-branch-check" value="${salon.name}" ${checkedValues.includes(salon.name) ? "checked" : ""} ${isSalonAccount() ? "disabled" : ""}> ${salon.name}</label>
        `).join("")}
      </div>
    </div>
  `;
  bindDiscountSalonChecks();
}

function renderDiscountDays(selected = []) {
  const target = document.getElementById("discountDayList");
  if (!target) return;
  const selectedDays = selected.length ? selected : discountWeekdays.map(([value]) => value);
  target.innerHTML = discountWeekdays.map(([value, label]) => `
    <label class="discount-day">
      <input class="discount-day-check" type="checkbox" value="${value}" ${selectedDays.includes(value) ? "checked" : ""}>
      <span>${label}</span>
    </label>
  `).join("");
}

function renderDiscountServices(selected = []) {
  const target = document.getElementById("discountServiceList");
  if (!target) return;
  target.innerHTML = discountServiceGroups().map(([title, kind, items]) => `
    <section class="discount-service-group">
      <label class="discount-group-title">
        <input class="discount-service-group-check" type="checkbox">
        <span>${title}</span>
      </label>
      <div class="discount-service-options">
        ${items.map(item => {
          const key = serviceDiscountKey(kind, item);
          return `
            <label class="discount-service-option">
              <input class="discount-service-check" type="checkbox" value="${key}" ${selected.includes(key) ? "checked" : ""}>
              <span>${standardServiceName(item.name, kind.startsWith("products") ? "products" : kind)}</span>
            </label>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  target.querySelectorAll(".discount-service-group").forEach(group => {
    const groupCheck = group.querySelector(".discount-service-group-check");
    const checks = Array.from(group.querySelectorAll(".discount-service-check"));
    const syncGroup = () => {
      groupCheck.checked = checks.length > 0 && checks.every(input => input.checked);
    };
    groupCheck.addEventListener("change", () => {
      checks.forEach(input => {
        input.checked = groupCheck.checked;
      });
    });
    checks.forEach(input => input.addEventListener("change", syncGroup));
    syncGroup();
  });
}

function discountDaysText(days = []) {
  if (!days.length || days.length === discountWeekdays.length) return "Бүх өдөр";
  return discountWeekdays.filter(([value]) => days.includes(value)).map(([, label]) => label).join(", ");
}

function resetDiscountForm() {
  discountEditingId = null;
  document.getElementById("discountForm")?.reset();
  const today = todayText();
  const start = document.getElementById("discountStartDate");
  const end = document.getElementById("discountEndDate");
  if (start) {
    start.min = today;
    start.value = today;
  }
  if (end) {
    end.min = today;
    end.value = "";
  }
  const title = document.getElementById("discountFormTitle");
  if (title) title.textContent = "Хямдрал нэмэх";
  document.getElementById("discountSubmit").textContent = "Нэмэх";
  renderDiscountSalons(isSalonAccount() ? [activeAccount.salon] : []);
  renderDiscountDays();
  renderDiscountServices();
}

function renderDiscountSettings() {
  const start = document.getElementById("discountStartDate");
  const end = document.getElementById("discountEndDate");
  if (start) {
    start.min = todayText();
    if (!start.value) start.value = todayText();
  }
  if (end) end.min = start?.value || todayText();
  if (!discountEditingId) {
    renderDiscountSalons(selectedDiscountSalons());
    renderDiscountDays(selectedDiscountDays());
    renderDiscountServices(selectedDiscountServices());
  }
  const list = document.getElementById("discountList");
  if (!list) return;
  list.innerHTML = [...state.discounts].sort((a, b) => `${b.startDate}${b.id}`.localeCompare(`${a.startDate}${a.id}`)).map(discount => `
    <tr>
      <td><strong>${discount.name}</strong></td>
      <td>${discount.percent}%</td>
      <td>${dateWithWeekday(discount.startDate)}<span class="muted-row">${dateWithWeekday(discount.endDate)}</span></td>
      <td>${discountDaysText(discount.days)}</td>
      <td>${(discount.salons || []).join(", ")}</td>
      <td>${(discount.services || []).length}</td>
      <td>
        <div class="table-actions">
          <button class="secondary-btn icon-action discount-edit" type="button" data-id="${discount.id}" aria-label="Засах">${editIcon()}</button>
          <button class="danger-btn icon-danger discount-delete" type="button" data-id="${discount.id}" aria-label="Устгах">${trashIcon()}</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6">Хямдрал бүртгэгдээгүй байна</td></tr>`;

  list.querySelectorAll(".discount-edit").forEach(button => {
    button.addEventListener("click", () => editDiscount(Number(button.dataset.id)));
  });
  list.querySelectorAll(".discount-delete").forEach(button => {
    button.addEventListener("click", () => deleteDiscount(Number(button.dataset.id)));
  });
}

function saveDiscount(event) {
  event.preventDefault();
  const name = formValue("discountName");
  const percent = Number(formValue("discountPercent"));
  const startDate = formValue("discountStartDate");
  const endDate = formValue("discountEndDate");
  const salons = selectedDiscountSalons();
  const days = selectedDiscountDays();
  const services = selectedDiscountServices();
  if (!name || !percent || !startDate || !endDate || !salons.length || !services.length) {
    showToast("Мэдээллээ бүрэн оруулна уу");
    return;
  }
  if (endDate < startDate) {
    showToast("Дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй");
    return;
  }
  const payload = { name, percent, startDate, endDate, salons, days, services };
  if (discountEditingId) {
    state.discounts = state.discounts.map(item => Number(item.id) === Number(discountEditingId) ? { ...item, ...payload } : item);
  } else {
    state.discounts.unshift({ id: nextId(state.discounts), ...payload });
  }
  saveState();
  const wasEditing = Boolean(discountEditingId);
  resetDiscountForm();
  renderDiscountSettings();
  renderInfoHeader(activeView);
  showToast(wasEditing ? "Хямдрал шинэчлэгдлээ" : "Хямдрал нэмэгдлээ");
}

function editDiscount(id) {
  const discount = state.discounts.find(item => Number(item.id) === Number(id));
  if (!discount) return;
  discountEditingId = discount.id;
  const title = document.getElementById("discountFormTitle");
  if (title) title.textContent = "Хямдрал засах";
  document.getElementById("discountName").value = discount.name;
  document.getElementById("discountPercent").value = discount.percent;
  document.getElementById("discountStartDate").value = discount.startDate;
  document.getElementById("discountEndDate").value = discount.endDate;
  document.getElementById("discountSubmit").textContent = "Хадгалах";
  renderDiscountSalons(discount.salons || []);
  renderDiscountDays(discount.days || []);
  renderDiscountServices(discount.services || []);
  document.getElementById("discountForm")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function deleteDiscount(id) {
  if (!requireDeleteCode()) return;
  state.discounts = state.discounts.filter(item => Number(item.id) !== Number(id));
  if (Number(discountEditingId) === Number(id)) resetDiscountForm();
  saveState();
  renderDiscountSettings();
  renderInfoHeader(activeView);
  showToast("Хямдрал устлаа");
}

function saveBranch(event) {
  event.preventDefault();
  const name = formValue("branchName");
  const phone = formValue("branchPhone").replace(/\D/g, "").slice(0, 8);
  const address = formValue("branchAddress");
  if (!/^\d{8}$/.test(phone)) {
    showToast("Салбарын утас 8 оронтой байх ёстой");
    return;
  }
  const payload = {
    name,
    phone,
    address,
    mapUrl: formValue("branchMapUrl"),
    coverImage: formValue("branchCoverImage"),
    gallery: [...branchGalleryDraft],
    active: branchEditingId ? formValue("branchStatus") !== "inactive" : true
  };
  if (branchEditingId) {
    const branch = state.salons.find(item => Number(item.id) === Number(branchEditingId));
    if (branch) Object.assign(branch, payload);
    state.audit.unshift({ title: "branch_updated", meta: `Менежер • ${name}` });
  } else {
    state.salons.unshift({
      id: nextId(state.salons),
      ...payload,
      bookings: 0,
      revenue: 0,
      staff: "0/0",
      slotCapacity: 4,
      schedule: { ...defaultState.scheduleSettings },
      status: "Ачаалал хэвийн"
    });
    state.audit.unshift({ title: "branch_created", meta: `Менежер • ${name}` });
  }
  saveState();
  closeBranchForm();
  rerenderAll();
  renderScheduleSettings();
  setupCustomSelect();
  renderInfoHeader(activeView);
  showToast("Салбар хадгалагдлаа");
}

function saveBranchPageSettings(event) {
  event.preventDefault();
  const value = formValue("branchDirectoryHeadline") || "ТА ӨӨРТ ОЙР САЛБАРТАА ЦАГ ЗАХИАЛААРАЙ";
  homepageSettings().booking.directoryHeadline = value;
  saveState();
  renderBranches();
  showToast("Цаг захиалгын нүүрний гарчиг хадгалагдлаа");
}

function toggleBranch(id) {
  const branch = state.salons.find(item => Number(item.id) === Number(id));
  if (!branch) return;
  branch.active = branch.active === false;
  state.audit.unshift({ title: "branch_status_changed", meta: `Менежер • ${branch.name} • ${branch.active ? "Идэвхтэй" : "Идэвхгүй"}` });
  saveState();
  renderBranches();
  renderInfoHeader(activeView);
  showToast("Салбарын төлөв өөрчлөгдлөө");
}

function deleteBranch(id) {
  if (!requireDeleteCode()) return;
  const branch = state.salons.find(item => Number(item.id) === Number(id));
  state.salons = state.salons.filter(item => Number(item.id) !== Number(id));
  if (branch) state.audit.unshift({ title: "branch_deleted", meta: `Менежер • ${branch.name}` });
  saveState();
  closeBranchForm();
  rerenderAll();
  renderScheduleSettings();
  setupCustomSelect();
  renderInfoHeader(activeView);
  showToast("Салбар устгагдлаа");
}

function renderAssignments() {
  const assignmentList = document.getElementById("assignmentList");
  if (!assignmentList) return;
  assignmentList.innerHTML = state.assignments.map(item => `
    <div class="stack-item">
      <strong>${item.staff} → ${item.to}</strong>
      <span>${item.date} • ${item.time} • home: ${item.from}</span>
    </div>
  `).join("");
}

function customerBalance(customer) {
  const treatmentBalance = Number(customer.currentTreatment?.paymentBalance || 0);
  const historyBalance = (customer.serviceHistory || []).reduce((sum, item) => sum + Number(item.balance || 0), 0);
  return treatmentBalance || historyBalance || 0;
}

function customerBonusPercent(customer) {
  const typeRule = customerTypeRule(customer.type || "Хэрэглэгч");
  if (!typeRule.dynamic) return `${typeRule.bonusPercent}%`;
  const group = customerGroup(customer);
  if (group) return `${groupBonusInfo(group).percent}%`;
  return customer.bonus || `${typeRule.bonusPercent}%`;
}

function serviceDateKey(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const slashMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!slashMatch) return clean.slice(0, 10);
  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = slashMatch[3];
  if (first > 12) return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  return `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
}

function todaySalonTreatment(customer, salon = activeAccount.salon) {
  const today = todayText();
  const history = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  const isSigned = value => value?.signed || value?.qr === "Баталгаажсан" || value?.qrStatus === "Баталгаажсан";
  for (const item of history) {
    const itemSalon = item.salon || customer.salon || activeAccount.salon;
    if (salon && itemSalon !== salon) continue;
    if (item.kind === "course") {
      const visits = Array.isArray(item.visits) ? item.visits : [];
      const visit = visits.find(entry => serviceDateKey(entry.date || item.date) === today && (!salon || (entry.salon || itemSalon) === salon));
      if (!visit) continue;
      if (isSigned(visit)) continue;
      const visitNumber = visit.number || visits.indexOf(visit) + 1;
      const total = Number(item.visitsTotal || parseVisitCount(item.visits || item.service || item.title) || visits.length || 1);
      return {
        service: item.service || item.title || "Курс эмчилгээ",
        progress: `Курс ${visitNumber}/${total}`,
        salon: visit.salon || itemSalon,
        stage: Number(item.balance || 0) > 0 ? "Үйлчилгээ эхэлсэн" : "Төлбөр хаагдсан"
      };
    }
    if (serviceDateKey(item.date || item.createdAt) !== today) continue;
    if (Number(item.balance || 0) <= 0) continue;
    return {
      service: item.service || item.title || "Үйлчилгээ",
      progress: "Нэг удаа",
      salon: itemSalon,
      stage: Number(item.balance || 0) > 0 ? "Үйлчилгээ эхэлсэн" : "Төлбөр хаагдсан"
    };
  }
  return null;
}

function renderCustomerInlineForm() {
  const typeSelect = document.getElementById("inlineCustomerType");
  const districtSelect = document.getElementById("inlineCustomerDistrict");
  if (typeSelect) {
    const previousType = typeSelect.value || "Хэрэглэгч";
    typeSelect.innerHTML = customerTypeOptions(previousType);
  }
  if (districtSelect) {
    const previousDistrict = districtSelect.value || "";
    districtSelect.innerHTML = `<option value="" disabled ${previousDistrict ? "" : "selected"}>Сонгох</option>${districtOptions(previousDistrict)}`;
  }
}

function saveInlineCustomer(event) {
  event.preventDefault();
  const phone = formValue("inlineCustomerPhone");
  if (phone.length !== 8) {
    showToast("Утасны дугаар 8 оронтой байна");
    return;
  }
  const selectedType = formValue("inlineCustomerType") || "Хэрэглэгч";
  const customerId = nextId(state.customers);
  const ageValue = formValue("inlineCustomerAge");
  const birthYear = birthYearFromAge(ageValue);
  state.customers.unshift({
    id: customerId,
    name: formValue("inlineCustomerName"),
    phone,
    age: birthYear ? customerAge({ birthYear }) : "",
    birthYear,
    gender: formValue("inlineCustomerGender"),
    district: formValue("inlineCustomerDistrict"),
    khoroo: formValue("inlineCustomerKhoroo"),
    type: selectedType,
    bonus: `${customerTypeRule(selectedType).bonusPercent}%`,
    activeCourse: false,
    course: "",
    unpaid: false,
    spent: 0,
    balance: 0,
    last: "-",
    registeredAt: todayText(),
    salon: activeAccount.salon,
    groupId: null,
    groupRole: "",
    currentTreatment: null,
    serviceHistory: []
  });
  state.selectedCustomerId = customerId;
  state.audit.unshift({ title: "customer_created", meta: `Менежер • ${formValue("inlineCustomerName")} • ${selectedType}` });
  saveState();
  event.target.reset();
  renderCustomerInlineForm();
  enhanceNativeSelects(["inlineCustomerGender", "inlineCustomerDistrict", "inlineCustomerType"]);
  renderCustomers();
  renderAudit();
  showToast("Хэрэглэгч нэмэгдлээ");
}

function clearCustomerFilters() {
  ["customerSearch", "customerDistrictFilter", "customerKhorooFilter"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = id === "customerDistrictFilter" ? "all" : "";
  });
  ["customerDistrictFilter", "customerTypeFilter", "customerWorkFilter"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.value = "all";
    syncNativeSelectProxy(select);
  });
  customerSortMode = "date";
  customerPage = 1;
  renderCustomers();
}

function customerSingleServiceIsActive(customer = {}, item = {}) {
  const title = String(item.title || item.service || "").toLowerCase();
  if (item.deleted || item.kind === "course" || item.kind === "kass" || item.kind === "product" || title.includes("курс")) return false;
  if (Number(item.balance || 0) > 0) return true;

  const unfinishedText = `${item.status || ""} ${item.stage || ""} ${item.qr || ""} ${item.qrStatus || ""}`.toLowerCase();
  if (/(дутуу|дуусаагүй|эхэлсэн|хүлээгдэж)/.test(unfinishedText)) return true;

  const treatment = customer.currentTreatment;
  if (!treatment) return false;
  const sameService = treatment.id === item.id ||
    standardServiceName(treatment.service || "", "single") === standardServiceName(item.service || item.title || "", "single");
  const treatmentState = `${treatment.stage || ""} ${treatment.qrStatus || ""}`.toLowerCase();
  return sameService && (Number(treatment.paymentBalance || 0) > 0 || /(дутуу|дуусаагүй|эхэлсэн|хүлээгдэж)/.test(treatmentState));
}

function customerCourseEntryStatus(customer = {}) {
  const history = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  const activeCourse = history
    .filter(item => !item?.deleted && (item?.kind === "course" || String(item?.title || "").toLowerCase().includes("курс")))
    .map(item => {
      const titleProgress = String(item.title || "").match(/(\d+)\s*\/\s*(\d+)/);
      const total = Number(item.visitsTotal || titleProgress?.[2] || parseVisitCount(item.visits || item.title) || 0);
      const done = Array.isArray(item.visits) ? item.visits.length : Number(item.doneVisits ?? titleProgress?.[1] ?? 0);
      return total > 0 ? { done: Math.min(done, total), total, kind: "course" } : null;
    })
    .find(progress => progress && progress.done < progress.total);
  if (activeCourse) return { ...activeCourse, complete: false };

  const legacy = String(customer.course || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (legacy) {
    const done = Number(legacy[1]);
    const total = Number(legacy[2]);
    if (done < total) return { done, total, complete: false, kind: "course" };
  }

  const activeSingle = history.find(item => customerSingleServiceIsActive(customer, item));
  if (activeSingle) return { done: 0, total: 1, complete: false, kind: "single" };
  return null;
}

function customerCourseEntryHtml(customer) {
  const progress = customerCourseEntryStatus(customer);
  if (!progress) return "—";
  return `<span class="customer-entry-chip ${progress.complete ? "complete" : "active"}">${progress.done}/${progress.total}</span>`;
}

function renderCustomers() {
  renderCustomerTypeFilter();
  renderCustomerInlineForm();
  const districtFilter = document.getElementById("customerDistrictFilter");
  if (districtFilter) districtFilter.innerHTML = districtFilterOptions(districtFilter.value || "all");
  enhanceNativeSelects(["inlineCustomerGender", "inlineCustomerDistrict", "inlineCustomerType", "customerDistrictFilter", "customerTypeFilter", "customerWorkFilter"]);
  const q = document.getElementById("customerSearch")?.value?.toLowerCase() || "";
  const districtQuery = document.getElementById("customerDistrictFilter")?.value || "all";
  const khorooQuery = document.getElementById("customerKhorooFilter")?.value?.toLowerCase() || "";
  const type = document.getElementById("customerTypeFilter")?.value || "all";
  const workFilter = document.getElementById("customerWorkFilter")?.value || "all";
  const sortMode = customerSortMode || "date";
  const sortToggle = document.getElementById("customerSortToggle");
  if (sortToggle) {
    sortToggle.dataset.sort = sortMode;
    sortToggle.innerHTML = `${sortMode === "name" ? "Нэр" : "Огноо"} <span>↓</span>`;
  }
  const activeTreatments = state.customers
    .filter(customer => !customer.deleted && !customer.deletedAt)
    .map(customer => ({ customer, treatment: todaySalonTreatment(customer, activeAccount.salon) }))
    .filter(item => item.treatment);
  const activeStrip = document.getElementById("activeTreatmentStrip");
  if (activeStrip) {
    activeStrip.innerHTML = `
      <div class="customer-strip-head">
        <strong>Одоо үйлчилгээтэй</strong>
        <span>${activeTreatments.length} хэрэглэгч</span>
      </div>
      <div class="active-treatment-list">
        ${activeTreatments.map(({ customer, treatment }) => {
          return `
            <button class="active-treatment-card customer-detail-open" type="button" data-id="${customer.id}">
              <strong>${customer.name}</strong>
              <span>${treatment.service} • ${treatment.progress}</span>
              <em>${treatment.salon} • ${treatment.stage}</em>
            </button>
          `;
        }).join("") || `<div class="active-treatment-empty">Одоогоор явж буй үйлчилгээ алга</div>`}
      </div>
    `;
  }
  let rows = state.customers
    .filter(c => !c.deleted)
    .filter(c => type === "all" || c.type === type)
    .filter(c => {
      if (workFilter === "active") return Boolean(todaySalonTreatment(c, activeAccount.salon));
      if (workFilter === "unpaid") return Boolean(customerBalance(c));
      if (workFilter === "group") return Boolean(c.groupId);
      return true;
    })
    .filter(c => districtQuery === "all" || String(c.district || "") === districtQuery)
    .filter(c => !khorooQuery || String(c.khoroo || "").toLowerCase().includes(khorooQuery))
    .filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));

  rows = rows.sort((a, b) => {
    if (sortMode === "name") return a.name.localeCompare(b.name);
    return String(b.registeredAt || b.last || "").localeCompare(String(a.registeredAt || a.last || "")) || b.id - a.id;
  });

  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  customerPage = Math.min(customerPage, totalPages);
  const pageRows = rows.slice((customerPage - 1) * pageSize, customerPage * pageSize);

  const body = document.getElementById("customerRows");
  if (body) {
    body.innerHTML = pageRows.map(customer => `
      <tr>
        <td>
          <div class="name-cell">
            <span class="mini-avatar">${initials(customer.name)}</span>
            <div>
              <strong>${customer.name}</strong>
            </div>
          </div>
        </td>
        <td>${customer.phone}</td>
        <td><span class="plain-cell-text">${customer.type}</span></td>
        <td>${customer.registeredAt || customer.last || "-"}</td>
        <td>${customerCourseEntryHtml(customer)}</td>
        <td>${customerBalance(customer) ? `<span class="customer-balance-due">${money(customerBalance(customer))}</span>` : "—"}</td>
        <td>${customerBonusPercent(customer)}</td>
        <td><button class="secondary-btn compact-action customer-detail-open" data-id="${customer.id}" type="button">Дэлгэрэнгүй</button></td>
      </tr>
    `).join("");
  }

  const pagination = document.getElementById("customerPagination");
  if (pagination) {
    pagination.innerHTML = totalPages > 1 ? `
      <button class="secondary-btn" id="customerPrevPage" ${customerPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${customerPage} / ${totalPages}</span>
      <button class="secondary-btn" id="customerNextPage" ${customerPage >= totalPages ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("customerPrevPage")?.addEventListener("click", () => { customerPage -= 1; renderCustomers(); });
    document.getElementById("customerNextPage")?.addEventListener("click", () => { customerPage += 1; renderCustomers(); });
  }

  document.querySelectorAll(".customer-detail-open").forEach(button => {
    button.addEventListener("click", () => {
      const customer = state.customers.find(item => Number(item.id) === Number(button.dataset.id));
      clearCustomerUiState(customer);
      state.selectedCustomerId = Number(button.dataset.id);
      setView("profile");
    });
  });

  const serviceCustomer = document.getElementById("serviceCustomer");
  if (serviceCustomer) serviceCustomer.innerHTML = state.customers.filter(c => !c.deleted).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function renderCustomerSideProfile() {
  const panel = document.getElementById("customerSideProfile");
  if (!panel) return;
  const customer = selectedCustomer();
  if (!customer) {
    panel.innerHTML = `<div class="empty-state">Хэрэглэгч сонгоно уу</div>`;
    return;
  }
  const group = customerGroup(customer);
  const bonusInfo = groupBonusInfo(group);
  panel.innerHTML = `
    <div class="customer-side-head">
      <span class="mini-avatar large">${initials(customer.name)}</span>
      <div>
        <h2>${customer.name}</h2>
        <p>${customer.phone}</p>
      </div>
    </div>
    <div class="customer-profile-grid">
      <div><span>Төрөл</span><strong>${customer.type}</strong></div>
      <div><span>Нас</span><strong>${customerAge(customer) || "—"}</strong></div>
      <div><span>Хүйс</span><strong>${customer.gender || "—"}</strong></div>
      <div><span>Дүүрэг</span><strong>${customer.district || "—"}</strong></div>
      <div><span>Хороо</span><strong>${customer.khoroo || "—"}</strong></div>
      <div><span>Үлдэгдэл</span><strong>${customerBalance(customer) ? money(customerBalance(customer)) : "—"}</strong></div>
    </div>
    <section class="customer-side-section">
      <h3>Групп bonus</h3>
      ${group ? `
        <div class="group-summary compact">
          <div><span>Групп</span><strong>${group.name}</strong></div>
          <div><span>Хувь</span><strong>${bonusInfo.percent}%</strong></div>
          <div><span>Bonus</span><strong>${money(bonusInfo.balance)}</strong></div>
        </div>
        <div class="group-members">
          ${groupMembers(group).map(member => `<span>${member.name}${Number(group.adminCustomerId) === Number(member.id) ? " • админ" : ""}</span>`).join("")}
        </div>
        <div class="group-actions">
          <button class="secondary-btn" id="profileAddGroupMemberBtn" type="button">Гишүүн нэмэх</button>
        </div>
      ` : `
        <div class="empty-state profile-empty-action">
          <span>Үйлчилгээ авахын өмнө групп үүсгэх эсвэл группт нэгдэх шаардлагатай</span>
          <div class="group-actions split">
            <button class="secondary-btn" id="profileCreateGroupBtn" type="button">Групп үүсгэх</button>
            <button class="secondary-btn" id="profileJoinGroupBtn" type="button">Группт нэгдэх</button>
          </div>
        </div>
      `}
    </section>
    <section class="customer-side-section">
      <div class="section-title-row">
        <h3>Авсан үйлчилгээ</h3>
        <button class="primary-btn" id="profileStartTreatmentBtn" type="button">Үйлчилгээ нэмэх</button>
      </div>
      <div class="customer-service-history">${renderCustomerServiceHistory(customer)}</div>
    </section>
  `;
  bindDiagnosisPhotoPreview(panel);
  document.getElementById("profileCreateGroupBtn")?.addEventListener("click", () => createCustomerGroup(customer.id));
  document.getElementById("profileJoinGroupBtn")?.addEventListener("click", () => {
    customer.profileJoinGroupOpen = !customer.profileJoinGroupOpen;
    renderProfile();
  });
  bindInlineJoinGroup(customer);
  panel.querySelectorAll(".course-slot-card").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest(".course-slot-edit")) return;
      const button = card.querySelector(".course-slot-btn");
      if (!button) return;
      if (button.dataset.filled === "true") {
        const item = customer.serviceHistory?.[Number(button.dataset.historyIndex)];
        if (!item) return;
        const visitNumber = Number(button.dataset.visit);
        item.diagnosisViewVisit = Number(item.diagnosisViewVisit) === visitNumber ? null : visitNumber;
        item.expandedVisit = null;
        renderCustomerSideProfile();
        return;
      }
      openCourseVisitModal(customer.id, Number(button.dataset.historyIndex), Number(button.dataset.visit));
    });
  });
  panel.querySelectorAll(".course-slot-edit").forEach(button => {
    button.addEventListener("click", () => openCourseVisitModal(customer.id, Number(button.dataset.historyIndex), Number(button.dataset.visit)));
  });
  panel.querySelectorAll(".history-diagnosis-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const item = customer.serviceHistory[Number(button.dataset.historyIndex)];
      if (!item) return;
      item.diagnosisOpen = !item.diagnosisOpen;
      renderCustomerSideProfile();
    });
  });
}

function renderKassProductsSummary(item = {}) {
  const products = Array.isArray(item.products) ? item.products : [];
  if (!products.length) return "";
  return `
    <div class="profile-kass-history">
      <div class="profile-kass-history-title">Барааны жагсаалт</div>
      ${products.map(product => `
        <div class="profile-kass-history-row">
          <span>${product.name}${product.specialPriceApplied ? ` <em>Тусгай үнэ</em>` : ""}</span>
          <small>${money(product.unitPrice || product.price)} ×${product.qty || 1}</small>
          <strong>${money(product.lineTotal || Number(product.unitPrice || product.price || 0) * Number(product.qty || 1))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCustomerServiceHistory(customer) {
  const history = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  if (!history.length) return `<div class="empty-state">Үйлчилгээний түүх алга</div>`;
  return history.map((item, index) => {
    const isCourse = item.kind === "course";
    const isKass = item.kind === "kass" || item.kind === "product";
    const diagnosis = item.diagnosis || null;
    const title = item.title || item.service || "Үйлчилгээ";
    const date = item.date || item.createdAt || customer.last || "-";
    const staff = item.staff || "Ажилтан сонгоогүй";
    const salon = item.salon || customer.salon || activeAccount.salon;
    const price = serviceTotalAmount(item);
    const paid = Math.max(0, price - Number(item.balance || 0));
    const editMode = profileServiceEditMode(item);
    const editAllowed = editMode !== "locked";
    const deleteAllowed = isServiceDeletable(item);
    const active = Boolean(item.paymentFormOpen || item.expandedVisit || item.diagnosisOpen || customer.profileServiceEditingIndex === index);
    return `
      <article class="profile-service-card ${active ? "active" : ""}">
        <div class="profile-service-head">
          <div>
            <strong>${title}</strong>
            <span>${date} • ${staff} • ${salon}</span>
          </div>
          <div class="service-card-actions ${editAllowed || deleteAllowed ? "" : "actions-disabled"}">
            <button class="secondary-btn icon-action profile-service-edit" type="button" data-history-index="${index}" aria-label="Засах" ${editAllowed ? "" : "disabled"}>${editIcon()}</button>
            <button class="danger-btn icon-danger profile-service-delete" type="button" data-history-index="${index}" aria-label="Устгах" ${deleteAllowed ? "" : "disabled"}>${trashIcon()}</button>
          </div>
        </div>
        ${customer.profileServiceEditingIndex === index ? `
          <div class="profile-service-card-edit">
            <div class="profile-service-card-edit-title">${customer.profileServiceEditMode === "diagnosis" ? "Оношилгоо засах" : "Үйлчилгээ засах"}</div>
            ${renderProfileServiceInlineForm(customer)}
          </div>
        ` : ""}
        ${isKass ? renderKassProductsSummary(item) : ""}
        ${isCourse ? renderCourseSlots(item, index) : ""}
        ${!isCourse && !isKass && diagnosis ? `
          <div class="profile-diagnosis-history">
            <button class="secondary-btn history-diagnosis-toggle" type="button" data-history-index="${index}">Оношилгоо <span>${item.diagnosisOpen ? "↑" : "↓"}</span></button>
            ${item.diagnosisOpen ? renderDiagnosisSummary(diagnosis) : ""}
          </div>
        ` : ""}
        ${customer.profileServiceEditingIndex === index ? "" : `
          <div class="profile-service-footer">
            ${renderServicePaymentSummary(item, paid, index)}
          </div>
        `}
      </article>
    `;
  }).join("");
}

function courseVisitExtras(item = {}) {
  const visits = Array.isArray(item.visits) ? item.visits : [];
  return visits.reduce((acc, visit) => {
    acc.vipRoomFee += Number(visit.vipRoomFee || 0);
    acc.masterStaffFee += Number(visit.masterStaffFee || 0);
    return acc;
  }, { vipRoomFee: 0, masterStaffFee: 0 });
}

function serviceTotalAmount(item = {}) {
  if (item.kind === "course") {
    const extras = courseVisitExtras(item);
    return Number(item.basePrice || item.price || item.total || 0) + extras.vipRoomFee + extras.masterStaffFee;
  }
  return Number(item.price || item.total || 0);
}

function servicePaidAmount(item = {}) {
  const payments = Array.isArray(item.payments) ? item.payments : [];
  if (payments.length) {
    return payments.reduce((sum, payment) => sum + Number(payment.amount || payment.paidAmount || 0), 0);
  }
  return Math.max(0, serviceTotalAmount(item) - Number(item.balance || 0));
}

function localDateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function performanceMonthRange(offset = 0) {
  const base = new Date(`${todayText()}T00:00:00`);
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0);
  return { from: localDateText(first), to: localDateText(last) };
}

function performanceFilters() {
  const fromValue = document.getElementById("performanceFrom")?.value || "";
  const toValue = document.getElementById("performanceTo")?.value || "";
  return {
    from: fromValue || "0000-01-01",
    to: toValue || "9999-12-31",
    fromValue,
    toValue,
    salon: isSalonAccount() ? activeAccount.salon : (document.getElementById("performanceSalon")?.value || "all")
  };
}

function performanceAssignment(staff, date, salon) {
  return state.assignments.find(item =>
    item.status !== "cancelled" &&
    (Number(item.staffId) === Number(staff?.id) || item.staff === staff?.name) &&
    date >= item.startDate && date <= item.endDate &&
    salon === item.to
  ) || null;
}

function performanceDemoData() {
  const months = ["2026-05", "2026-06", "2026-07"];
  const serviceNames = ["Гүн тэжээлийн эмчилгээ", "Үүргийн эмчилгээ", "Халгайн хандны эмчилгээ", "Эмзэг хуйхны эмчилгээ", "Гүн цэвэрлэгээ"];
  const courseNames = ["Үс ургуулах курс", "Буурал үсний эсрэг курс", "Тослог үсний курс", "Хагны эсрэг курс"];
  const customerNames = ["Б.Хулан", "Н.Энх", "Ц.Мөнхзул", "Г.Сарангэрэл", "О.Номин", "Б.Ариунаа"];
  const activeStaff = state.staff.filter(item => item.status !== "inactive").slice(0, 11);
  const demo = [];
  activeStaff.forEach((staff, staffIndex) => {
    months.forEach((month, monthIndex) => {
      const singleCount = 4 + ((staffIndex + monthIndex) % 6);
      const courseCount = 3 + ((staffIndex * 2 + monthIndex) % 5);
      for (let index = 0; index < singleCount; index += 1) {
        const day = String(2 + ((staffIndex * 3 + index * 4 + monthIndex) % 25)).padStart(2, "0");
        const temporarySalon = month === "2026-07" && staff.name === "Хулан" && index === 0 ? "Төв салбар" : staff.salon;
        demo.push({
          staffId: staff.id,
          staff: staff.name,
          date: `${month}-${temporarySalon !== staff.salon ? "11" : day}`,
          salon: temporarySalon || state.salons[staffIndex % state.salons.length]?.name || activeAccount.salon,
          type: "single",
          title: serviceNames[(staffIndex + index) % serviceNames.length],
          customer: customerNames[(staffIndex + index + monthIndex) % customerNames.length],
          revenue: 45000 + ((staffIndex + index) % 5) * 10000,
          demo: true
        });
      }
      for (let index = 0; index < courseCount; index += 1) {
        const day = String(3 + ((staffIndex * 2 + index * 5 + monthIndex) % 24)).padStart(2, "0");
        const temporarySalon = month === "2026-07" && staff.name === "Номин" && index === 0 ? "Төв салбар" : staff.salon;
        demo.push({
          staffId: staff.id,
          staff: staff.name,
          date: `${month}-${temporarySalon !== staff.salon ? "12" : day}`,
          salon: temporarySalon || state.salons[staffIndex % state.salons.length]?.name || activeAccount.salon,
          type: "course",
          title: `${courseNames[(staffIndex + index) % courseNames.length]} · ${index + 1}-р оролт`,
          customer: customerNames[(staffIndex + index + 2) % customerNames.length],
          revenue: 65000 + ((staffIndex + index) % 4) * 7500,
          demo: true
        });
      }
      if ((staff.position || "").includes("Касс") || staffIndex % 4 === monthIndex % 3) {
        [8, 18].forEach((day, index) => demo.push({
          staffId: staff.id,
          staff: staff.name,
          date: `${month}-${String(day + (staffIndex % 3)).padStart(2, "0")}`,
          salon: staff.salon || activeAccount.salon,
          type: "kass",
          title: `Кассын борлуулалт · ${index + 1}`,
          customer: "",
          revenue: 380000 + staffIndex * 25000 + monthIndex * 40000,
          demo: true
        }));
      }
    });
  });
  return demo;
}

function performanceTransactions() {
  const transactions = [];
  const add = payload => {
    const staff = state.staff.find(item => Number(item.id) === Number(payload.staffId) || item.name === payload.staff);
    if (!staff || !payload.date || !payload.salon) return;
    const revenue = Math.max(0, Number(payload.revenue || 0));
    const rate = payload.type === "kass"
      ? Number(staff.kassCommission ?? 0)
      : Number(staff.bonusCommission ?? parseFloat(staff.commission) ?? 0);
    transactions.push({
      ...payload,
      staffId: staff.id,
      staff: staff.name,
      homeSalon: staff.salon || "",
      revenue,
      rate,
      commission: Math.round(revenue * rate / 100),
      temporary: Boolean(payload.temporary || performanceAssignment(staff, payload.date, payload.salon))
    });
  };

  state.customers.forEach(customer => {
    (customer.serviceHistory || []).forEach(item => {
      if (!item || item.deleted) return;
      const salon = item.salon || customer.salon || activeAccount.salon;
      const date = item.date || item.createdAt || customer.last || todayText();
      const title = item.title || item.service || "Үйлчилгээ";
      if (item.kind === "kass" || item.kind === "product") {
        const schedule = state.kassSchedules.find(entry => entry.date === date && entry.salon === salon);
        const kassStaff = schedule?.staff || (item.staff !== "Касс" ? item.staff : "");
        if (kassStaff) add({ staff: kassStaff, date, salon, type: "kass", title, customer: customer.name, revenue: serviceTotalAmount(item) });
        return;
      }
      if (item.kind === "course") {
        const visits = Array.isArray(item.visits) ? item.visits.filter(visit => !visit.deleted) : [];
        const visitTotal = Math.max(1, Number(item.visitsTotal || visits.length || 1));
        const basePerVisit = Number(item.basePrice || item.price || item.total || 0) / visitTotal;
        visits.forEach((visit, index) => {
          add({
            staff: visit.staff || item.staff,
            date: visit.date || date,
            salon: visit.salon || salon,
            type: "course",
            title: `${title} · ${index + 1}-р оролт`,
            customer: customer.name,
            revenue: basePerVisit + Number(visit.vipRoomFee || 0) + Number(visit.masterStaffFee || 0)
          });
        });
        return;
      }
      if (item.kind === "single" && item.staff) {
        add({ staff: item.staff, date, salon, type: "single", title, customer: customer.name, revenue: serviceTotalAmount(item) });
      }
    });
  });

  state.services.forEach((item, index) => {
    if (!item || item.deleted || !item.staff) return;
    add({
      staff: item.staff,
      date: item.date || item.createdAt || todayText(),
      salon: item.salon || activeAccount.salon,
      type: item.kind === "course" ? "course" : "single",
      title: item.service || item.title || `Үйлчилгээ ${index + 1}`,
      customer: item.customer || "",
      revenue: Number(item.total || item.price || 0)
    });
  });
  return transactions;
}

function performanceDataMonths() {
  return [...new Set(performanceTransactions().map(item => String(item.date || "").slice(0, 7)).filter(value => /^\d{4}-\d{2}$/.test(value)))]
    .sort((a, b) => b.localeCompare(a));
}

function performanceMonthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [year, month] = value.split("-");
  return `${year} оны ${Number(month)} сар`;
}

function performanceRangeForMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return { from: "", to: "" };
  const [year, month] = value.split("-").map(Number);
  return {
    from: `${value}-01`,
    to: localDateText(new Date(year, month, 0))
  };
}

function buildPerformanceReport() {
  const { from, to, fromValue, toValue, salon } = performanceFilters();
  const allTransactions = performanceTransactions();
  const allDates = allTransactions.map(item => item.date).filter(Boolean).sort();
  const transactions = allTransactions.filter(item =>
    item.date >= from && item.date <= to && (salon === "all" || item.salon === salon)
  );
  const schedules = state.kassSchedules.filter(item =>
    item.date >= from && item.date <= to && (salon === "all" || item.salon === salon)
  );
  const rows = state.staff
    .filter(staff => staff.status !== "inactive")
    .filter(staff => salon === "all" || staff.salon === salon || transactions.some(item => Number(item.staffId) === Number(staff.id)) || state.assignments.some(item => Number(item.staffId) === Number(staff.id) && item.to === salon && item.startDate <= to && item.endDate >= from))
    .map(staff => {
      const staffTransactions = transactions.filter(item => Number(item.staffId) === Number(staff.id));
      const kassDays = new Set([
        ...schedules.filter(item => item.staff === staff.name).map(item => item.date),
        ...staffTransactions.filter(item => item.type === "kass").map(item => item.date)
      ]).size;
      const serviceCommission = staffTransactions.filter(item => item.type !== "kass").reduce((sum, item) => sum + item.commission, 0);
      const kassCommission = staffTransactions.filter(item => item.type === "kass").reduce((sum, item) => sum + item.commission, 0);
      return {
        staff,
        transactions: staffTransactions,
        singleCount: staffTransactions.filter(item => item.type === "single").length,
        courseCount: staffTransactions.filter(item => item.type === "course").length,
        kassDays,
        revenue: Math.round(staffTransactions.reduce((sum, item) => sum + item.revenue, 0)),
        serviceCommission,
        kassCommission,
        commission: serviceCommission + kassCommission,
        temporaryCount: staffTransactions.filter(item => item.temporary).length
      };
    });
  return {
    from: fromValue || allDates[0] || "-",
    to: toValue || allDates[allDates.length - 1] || "-",
    periodLabel: fromValue || toValue ? `${fromValue || allDates[0] || "-"} — ${toValue || allDates[allDates.length - 1] || "-"}` : "Бүх хугацаа",
    salon,
    rows,
    singleCount: rows.reduce((sum, row) => sum + row.singleCount, 0),
    courseCount: rows.reduce((sum, row) => sum + row.courseCount, 0),
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    commission: rows.reduce((sum, row) => sum + row.commission, 0)
  };
}

function renderPerformance() {
  const month = document.getElementById("performanceMonth");
  const from = document.getElementById("performanceFrom");
  const to = document.getElementById("performanceTo");
  const salon = document.getElementById("performanceSalon");
  const rows = document.getElementById("performanceRows");
  if (!month || !from || !to || !salon || !rows) return;
  const months = performanceDataMonths();
  let selectedMonth = month.value || months[0] || "";
  month.innerHTML = months.length
    ? months.map(value => `<option value="${value}" ${value === selectedMonth ? "selected" : ""}>${performanceMonthLabel(value)}</option>`).join("")
    : `<option value="">Өгөгдөл алга</option>`;
  if (!month.dataset.ready || !months.includes(selectedMonth)) {
    selectedMonth = months[0] || "";
    month.value = selectedMonth;
    if (selectedMonth) {
      const range = performanceRangeForMonth(selectedMonth);
      from.value = range.from;
      to.value = range.to;
    }
    month.dataset.ready = "1";
  }
  const salons = accountSalons();
  const selectedSalon = isSalonAccount() ? activeAccount.salon : (salon.value || "all");
  salon.innerHTML = `${isSalonAccount() ? "" : `<option value="all">Бүх салбар</option>`}${salons.map(item => `<option value="${item.name}" ${item.name === selectedSalon ? "selected" : ""}>${item.name}</option>`).join("")}`;
  salon.value = selectedSalon;
  salon.disabled = isSalonAccount();
  const report = buildPerformanceReport();
  rows.innerHTML = report.rows.map(row => `
    <tr>
      <td>
        <strong>${row.staff.name}</strong>
        <span class="performance-staff-meta">${row.staff.salon || "Салбаргүй"}${row.temporaryCount ? ` · <b>${row.temporaryCount} түр ажил</b>` : ""}</span>
      </td>
      <td><span class="performance-service-counts">1 удаа: ${row.singleCount} <i>|</i> Курс: ${row.courseCount} оролт <i>|</i> Касс: ${row.kassDays} өдөр</span></td>
      <td class="amount-cell">${money(row.revenue)}</td>
      <td class="amount-cell">${row.serviceCommission ? money(row.serviceCommission) : "—"}</td>
      <td class="amount-cell">${row.kassCommission ? money(row.kassCommission) : "—"}</td>
      <td class="amount-cell performance-total">${money(row.commission)}</td>
      <td><button class="secondary-btn performance-detail-btn" type="button" data-id="${row.staff.id}">Дэлгэрэнгүй</button></td>
    </tr>
  `).join("") || `<tr><td colspan="7"><div class="empty-state">Сонгосон хугацаанд ажилтан олдсонгүй</div></td></tr>`;
  rows.querySelectorAll(".performance-detail-btn").forEach(button => {
    button.addEventListener("click", () => openStaffPerformanceDetail(Number(button.dataset.id)));
  });
  enhanceNativeSelects(["performanceMonth", "performanceSalon"]);
}

function htmlSafe(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function openStaffPerformanceDetail(staffId) {
  const report = buildPerformanceReport();
  const row = report.rows.find(item => Number(item.staff.id) === Number(staffId));
  if (!row) return showToast("Ажилтны мэдээлэл олдсонгүй");
  const branchTotals = row.transactions.reduce((acc, item) => {
    acc[item.salon] = acc[item.salon] || { revenue: 0, commission: 0, count: 0 };
    acc[item.salon].revenue += item.revenue;
    acc[item.salon].commission += item.commission;
    acc[item.salon].count += 1;
    return acc;
  }, {});
  const assignments = state.assignments.filter(item =>
    (Number(item.staffId) === Number(staffId) || item.staff === row.staff.name) && item.startDate <= report.to && item.endDate >= report.from
  );
  const detailWindow = window.open("", "_blank");
  if (!detailWindow) return showToast("Шинэ цонх нээх зөвшөөрөл өгнө үү");
  detailWindow.opener = null;
  detailWindow.document.write(`<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlSafe(row.staff.name)} · Гүйцэтгэл</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&subset=cyrillic&display=swap" rel="stylesheet"><style>
    :root{--accent:#68bd63;--soft:rgba(104,189,99,.12);--text:#1f241f;--muted:#717771;--line:#dde3dd;--bg:#f6f7f6}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:13px Montserrat,Arial,sans-serif}.page{max-width:1320px;margin:0 auto;padding:22px}.head,.panel,.metric{background:#fff;border:1px solid var(--line);border-radius:8px}.head{padding:20px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-top:4px solid var(--accent)}h1{font-size:22px;margin:0 0 7px}.muted{color:var(--muted)}.actions{display:flex;gap:8px}button{height:38px;border-radius:8px;padding:0 14px;font:600 12px Montserrat;border:1px solid var(--line);background:#fff;cursor:pointer}.primary{background:var(--accent);border-color:var(--accent);color:#fff}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:12px 0}.metric{padding:14px}.metric span{display:block;color:var(--muted);font-size:11px;margin-bottom:8px}.metric strong{font-size:17px}.panel{margin-top:12px;padding:16px}h2{font-size:14px;color:var(--accent);margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line)}th{font-size:11px;text-transform:uppercase;color:var(--muted)}td.amount,th.amount{text-align:right}.badge{display:inline-flex;border-radius:999px;padding:4px 8px;background:var(--soft);color:var(--accent);font-size:10px;font-weight:700}.assignment{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}.empty{padding:16px;color:var(--muted);text-align:center}@media(max-width:800px){.metrics{grid-template-columns:1fr 1fr}.page{padding:10px}.head{display:block}.actions{margin-top:12px;overflow:auto}.panel{overflow:auto}}@media print{.actions{display:none}.page{max-width:none;padding:0}body{background:#fff}}
  </style></head><body><main class="page"><section class="head"><div><h1>${htmlSafe(row.staff.name)}</h1><div class="muted">${htmlSafe(row.staff.position || "Ажилтан")} · Үндсэн салбар: ${htmlSafe(row.staff.salon || "-")}</div><div class="muted" style="margin-top:6px">${report.from} — ${report.to} · ${report.salon === "all" ? "Бүх салбар" : htmlSafe(report.salon)}</div></div><div class="actions"><button onclick="window.close()">Хаах</button><button class="primary" onclick="window.print()">Хэвлэх</button></div></section>
  <section class="metrics"><article class="metric"><span>Нэг удаа</span><strong>${row.singleCount}</strong></article><article class="metric"><span>Курсийн оролт</span><strong>${row.courseCount}</strong></article><article class="metric"><span>Касс</span><strong>${row.kassDays} өдөр</strong></article><article class="metric"><span>Нийт төлбөр</span><strong>${money(row.revenue)}</strong></article><article class="metric"><span>Нийт урамшуулал</span><strong>${money(row.commission)}</strong></article></section>
  <section class="panel"><h2>Салбараар</h2><table><thead><tr><th>Салбар</th><th>Ажил</th><th class="amount">Орлого</th><th class="amount">Урамшуулал</th></tr></thead><tbody>${Object.entries(branchTotals).map(([branch, value]) => `<tr><td>${htmlSafe(branch)} ${branch !== row.staff.salon ? '<span class="badge">Түр ажилласан</span>' : ""}</td><td>${value.count}</td><td class="amount">${money(value.revenue)}</td><td class="amount"><strong>${money(value.commission)}</strong></td></tr>`).join("") || '<tr><td colspan="4" class="empty">Гүйцэтгэл бүртгэгдээгүй</td></tr>'}</tbody></table></section>
  <section class="panel"><h2>Гүйцэтгэлийн дэлгэрэнгүй</h2><table><thead><tr><th>Огноо</th><th>Салбар</th><th>Төрөл</th><th>Үйлчилгээ / хэрэглэгч</th><th class="amount">Төлбөр</th><th class="amount">Хувь</th><th class="amount">Урамшуулал</th></tr></thead><tbody>${row.transactions.map(item => `<tr><td>${item.date}</td><td>${htmlSafe(item.salon)} ${item.temporary ? '<span class="badge">Түр томилгоо</span>' : ""}</td><td>${item.type === "course" ? "Курсийн оролт" : item.type === "kass" ? "Касс" : "Нэг удаа"}</td><td>${htmlSafe(item.title)}${item.customer ? `<div class="muted">${htmlSafe(item.customer)}</div>` : ""}</td><td class="amount">${money(item.revenue)}</td><td class="amount">${item.rate}%</td><td class="amount"><strong>${money(item.commission)}</strong></td></tr>`).join("") || '<tr><td colspan="7" class="empty">Сонгосон хугацаанд гүйцэтгэл алга</td></tr>'}</tbody></table></section>
  <section class="panel"><h2>Түр томилгооны түүх</h2>${assignments.map(item => `<div class="assignment"><strong>${htmlSafe(item.from)} → ${htmlSafe(item.to)}</strong><span>${assignmentPeriodText(item)}</span><span class="muted">${htmlSafe(item.reason || "")}</span></div>`).join("") || '<div class="empty">Энэ хугацаанд түр томилгоо байхгүй</div>'}</section></main></body></html>`);
  detailWindow.document.close();
}

function exportPerformanceCsv() {
  const report = buildPerformanceReport();
  const lines = [
    ["Ажилтан", "Үндсэн салбар", "Нэг удаа", "Курсийн оролт", "Касс өдөр", "Нийт төлбөр", "Үйлчилгээний урамшуулал", "Кассын урамшуулал", "Нийт урамшуулал"],
    ...report.rows.map(row => [row.staff.name, row.staff.salon || "", row.singleCount, row.courseCount, row.kassDays, row.revenue, row.serviceCommission, row.kassCommission, row.commission])
  ];
  const csv = `\uFEFF${lines.map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `guitsetgel-${report.from}-${report.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Гүйцэтгэлийн Excel файл бэлтгэгдлээ");
}

function renderServicePaymentSummary(item, paid, historyIndex) {
  const total = serviceTotalAmount(item);
  const balance = Number(item.balance || 0);
  const paidAmount = servicePaidAmount(item);
  const overpaid = Math.max(0, paidAmount - total);
  const extras = item.kind === "course" ? courseVisitExtras(item) : {
    vipRoomFee: Number(item.vipRoomFee || 0),
    masterStaffFee: Number(item.masterStaffFee || 0)
  };
  const basePrice = Number(item.basePrice || item.price || item.total || 0);
  const paymentChips = renderPaymentHistoryChips(item);
  return `
    <div class="profile-payment-summary">
      <span>Үндсэн үнэ <strong>${money(basePrice)}</strong></span>
      ${extras.masterStaffFee ? `<span>Мастер массажист <strong>${money(extras.masterStaffFee)}</strong></span>` : ""}
      ${extras.vipRoomFee ? `<span>Вип өрөө <strong>${money(extras.vipRoomFee)}</strong></span>` : ""}
      <span class="payment-total">Нийт үнэ <strong>${money(total)}</strong></span>
      ${overpaid ? `<span class="payment-overpaid">Илүү төлөлт <strong>${money(overpaid)}</strong></span>` : (balance ? `<span class="red">Үлдэгдэл <strong>${money(balance)}</strong></span>` : `<span>Төлбөр хаагдсан</span>`)}
      ${balance ? `<button class="secondary-btn profile-payment-open" type="button" data-history-index="${historyIndex}"><span>Төлбөр төлөх</span><span class="payment-open-arrow">${item.paymentFormOpen ? "↑" : "↓"}</span></button>` : ""}
    </div>
    ${item.paymentFormOpen ? renderInlinePaymentForm(item, historyIndex, balance) : ""}
    ${paymentChips}
  `;
}

function renderPaymentHistoryChips(item = {}) {
  const payments = Array.isArray(item.payments) ? item.payments : [];
  if (!payments.length) return "";
  return `
    <div class="payment-history-chips">
      ${payments.map(payment => {
        const label = payment.methodLabel || paymentMethodOptionsLabel(payment.method) || "Төлбөр";
        const time = payment.createdAt || payment.date || "";
        const paidAmount = Number(payment.paidAmount ?? payment.amount ?? 0);
        const displayAmount = paidAmount || Number(payment.amount || payment.bonusAmount || 0);
        const bonusText = payment.bonusAmount && paidAmount > 0 ? ` + бонус ${money(payment.bonusAmount)}` : "";
        const reference = payment.referenceLabel ? ` · ${payment.referenceLabel}` : "";
        return `<span class="payment-history-chip">${money(displayAmount)} ${label}${reference}${bonusText}${time ? ` · ${time}` : ""}</span>`;
      }).join("")}
    </div>
  `;
}

function paymentMethodOptionsLabel(value = "") {
  const labels = {
    card: "Карт",
    qpay: "QPay",
    transfer: "Данс",
    cash: "Бэлэн",
    loan_app: "Зээлийн апп",
    voucher: "Ваучер",
    gift_card: "Бэлгийн карт",
    salary: "Цалингаас суутгах"
  };
  return labels[value] || "";
}

function paymentMethodOptions(selected = "card") {
  const methods = [
    ["card", "Карт"],
    ["qpay", "QPay"],
    ["transfer", "Данс"],
    ["cash", "Бэлэн"],
    ["loan_app", "Зээлийн апп"],
    ["voucher", "Ваучер"],
    ["gift_card", "Бэлгийн карт"],
    ["salary", "Цалингаас суутгах"]
  ];
  return methods.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function voucherRoleOptions(selected = "") {
  return state.voucherRoles.map(role => {
    const label = `${role.name}${role.position ? ` · ${role.position}` : ""}`;
    return `<option value="${role.id}" ${String(role.id) === String(selected) ? "selected" : ""}>${label}</option>`;
  }).join("");
}

function findGiftCard(number = "") {
  const q = String(number || "").trim().toLowerCase();
  if (!q) return null;
  return state.giftCards.find(card => String(card.cardNumber || "").toLowerCase() === q) || null;
}

function giftCardPaymentMessage(number = "") {
  const card = findGiftCard(number);
  if (!String(number || "").trim()) return "";
  if (!card) return `<span class="danger">Карт олдсонгүй</span>`;
  if (giftCardStatus(card) === "inactive") return `<span class="danger">Идэвхгүй карт</span>`;
  if (giftCardStatus(card) === "used" || Number(card.remainingAmount || 0) <= 0) return `<span class="danger">Үлдэгдэлгүй карт</span>`;
  return `<span>Үлдэгдэл: <strong>${money(card.remainingAmount)}</strong> · Хэрэглээнд тооцогдоно, бонус бодогдохгүй.</span>`;
}

function renderPaymentMethodExtra(method = "card", item = {}) {
  const voucherId = item.pendingVoucherRoleId || "";
  const voucherNote = item.pendingVoucherNote || "";
  const giftCardNumber = item.pendingGiftCardNumber || "";
  return `
    <div class="inline-payment-extra ${method === "voucher" || method === "gift_card" ? "show" : ""}">
      <label class="inline-voucher-field ${method === "voucher" ? "" : "hidden"}">Эрх сонгох
        <select class="input inline-payment-voucher-role">${voucherRoleOptions(voucherId)}</select>
      </label>
      <label class="inline-voucher-note-field ${method === "voucher" ? "" : "hidden"}">Тайлбар
        <input class="input inline-payment-voucher-note" type="text" value="${voucherNote}" placeholder="Тайлбар">
      </label>
      <label class="inline-gift-card-field ${method === "gift_card" ? "" : "hidden"}">Картын дугаар
        <input class="input inline-payment-gift-card" type="text" value="${giftCardNumber}" placeholder="Картын дугаар">
      </label>
      ${method === "gift_card" ? `<div class="inline-payment-extra-note">${giftCardPaymentMessage(giftCardNumber)}</div>` : ""}
    </div>
  `;
}

function renderInlinePaymentForm(item, historyIndex, balance) {
  const amount = Math.max(0, Number(balance || 0));
  const customer = selectedCustomer();
  const bonus = groupBonusInfo(customerGroup(customer));
  const bonusAlreadyUsed = (item.payments || []).some(payment => Number(payment.bonusAmount || 0) > 0);
  const availableBonus = bonusAlreadyUsed ? 0 : Math.max(0, Math.min(Number(bonus?.balance || 0), Math.floor(serviceTotalAmount(item) * 0.5), amount));
  const selectedMethod = "card";
  return `
    <form class="inline-payment-form" data-history-index="${historyIndex}">
      <div class="inline-payment-grid">
        <div class="inline-bonus-row ${bonusAlreadyUsed ? "disabled" : ""}">
          <label>Бонус ашиглах
            <input class="input inline-payment-bonus money-input" type="text" inputmode="numeric" data-max="${availableBonus}" value="${moneyInputValue(availableBonus)}" placeholder="${bonusAlreadyUsed ? "Бонус ашигласан" : `${money(availableBonus)} хүртэл`}" ${availableBonus <= 0 ? "disabled" : ""}>
          </label>
          <button class="secondary-btn inline-bonus-apply" type="button" aria-pressed="false" ${availableBonus <= 0 ? "disabled" : ""}>БОНУС</button>
        </div>
        <label class="inline-payment-amount-field">Дүн ₮
          <input class="input inline-payment-amount money-input" type="text" inputmode="numeric" data-max="${amount}" value="${moneyInputValue(amount)}" placeholder="Төлөх дүн" required>
        </label>
        <label class="inline-payment-date-field">Огноо
          <input class="input inline-payment-date" type="date" value="${todayText()}" required>
        </label>
        <label class="inline-payment-method-field">Төлбөрийн арга
          <select class="input inline-payment-method">${paymentMethodOptions(selectedMethod)}</select>
        </label>
        <button class="primary-btn" type="submit" ${amount <= 0 ? "disabled" : ""}>Хадгалах</button>
      </div>
      ${renderPaymentMethodExtra(selectedMethod, item)}
    </form>
  `;
}

function visitStatusIcons(visit = {}) {
  const diagnosis = visit.diagnosis || {};
  const hasNote = Boolean((diagnosis.types || []).length || diagnosis.note);
  const hasGeneral = (diagnosis.generalPhotos || []).some(Boolean);
  const hasScope = (diagnosis.scopePhotos || []).some(Boolean);
  const hasSignature = visit.signed || visit.qr === "Баталгаажсан" || visit.qrStatus === "Баталгаажсан";
  return [
    hasNote ? noteStatusIcon() : "",
    hasGeneral ? generalPhotoStatusIcon() : "",
    hasScope ? scopePhotoStatusIcon() : "",
    hasSignature ? signatureStatusIcon() : ""
  ].filter(Boolean).join("");
}

function profileServiceStats(customer) {
  const history = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  const single = history.filter(item => item.kind === "single").length;
  const course = history.filter(item => item.kind === "course" || String(item.title || "").includes("курс")).length;
  const kass = history.filter(item => item.kind === "product" || item.kind === "kass").length;
  const totalPaid = history.reduce((sum, item) => sum + servicePaidAmount(item), 0);
  const totalBalance = customerBalance(customer);
  return { single, course, kass, totalPaid, totalBalance };
}

function bonusProgressPercent(spent) {
  const tiers = pricePolicy().bonusTiers
    .slice()
    .sort((a, b) => Number(a.threshold) - Number(b.threshold));
  const value = Math.max(0, Number(spent || 0));
  const currentIndex = Math.max(0, tiers.findLastIndex(tier => value >= Number(tier.threshold || 0)));
  const current = tiers[currentIndex];
  const next = tiers[currentIndex + 1];
  if (!next) return 100;
  const span = Math.max(1, Number(next.threshold || 0) - Number(current.threshold || 0));
  return Math.max(0, Math.min(100, ((value - Number(current.threshold || 0)) / span) * 100));
}

function nextBonusTierInfo(spent) {
  const currentPercent = bonusPercentForSpent(spent);
  const nextTier = pricePolicy().bonusTiers
    .slice()
    .sort((a, b) => Number(a.threshold) - Number(b.threshold))
    .find(tier => Number(tier.percent) > Number(currentPercent));
  if (!nextTier) return { missing: 0, nextPercent: currentPercent };
  return {
    missing: Math.max(0, Number(nextTier.threshold || 0) - Number(spent || 0)),
    nextPercent: Number(nextTier.percent)
  };
}

function groupPeriodInfo(group) {
  const start = group?.startedAt || group?.createdAt || state.customers.find(customer => Number(customer.id) === Number(group?.adminCustomerId))?.registeredAt || todayText();
  const used = Math.max(0, Math.min(730, daysBetween(start, todayText())));
  const left = Math.max(0, 730 - used);
  const end = new Date(`${start}T00:00:00`);
  if (Number.isNaN(end.getTime())) return { used: 0, left: 730, endDate: "—", percent: 0 };
  end.setDate(end.getDate() + 730);
  return { used, left, endDate: end.toISOString().slice(0, 10), percent: Math.min(100, (used / 730) * 100) };
}

function orderedGroupMembers(group) {
  const members = groupMembers(group);
  const adminId = Number(group?.adminCustomerId);
  return [
    ...members.filter(member => Number(member.id) === adminId),
    ...members.filter(member => Number(member.id) !== adminId)
  ];
}

function deletedCustomers() {
  return state.customers
    .filter(customer => customer.deleted || customer.deletedAt)
    .sort((a, b) => String(b.deletedAt || "").localeCompare(String(a.deletedAt || "")) || String(a.name || "").localeCompare(String(b.name || "")));
}

function renderDeletedCustomerDirectory() {
  const rows = document.getElementById("groupDeletedCustomerRows");
  if (!rows) return;
  const customers = deletedCustomers();
  const count = document.getElementById("groupDeletedTabCount");
  if (count) count.textContent = customers.length;
  rows.innerHTML = customers.map(customer => `
    <tr>
      <td><strong>${htmlSafe(customer.name || "—")}</strong></td>
      <td>${htmlSafe(customer.phone || "—")}</td>
      <td>${htmlSafe(customer.salon || "—")}</td>
      <td>${htmlSafe(customer.deletedAt || "—")}</td>
      <td>${htmlSafe(customer.deletedBy || "Менежер")}</td>
      <td>
        <div class="table-actions deleted-customer-actions">
          <button class="danger-btn icon-danger deleted-customer-permanent-delete" type="button" data-customer-id="${customer.id}" aria-label="Бүр мөсөн устгах" title="Бүр мөсөн устгах">${trashIcon()}</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-state">Устгасан хэрэглэгч байхгүй</td></tr>`;
  rows.querySelectorAll(".deleted-customer-permanent-delete").forEach(button => {
    button.addEventListener("click", () => permanentlyDeleteCustomer(Number(button.dataset.customerId)));
  });
}

function permanentlyDeleteCustomer(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId) && (item.deleted || item.deletedAt));
  if (!customer) return;
  if (!requireDeleteCode()) return;
  state.customerGroups.forEach(group => {
    group.members = (group.members || []).filter(id => Number(id) !== Number(customer.id));
    if (Number(group.adminCustomerId) === Number(customer.id)) group.adminCustomerId = null;
  });
  state.permanentlyDeletedCustomerIds = Array.from(new Set([...(state.permanentlyDeletedCustomerIds || []).map(Number), Number(customer.id)]));
  state.customers = state.customers.filter(item => Number(item.id) !== Number(customer.id));
  if (Number(state.selectedCustomerId) === Number(customer.id)) {
    state.selectedCustomerId = state.customers.find(item => !item.deleted && !item.deletedAt)?.id || null;
  }
  state.audit.unshift({ title: "customer_permanently_deleted", meta: `Менежер • ${customer.name || "—"} • ${customer.phone || ""}` });
  saveState();
  renderCustomers();
  renderCustomerSideProfile();
  renderProfile();
  renderGroupDirectory();
  renderAudit();
  renderInfoHeader(activeView);
  showToast("Хэрэглэгч бүр мөсөн устлаа");
}

function renderGroupDirectory() {
  const view = document.getElementById("groupsView");
  if (!view) return;
  if (!document.getElementById("groupDirectoryList")) {
    view.innerHTML = `
      <div class="group-section-tabs service-settings-tabs" role="tablist" aria-label="Группийн хэсэг">
        <button class="group-section-tab service-main-tab active" type="button" role="tab" data-group-tab="directory" aria-selected="true">Группүүд <span id="groupDirectoryTabCount">0</span></button>
        <button class="group-section-tab service-main-tab" type="button" role="tab" data-group-tab="deleted" aria-selected="false">Устгасан хэрэглэгч <span id="groupDeletedTabCount">0</span></button>
      </div>
      <section class="panel group-tab-panel group-directory-panel" id="groupDirectoryTabPanel" role="tabpanel">
        <div class="group-directory-toolbar">
          <div class="group-directory-search-row">
            <input class="input" id="groupDirectorySearch" placeholder="8 оронтой дугаар" inputmode="numeric" maxlength="8" aria-label="Групп эсвэл гишүүний утсаар хайх">
            <select class="input" id="groupDirectoryStatusFilter" aria-label="Группийн төлөв">
              <option value="all">Бүх төлөв</option>
              <option value="with_members">Гишүүнтэй</option>
              <option value="without_members">Гишүүнгүй</option>
            </select>
            <button class="secondary-btn group-directory-search-clear" id="groupDirectorySearchClear" type="button" aria-label="Хайлтыг цэвэрлэх">×</button>
          </div>
        </div>
        <div class="group-directory-list" id="groupDirectoryList"></div>
      </section>
      <section class="panel group-tab-panel group-deleted-panel hidden" id="groupDeletedTabPanel" role="tabpanel">
        <div class="table-wrap group-deleted-table-wrap">
          <table class="booking-table group-deleted-table">
            <thead>
              <tr><th>Нэр</th><th>Утас</th><th>Салбар</th><th>Устгасан огноо</th><th>Устгасан</th><th>Үйлдэл</th></tr>
            </thead>
            <tbody id="groupDeletedCustomerRows"></tbody>
          </table>
        </div>
      </section>
    `;
    view.querySelectorAll(".group-section-tab").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.dataset.groupTab;
        view.querySelectorAll(".group-section-tab").forEach(item => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        document.getElementById("groupDirectoryTabPanel")?.classList.toggle("hidden", tab !== "directory");
        document.getElementById("groupDeletedTabPanel")?.classList.toggle("hidden", tab !== "deleted");
        if (tab === "deleted") renderDeletedCustomerDirectory();
      });
    });
    document.getElementById("groupDirectorySearch")?.addEventListener("input", event => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
      renderGroupDirectory();
    });
    document.getElementById("groupDirectoryStatusFilter")?.addEventListener("change", () => renderGroupDirectory());
    document.getElementById("groupDirectorySearchClear")?.addEventListener("click", () => {
      const input = document.getElementById("groupDirectorySearch");
      const status = document.getElementById("groupDirectoryStatusFilter");
      if (input) input.value = "";
      if (status) {
        status.value = "all";
        syncNativeSelectProxy(status);
      }
      renderGroupDirectory();
      input?.focus();
    });
    enhanceNativeSelects(["groupDirectoryStatusFilter"]);
  }

  const list = document.getElementById("groupDirectoryList");
  const search = String(document.getElementById("groupDirectorySearch")?.value || "").trim().toLowerCase();
  const memberStatus = document.getElementById("groupDirectoryStatusFilter")?.value || "all";
  const groups = state.customerGroups
    .map(group => ({ group, members: orderedGroupMembers(group) }))
    .filter(({ group, members }) => {
      if (memberStatus === "all") return true;
      const hasActiveMember = members.some(member => !member.deleted && Number(member.id) !== Number(group.adminCustomerId));
      return memberStatus === "with_members" ? hasActiveMember : !hasActiveMember;
    })
    .filter(({ group, members }) => !search || [
      group.name,
      ...members.filter(member => !member.deleted).flatMap(member => [member.name, member.phone])
    ].some(value => String(value || "").toLowerCase().includes(search)))
    .sort((a, b) => Number(b.group.spent2y || 0) - Number(a.group.spent2y || 0));
  const groupCount = document.getElementById("groupDirectoryTabCount");
  if (groupCount) groupCount.textContent = state.customerGroups.length;
  renderDeletedCustomerDirectory();

  list.innerHTML = groups.length ? `
    <div class="table-wrap group-list-table-wrap">
      <table class="group-list-table">
        <thead>
          <tr>
            <th>Групп нэр</th>
            <th>Админ нэр</th>
            <th>Гишүүн</th>
            <th>2 жилийн хэрэглээ</th>
            <th>Бонус %</th>
            <th>Нийт бонус</th>
            <th>Ашигласан</th>
            <th>Үлдэгдэл</th>
            <th aria-label="Дэлгэрүүлэх"></th>
          </tr>
        </thead>
        <tbody>
          ${groups.map(({ group, members }) => {
            const bonus = groupBonusInfo(group);
            const admin = state.customers.find(customer => Number(customer.id) === Number(group.adminCustomerId));
            const regularMembers = members.filter(member => !member.deleted && Number(member.id) !== Number(group.adminCustomerId));
            const activeMemberCount = regularMembers.length;
            const editingName = Boolean(group.directoryEditingName && group.directoryExpanded);
            const expanded = Boolean(group.directoryExpanded);
            return `
              <tr class="group-list-row ${expanded ? "expanded" : ""}">
                <td>
                  ${editingName ? `
                    <form class="group-directory-name-form group-list-name-form" data-group-id="${group.id}">
                      <input class="input group-directory-name-input" value="${htmlSafe(group.name || "")}" inputmode="numeric" maxlength="8" aria-label="Группийн нэр">
                      <button class="primary-btn group-list-save" type="submit">Хадгалах</button>
                      <button class="secondary-btn icon-action group-list-cancel group-directory-name-cancel" type="button" data-group-id="${group.id}" aria-label="Болих">×</button>
                    </form>
                  ` : `
                    <div class="group-list-name">
                      <strong>${htmlSafe(group.name || "Нэргүй")}</strong>
                      ${expanded ? `<button class="secondary-btn icon-action group-list-edit group-directory-edit" type="button" data-group-id="${group.id}" aria-label="Групп засах" title="Групп засах">${editIcon()}</button>` : ""}
                    </div>
                  `}
                </td>
                <td><span class="group-list-admin">${htmlSafe(admin?.name || "—")}</span></td>
                <td>${activeMemberCount}</td>
                <td>${money(bonus?.spent || 0)}</td>
                <td>${bonus?.percent || 0}%</td>
                <td>${money(bonus?.pool || 0)}</td>
                <td>${money(bonus?.used || 0)}</td>
                <td><strong class="group-list-balance">${money(bonus?.balance || 0)}</strong></td>
                <td>
                  <button class="group-list-expand" type="button" data-group-id="${group.id}" aria-expanded="${expanded}" aria-label="Гишүүдийг ${expanded ? "хураах" : "дэлгэх"}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
                  </button>
                </td>
              </tr>
              ${expanded ? `
                <tr class="group-list-detail-row">
                  <td colspan="9">
                    <div class="group-list-detail">
                      <div class="group-list-members">
                        ${regularMembers.map(member => `
                          <div class="group-list-member">
                            <div class="group-list-member-info">
                              <strong>${htmlSafe(member.name)}</strong>
                              <span>${htmlSafe(member.phone || "—")}</span>
                            </div>
                            <button class="secondary-btn icon-action group-list-member-remove group-member-directory-remove" type="button" data-member-id="${member.id}" aria-label="Гишүүн хасах">×</button>
                          </div>
                        `).join("") || `<span class="group-list-empty">Одоогоор өөр гишүүнгүй</span>`}
                      </div>
                      <form class="group-directory-add-form group-list-add-form" data-admin-id="${admin?.id || ""}" data-group-id="${group.id}">
                        <input class="input group-directory-add-input" placeholder="Гишүүний утас" inputmode="numeric" maxlength="8" aria-label="Гишүүний утасны дугаар">
                        <button class="secondary-btn" type="submit">Нэмэх</button>
                        <div class="group-list-suggestions hidden"></div>
                      </form>
                    </div>
                  </td>
                </tr>
              ` : ""}
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="empty-state">Хайлтад тохирох групп олдсонгүй</div>`;

  list.querySelectorAll(".group-member-open").forEach(button => {
    button.addEventListener("click", () => {
      if (!button.dataset.customerId) return;
      state.selectedCustomerId = Number(button.dataset.customerId);
      setView("profile");
    });
  });
  list.querySelectorAll(".group-list-expand").forEach(button => {
    button.addEventListener("click", () => {
      const group = state.customerGroups.find(item => Number(item.id) === Number(button.dataset.groupId));
      if (!group) return;
      const shouldExpand = !group.directoryExpanded;
      state.customerGroups.forEach(item => {
        item.directoryExpanded = false;
        delete item.directoryEditingName;
      });
      group.directoryExpanded = shouldExpand;
      renderGroupDirectory();
    });
  });
  list.querySelectorAll(".group-directory-edit").forEach(button => {
    button.addEventListener("click", () => {
      const group = state.customerGroups.find(item => Number(item.id) === Number(button.dataset.groupId));
      if (!group) return;
      state.customerGroups.forEach(item => delete item.directoryEditingName);
      group.directoryEditingName = true;
      renderGroupDirectory();
      document.querySelector(`.group-directory-name-form[data-group-id="${group.id}"] .group-directory-name-input`)?.focus();
    });
  });
  list.querySelectorAll(".group-directory-name-cancel").forEach(button => {
    button.addEventListener("click", () => {
      const group = state.customerGroups.find(item => Number(item.id) === Number(button.dataset.groupId));
      if (group) delete group.directoryEditingName;
      renderGroupDirectory();
    });
  });
  list.querySelectorAll(".group-directory-name-form").forEach(form => {
    const input = form.querySelector(".group-directory-name-input");
    input?.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 8); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const group = state.customerGroups.find(item => Number(item.id) === Number(form.dataset.groupId));
      const name = String(input?.value || "").trim();
      if (!group) return;
      if (!/^\d{8}$/.test(name)) {
        showToast("Группийн нэр 8 оронтой дугаар байна");
        return;
      }
      if (!requireEditCode()) return;
      group.name = name;
      delete group.directoryEditingName;
      state.audit.unshift({ title: "group_updated", meta: `Менежер • Групп ${name}` });
      saveState();
      renderGroupDirectory();
      renderAudit();
      showToast("Группийн мэдээлэл хадгалагдлаа");
    });
  });
  list.querySelectorAll(".group-directory-add-form").forEach(form => {
    const input = form.querySelector(".group-directory-add-input");
    const suggestions = form.querySelector(".group-list-suggestions");
    const renderSuggestions = () => {
      if (!input || !suggestions) return;
      const phone = input.value.trim();
      const candidates = state.customers
        .filter(item => !item.deleted && !item.deletedAt)
        .filter(item => Number(item.id) !== Number(form.dataset.adminId))
        .filter(item => !item.groupId && !isCustomerInAnyGroup(item.id))
        .filter(item => !phone || String(item.phone || "").includes(phone))
        .slice(0, 8);
      suggestions.innerHTML = candidates.length ? candidates.map(item => `
        <button class="group-list-suggestion" type="button" data-member-id="${item.id}">
          <strong>${htmlSafe(item.name)}</strong>
          <span>${htmlSafe(item.phone || "—")}</span>
        </button>
      `).join("") : `<span class="group-list-suggestion-empty">Группгүй хэрэглэгч олдсонгүй</span>`;
      suggestions.classList.remove("hidden");
      suggestions.querySelectorAll(".group-list-suggestion").forEach(button => {
        button.addEventListener("click", () => {
          const admin = state.customers.find(item => Number(item.id) === Number(form.dataset.adminId));
          if (!admin) return;
          addCustomerToCurrentGroup(admin.id, Number(button.dataset.memberId));
          renderGroupDirectory();
        });
      });
    };
    input?.addEventListener("focus", renderSuggestions);
    input?.addEventListener("click", renderSuggestions);
    input?.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 8);
      renderSuggestions();
    });
    input?.addEventListener("blur", () => {
      setTimeout(() => suggestions?.classList.add("hidden"), 150);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const phone = String(input?.value || "").trim();
      const admin = state.customers.find(item => Number(item.id) === Number(form.dataset.adminId));
      const member = state.customers.find(item => !item.deleted && !item.deletedAt && String(item.phone || "") === phone);
      if (!/^\d{8}$/.test(phone)) {
        showToast("8 оронтой утасны дугаар оруулна уу");
        return;
      }
      if (!member) {
        showToast("Ийм утасны дугаартай хэрэглэгч олдсонгүй");
        return;
      }
      if (member.groupId || isCustomerInAnyGroup(member.id)) {
        showToast("Энэ хэрэглэгч аль хэдийн группт байна");
        return;
      }
      if (!admin) return;
      addCustomerToCurrentGroup(admin.id, member.id);
      renderGroupDirectory();
    });
  });
  list.querySelectorAll(".group-member-directory-remove").forEach(button => {
    button.addEventListener("click", () => {
      leaveCustomerGroup(Number(button.dataset.memberId));
      renderGroupDirectory();
    });
  });
}

function collapseCustomerServicePanels(customer) {
  if (!customer) return;
  customer.profileServiceOpen = false;
  delete customer.profileServiceEditingIndex;
  delete customer.profileServiceEditMode;
  (customer.serviceHistory || []).forEach(item => {
    item.expandedVisit = null;
    item.diagnosisViewVisit = null;
    item.paymentFormOpen = false;
    item.diagnosisOpen = false;
  });
}

function isCustomerInfoEditable(customer) {
  return Boolean(customer);
}

function requireCustomerEditCodeIfExpired(customer) {
  return requireEditCode();
}

function isCustomerInAnyGroup(customerId) {
  return (state.customerGroups || []).some(group =>
    Number(group.adminCustomerId) === Number(customerId) ||
    (group.members || []).some(id => Number(id) === Number(customerId))
  );
}

function renderInlineJoinGroup(customer) {
  return `
    <div class="inline-join-group">
      <label>Групп хайх
        <input class="input" id="inlineJoinGroupSearch" placeholder="Утас эсвэл группийн нэр" inputmode="numeric" maxlength="8">
      </label>
      <div class="join-group-results" id="inlineJoinGroupResults"></div>
    </div>
  `;
}

function renderInlineJoinGroupResults(customer) {
  const box = document.getElementById("inlineJoinGroupResults");
  const input = document.getElementById("inlineJoinGroupSearch");
  if (!box || !input) return;
  const q = input.value.trim().toLowerCase();
  const groups = state.customerGroups
    .filter(group => (group.members || []).length)
    .filter(group => !q || String(group.name || "").toLowerCase().includes(q))
    .slice(0, q ? 8 : 3);
  box.innerHTML = groups.map(group => `
    <button class="join-group-item inline-join-group-item" type="button" data-id="${group.id}">
      <strong>${group.name}</strong><span>${groupMembers(group).length} гишүүн</span>
    </button>
  `).join("") || `<div class="empty-state">Групп олдсонгүй</div>`;
  box.querySelectorAll(".inline-join-group-item").forEach(button => {
    button.addEventListener("click", () => {
      const group = state.customerGroups.find(item => Number(item.id) === Number(button.dataset.id));
      if (!group || customer.groupId) return;
      if (!requireCustomerEditCodeIfExpired(customer)) return;
      group.members = Array.from(new Set([...(group.members || []), customer.id]));
      customer.groupId = group.id;
      customer.groupRole = "member";
      customer.profileJoinGroupOpen = false;
      saveAndRefreshCustomerProfile("Группт нэгдлээ");
    });
  });
}

function bindInlineJoinGroup(customer) {
  const input = document.getElementById("inlineJoinGroupSearch");
  if (!input) return;
  input.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
    renderInlineJoinGroupResults(customer);
  });
  renderInlineJoinGroupResults(customer);
}

function renderProfileGroupPanel(customer, group, bonusInfo) {
  if (!group) {
    const joining = Boolean(customer.profileJoinGroupOpen);
    return `
      <section class="profile-side-card">
        <div class="profile-card-title">Групп</div>
        <div class="empty-state profile-empty-action">
          <span>Групп үүсгээгүй байна</span>
          <div class="group-actions split">
            <button class="secondary-btn" id="profileCreateGroupBtn" type="button">Групп үүсгэх</button>
            <button class="secondary-btn ${joining ? "active" : ""}" id="profileJoinGroupBtn" type="button">Группт нэгдэх</button>
          </div>
          ${joining ? renderInlineJoinGroup(customer) : ""}
        </div>
      </section>
    `;
  }
  const editingName = Boolean(group.editingName);
  const adminCustomer = state.customers.find(item => Number(item.id) === Number(group.adminCustomerId));
  const hasNameWarning = adminCustomer?.phone && String(group.name || "") !== String(adminCustomer.phone || "");
  return `
    <section class="profile-side-card">
      <div class="profile-card-head compact">
        <div class="profile-card-title">Групп: ${group.name}</div>
        <button class="secondary-btn icon-action" id="profileEditGroupNameBtn" type="button" aria-label="Групп нэр засах">${editIcon()}</button>
      </div>
      ${editingName ? `
        <form id="profileGroupNameForm" class="profile-side-actions group-name-form">
          <input class="input" id="profileGroupNameInput" value="${group.name || ""}" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" required>
          <button class="primary-btn" type="submit">Хадгалах</button>
        </form>
      ` : ""}
      ${hasNameWarning ? `<div class="profile-warning-text">Групп нэр admin хэрэглэгчийн утастай ижил байх ёстой.</div>` : ""}
      <div class="profile-member-list">
        ${orderedGroupMembers(group).map(member => `
          <span><strong>${member.name}</strong><em>${Number(group.adminCustomerId) === Number(member.id) ? "Админ · " : ""}${member.phone || ""}</em><button class="danger-btn icon-clear group-member-remove" type="button" data-member-id="${member.id}" aria-label="Группээс гаргах">×</button></span>
        `).join("")}
      </div>
      <div class="profile-side-actions">
        <input class="input" id="profileGroupPhone" placeholder="Утасны дугаар" inputmode="numeric" maxlength="8">
        <button class="secondary-btn" id="profileAddGroupMemberBtn" type="button">Нэмэх</button>
      </div>
      <div class="profile-suggestion-list" id="profileGroupSuggestions"></div>

    </section>
  `;
}

function renderProfileInfoPanel(customer) {
  const editing = Boolean(customer.profileInfoEditing);
  return `
    <section class="profile-side-card">
      <div class="profile-card-head">
        <div>
          <div class="profile-card-title">Хэрэглэгчийн мэдээлэл</div>
          <strong class="profile-customer-name">${customer.name}</strong>
        </div>
        <button class="secondary-btn icon-action" id="profileEditInfoBtn" type="button" aria-label="Засах">${editIcon()}</button>
      </div>
      <div class="profile-info-list">
        <div><span>Утас</span><strong>${customer.phone || "—"}</strong></div>
        <div><span>Төрөл</span><strong>${customer.type || "—"}</strong></div>
        <div><span>Нас</span><strong>${customerAge(customer) || "—"}</strong></div>
        <div><span>Хүйс</span><strong>${customer.gender || "—"}</strong></div>
        <div><span>Дүүрэг</span><strong>${customer.district || "—"}</strong></div>
        <div><span>Хороо</span><strong>${customer.khoroo || "—"}</strong></div>
      </div>
      ${editing ? `
        <form id="profileInfoForm" class="profile-info-form">
          <label><span>Нэр</span><input class="input" id="profileInfoName" value="${customer.name || ""}" required></label>
          <label><span>Утас</span><input class="input" id="profileInfoPhone" value="${customer.phone || ""}" inputmode="numeric" maxlength="8" required></label>
          <label><span>Нас</span><input class="input" id="profileInfoAge" type="number" min="0" value="${customerAge(customer) || ""}" required></label>
          <label><span>Хүйс</span><select class="input" id="profileInfoGender"><option ${customer.gender === "Эмэгтэй" ? "selected" : ""}>Эмэгтэй</option><option ${customer.gender === "Эрэгтэй" ? "selected" : ""}>Эрэгтэй</option></select></label>
          <label><span>Дүүрэг</span><select class="input" id="profileInfoDistrict" required>${districtOptions(customer.district || "")}</select></label>
          <label><span>Хороо</span><input class="input" id="profileInfoKhoroo" value="${customer.khoroo || ""}" required></label>
          <label><span>Төрөл</span><select class="input" id="profileInfoType">${customerTypeOptions(customer.type || "Хэрэглэгч")}</select></label>
          <div class="profile-info-actions">
            <button class="danger-btn icon-danger" id="profileDeleteCustomerBtn" type="button" aria-label="Устгах">${trashIcon()}</button>
            <button class="primary-btn" type="submit">Хадгалах</button>
          </div>
        </form>
      ` : ""}
    </section>
  `;
}

function kassSaleThreshold(item = {}) {
  const match = String(item.saleNote || "").match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 0;
}

function kassHasSpecialPrice(item = {}) {
  return kassSaleThreshold(item) > 0 && Number(item.sale || 0) > 0 && Number(item.sale) < Number(item.price || 0);
}

function kassLineUnitPrice(item = {}, quantity = 1) {
  const threshold = kassSaleThreshold(item);
  return kassHasSpecialPrice(item) && Number(quantity) >= threshold
    ? Number(item.sale)
    : Number(item.price || 0);
}

function kassCartTotal(cart = []) {
  return cart.reduce((sum, item) => sum + kassLineUnitPrice(item, item.qty) * Math.max(1, Number(item.qty || 1)), 0);
}

function renderProfileKassCartBox(cart = []) {
  const total = kassCartTotal(cart);
  return `
    ${cart.length ? cart.map((item, index) => {
      const qty = Math.max(1, Number(item.qty || 1));
      const threshold = kassSaleThreshold(item);
      const special = kassHasSpecialPrice(item) && qty >= threshold;
      const unitPrice = kassLineUnitPrice(item, qty);
      return `
        <div class="profile-kass-cart-row">
          <div class="profile-kass-cart-name">
            <strong>${item.name}</strong>
            <span class="${special ? "discounted" : ""}">${special ? `<s>${money(item.price)}</s> ${money(unitPrice)}` : money(unitPrice)}${kassHasSpecialPrice(item) ? ` <small>(${threshold}+-ш: ${money(item.sale)})</small>` : ""}</span>
          </div>
          <div class="slot-stepper profile-kass-qty-stepper" aria-label="Тоо ширхэг">
            <button class="secondary-btn slot-step-btn profile-kass-qty-step" type="button" data-cart-index="${index}" data-delta="-1" aria-label="Тоо хасах">−</button>
            <input class="input slot-count-input profile-kass-qty" type="text" value="${qty}" readonly aria-label="Тоо ширхэг">
            <button class="secondary-btn slot-step-btn profile-kass-qty-step" type="button" data-cart-index="${index}" data-delta="1" aria-label="Тоо нэмэх">+</button>
          </div>
          <strong class="profile-kass-line-total">${money(unitPrice * qty)}</strong>
          <button class="profile-kass-remove" type="button" data-cart-index="${index}" aria-label="Бараа хасах">×</button>
        </div>
      `;
    }).join("") : `<div class="profile-kass-empty">Зүүн талаас бараа сонгоно уу</div>`}
    <div class="profile-kass-total"><span>Нийт</span><strong>${money(total)}</strong></div>
  `;
}

function renderProfileKassInlineForm(customer) {
  const editingIndex = Number.isInteger(customer.profileKassEditingIndex) ? customer.profileKassEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const salonAccount = isSalonAccount();
  const selectedGroup = customer.profileKassGroup && serviceSettingsData.products[customer.profileKassGroup]
    ? customer.profileKassGroup
    : editingItem?.products?.[0]?.group || productGroups[0]?.[0];
  customer.profileKassGroup = selectedGroup;
  if (!Array.isArray(customer.profileKassCart) && editingItem) {
    customer.profileKassCart = (editingItem.products || []).map(product => ({
      group: product.group || selectedGroup,
      code: product.code || "",
      name: product.name,
      price: Number(product.price || product.unitPrice || 0),
      sale: Number(product.sale || 0),
      saleNote: product.saleNote || "",
      qty: Math.max(1, Number(product.qty || 1))
    }));
  }
  const cart = Array.isArray(customer.profileKassCart) ? customer.profileKassCart : [];
  const products = serviceSettingsData.products[selectedGroup] || [];
  const selectedSalon = customer.profileKassDraftSalon ?? editingItem?.salon ?? (salonAccount ? activeAccount.salon : "");
  const selectedDate = customer.profileKassDraftDate || editingItem?.date || todayText();
  return `
    <form id="profileServiceForm" class="profile-inline-service-form profile-kass-form" data-kind="kass" novalidate>
      <div class="service-modal-tabs">
        <button class="service-modal-tab" type="button" data-kind="single">Нэг удаа</button>
        <button class="service-modal-tab" type="button" data-kind="course">Курс</button>
        <button class="service-modal-tab active" type="button" data-kind="kass">Касс</button>
      </div>
      <div class="profile-kass-meta">
        <label>Огноо
          <input class="input" id="profileKassDate" type="date" value="${selectedDate}" required>
        </label>
        <label>Салбар
          <select class="input" id="profileKassSalon" required ${salonAccount ? "disabled" : ""}>
            <option value="">Салбар сонгох</option>
            ${state.salons.filter(salon => !salonAccount || salon.name === activeAccount.salon).map(salon => `<option value="${salon.name}" ${salon.name === selectedSalon ? "selected" : ""}>${salon.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="profile-kass-layout">
        <section class="profile-kass-catalog">
          <div class="profile-kass-section-title">Бараа сонгох</div>
          <div class="profile-kass-groups">
            ${productGroups.map(([key, label]) => `
              <button class="profile-kass-group ${key === selectedGroup ? "active" : ""}" type="button" data-group="${key}">${label}</button>
            `).join("")}
          </div>
          <div class="profile-kass-products">
            ${products.length ? products.map((item, index) => {
              const threshold = kassSaleThreshold(item);
              return `
                <button class="profile-kass-product" type="button" data-product-index="${index}">
                  <span>${item.name}</span>
                  <strong>${money(item.price)}</strong>
                  ${kassHasSpecialPrice(item) ? `<small>${threshold}+-ш: ${money(item.sale)}</small>` : ""}
                </button>
              `;
            }).join("") : `<div class="empty-state">Энэ ангилалд бараа алга</div>`}
          </div>
        </section>
        <section class="profile-kass-cart">
          <div class="profile-kass-section-title">Сонгосон бараа</div>
          <div class="profile-kass-cart-box">
            ${renderProfileKassCartBox(cart)}
          </div>
        </section>
      </div>
      <div class="profile-kass-submit-row">
        ${editingItem ? `<button class="secondary-btn profile-kass-cancel-edit" type="button">Болих</button>` : ""}
        <button class="primary-btn" type="submit" ${cart.length ? "" : "disabled"}>${editingItem ? "Касс шинэчлэх" : "Касс нэмэх"}</button>
      </div>
    </form>
  `;
}

function renderProfileServiceInlineForm(customer) {
  const showSalon = ["admin", "manager"].includes(activeAccount.role);
  const editingIndex = Number.isInteger(customer.profileServiceEditingIndex) ? customer.profileServiceEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const kind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
  if (!editingItem && kind === "kass") return renderProfileKassInlineForm(customer);
  const diagnosisOnly = Boolean(editingItem && customer.profileServiceEditMode === "diagnosis");
  if (diagnosisOnly) {
    return `
      <form id="profileServiceForm" class="profile-inline-service-form profile-diagnosis-only-form" data-kind="single" novalidate>
        ${diagnosisFormHtml("profileService", true)}
        <div class="profile-service-submit-row">
          <div></div>
          <div class="form-actions">
            <button class="secondary-btn icon-clear profile-service-cancel-edit" type="button" aria-label="Засахыг болих">×</button>
            <button class="primary-btn" type="submit">Оношилгоо хадгалах</button>
          </div>
        </div>
      </form>
    `;
  }
  const options = serviceOptionsForKind(kind, customer);
  const selectedOptionIndex = editingItem
    ? Math.max(0, options.findIndex(option => standardServiceName(option.name, kind) === standardServiceName(editingItem.service || editingItem.title, kind)))
    : 0;
  const selectedSalon = editingItem?.salon || "";
  const selectedStaff = editingItem?.staff || "";
  const selectedRoom = editingItem?.vipRoom || editingItem?.room === "vip" ? "vip" : "standard";
  return `
    <form id="profileServiceForm" class="profile-inline-service-form" data-kind="${kind}" novalidate>
      ${editingItem ? "" : `<div class="service-modal-tabs">
        <button class="service-modal-tab ${kind === "single" ? "active" : ""}" type="button" data-kind="single">Нэг удаа</button>
        <button class="service-modal-tab ${kind === "course" ? "active" : ""}" type="button" data-kind="course">Курс</button>
        <button class="service-modal-tab" type="button" data-kind="kass">Касс</button>
      </div>`}
      <div class="customer-service-grid profile-service-row">
        <label class="service-select-field">Үйлчилгээ
          <select class="input" id="profileServiceSelect">${serviceOptionHtml(kind, selectedOptionIndex, customer)}</select>
        </label>
        <label>Огноо
          <input class="input" id="profileServiceDate" type="date" value="${editingItem?.date || todayText()}" required>
        </label>
        ${showSalon ? `<label>Салбар<select class="input" id="profileServiceSalon"><option value="">Салбар сонгох</option>${state.salons.map(s => `<option value="${s.name}" ${s.name === selectedSalon ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>` : ""}
        ${kind === "course" ? "" : `
          <label>Ажилтан
            <select class="input" id="profileServiceStaff" required>${showSalon ? staffOptionHtmlForSalon(selectedSalon, selectedStaff, editingItem?.date || todayText()) : staffOptionHtmlForSalon(activeAccount.salon, selectedStaff, editingItem?.date || todayText())}</select>
          </label>
          <label>Өрөө
            <select class="input" id="profileServiceRoom">
              <option value="standard" ${selectedRoom === "standard" ? "selected" : ""}>Энгийн</option>
              <option value="vip" ${selectedRoom === "vip" ? "selected" : ""}>Вип</option>
            </select>
          </label>
        `}
      </div>
      ${kind === "course" ? "" : `
        <button class="secondary-btn diagnosis-expand-btn" id="profileServiceDiagnosisToggle" type="button"><span>Оношилгоо</span><i></i></button>
        ${diagnosisFormHtml("profileService")}
      `}
      <div class="profile-service-submit-row">
        <div id="profileServicePrice" class="profile-service-price-breakdown"></div>
        <div class="form-actions">
          ${editingItem ? `<button class="secondary-btn icon-clear profile-service-cancel-edit" type="button" aria-label="Засахыг болих">×</button>` : ""}
          <button class="primary-btn" type="submit">${editingItem ? "Үйлчилгээ шинэчлэх" : "Үйлчилгээ бүртгэх"}</button>
        </div>
      </div>
    </form>
  `;
}
function renderCourseVisitInlineForm(item, historyIndex, visitNumber) {
  const existing = (item.visits || []).find(visit => Number(visit.number) === Number(visitNumber));
  const previousStaff = existing?.staff || item.visits?.[0]?.staff || item.staff || "";
  const salon = existing?.salon || (isSalonAccount() ? activeAccount.salon : (item.salon || activeAccount.salon));
  const prefix = `courseVisit${historyIndex}_${visitNumber}`;
  const room = existing?.room || "standard";
  return `
    <form class="course-visit-inline-form" data-history-index="${historyIndex}" data-visit="${visitNumber}" data-prefix="${prefix}" data-mode="${existing ? "edit" : "create"}">
      <div class="customer-service-grid course-visit-row">
        <label>Огноо<input class="input course-visit-date" type="date" value="${existing?.date || todayText()}" required></label>
        <label>Салбар<select class="input course-visit-salon" id="${prefix}Salon" required ${isSalonAccount() ? "disabled" : ""}>${accountSalons().map(item => `<option value="${item.name}" ${item.name === salon ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>
        <label>Ажилтан<select class="input course-visit-staff" id="${prefix}Staff" required>${staffOptionHtmlForSalon(salon, previousStaff, existing?.date || todayText())}</select></label>
        <label>Өрөө<select class="input course-visit-room" id="${prefix}Room"><option value="standard" ${room === "standard" ? "selected" : ""}>Энгийн</option><option value="vip" ${room === "vip" ? "selected" : ""}>Вип</option></select></label>
        <button class="primary-btn" type="submit">${existing ? "Оролт шинэчлэх" : "Оролт бүртгэх"}</button>
      </div>
      <div class="course-visit-action-tabs">
        <button class="secondary-btn diagnosis-expand-btn" id="${prefix}DiagnosisToggle" type="button"><span>Оношилгоо</span><i></i></button>
        <button class="secondary-btn course-visit-confirm ${existing?.signed ? "confirmed" : ""}" type="button" ${existing?.signed ? "disabled" : ""}>
          <span>${existing?.signed ? "Үйлчилгээ баталгаажсан" : "Үйлчилгээг батлах"}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 17c3-8 5-11 7-11 2 0-1 8-3 11-1 2 1 2 3 0l2-3c-1 3 0 4 2 3l2-2c-1 2 0 3 2 2h4"/></svg>
        </button>
      </div>
      ${diagnosisFormHtml(prefix)}
      <div class="course-signature-panel hidden">
        <div class="course-signature-head">
          <strong>Хэрэглэгчийн гарын үсэг</strong>
          <span>Доорх талбарт хулгана эсвэл touch-оор зурна</span>
        </div>
        <canvas class="course-signature-canvas" width="900" height="300"></canvas>
        <div class="course-signature-actions">
          <button class="secondary-btn course-signature-clear" type="button">Цэвэрлэх</button>
          <button class="primary-btn course-signature-submit" type="button">Зурж илгээх</button>
        </div>
      </div>
    </form>
  `;
}

function renderCourseSlots(item, historyIndex) {
  const total = Number(item.visitsTotal || parseInt(item.visits, 10) || 4);
  const visits = Array.isArray(item.visits) ? item.visits : [];
  const expandedVisit = Number(item.expandedVisit || 0);
  const diagnosisViewVisit = Number(item.diagnosisViewVisit || 0);
  const columns = 4;
  const rows = [];
  for (let start = 1; start <= total; start += columns) {
    const numbers = Array.from({ length: Math.min(columns, total - start + 1) }, (_, i) => start + i);
    const expandedInRow = numbers.includes(expandedVisit) ? expandedVisit : 0;
    const diagnosisInRow = numbers.includes(diagnosisViewVisit) ? diagnosisViewVisit : 0;
    rows.push(`
      <div class="course-slot-row">
        <div class="course-slot-grid">
          ${numbers.map(number => {
            const visit = visits.find(v => Number(v.number) === number);
            const expanded = expandedVisit === number;
            const locked = visit && !isServiceEditable(visit);
            return `
              <div class="course-slot-card ${visit ? "done" : ""} ${expanded ? "active" : ""} ${locked ? "locked" : ""}">
                <button class="course-slot-btn" type="button" data-history-index="${historyIndex}" data-visit="${number}" data-filled="${visit ? "true" : "false"}">
                  <strong>${number}</strong>
                  <span>${visit ? visit.date : "Оролт нэмэх"}</span>
                  ${visit ? `<small>${visit.staff || "Ажилтан сонгоогүй"}</small>` : ""}
                  ${visit ? `<em class="course-slot-icons">${visitStatusIcons(visit)}</em>` : ""}
                </button>
                ${visit ? `<button class="secondary-btn icon-action course-slot-edit" type="button" data-history-index="${historyIndex}" data-visit="${number}" aria-label="Засах" ${locked ? "disabled" : ""}>${editIcon()}</button>` : ""}
              </div>
            `;
          }).join("")}
        </div>
        ${expandedInRow ? `<div class="course-visit-form-wrap" style="--slot-index:${numbers.indexOf(expandedInRow)}">${renderCourseVisitInlineForm(item, historyIndex, expandedInRow)}</div>` : ""}
        ${diagnosisInRow ? `<div class="course-visit-form-wrap course-diagnosis-view" style="--slot-index:${numbers.indexOf(diagnosisInRow)}">${renderCourseVisitSummary(visits.find(visit => Number(visit.number) === diagnosisInRow) || {})}</div>` : ""}
      </div>
    `);
  }
  return `
    <div class="course-slot-panel">
      ${rows.join("")}
    </div>
  `;
}

function bindCourseVisitInlineForms(customer) {
  document.querySelectorAll(".course-visit-inline-form").forEach(form => {
    const prefix = form.dataset.prefix;
    enhanceNativeSelects(Array.from(form.querySelectorAll(".course-visit-salon, .course-visit-staff, .course-visit-room")).map(select => select.id).filter(Boolean));
    bindDiagnosisControls(prefix);
    const historyIndex = Number(form.dataset.historyIndex);
    const visitNumber = Number(form.dataset.visit);
    const course = customer.serviceHistory?.[historyIndex];
    const existingVisit = (course?.visits || []).find(item => Number(item.number) === Number(visitNumber));
    hydrateDiagnosisForm(prefix, existingVisit?.diagnosis);
    bindCourseVisitSignature(form, existingVisit);
    form.querySelector(".course-visit-salon")?.addEventListener("change", event => {
      const staffSelect = form.querySelector(".course-visit-staff");
      if (!staffSelect) return;
      staffSelect.innerHTML = staffOptionHtmlForSalon(event.target.value, "", form.querySelector(".course-visit-date")?.value || todayText());
      enhanceNativeSelects([staffSelect.id]);
    });
    form.querySelector(".course-visit-date")?.addEventListener("change", event => {
      const staffSelect = form.querySelector(".course-visit-staff");
      if (!staffSelect) return;
      const salon = form.querySelector(".course-visit-salon")?.value || activeAccount.salon;
      staffSelect.innerHTML = staffOptionHtmlForSalon(salon, staffSelect.value, event.target.value || todayText());
      enhanceNativeSelects([staffSelect.id]);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const historyIndex = Number(form.dataset.historyIndex);
      const visitNumber = Number(form.dataset.visit);
      const course = customer.serviceHistory?.[historyIndex];
      if (!course) return;
      const existingVisit = (course.visits || []).find(item => Number(item.number) === Number(visitNumber));
      if (existingVisit && form.dataset.mode !== "edit") {
        showToast("Бүртгэлтэй оролтыг засах товчоор засна");
        return;
      }
      if (existingVisit && !isServiceEditable(existingVisit)) {
        showToast("Оролт засах хугацаа дууссан байна");
        return;
      }
      const room = form.querySelector(".course-visit-room")?.value || "standard";
      const salon = form.querySelector(".course-visit-salon")?.value || activeAccount.salon;
      if (!salon || !canAccessSalon(salon)) return showToast("Салбар сонгоно уу");
      const policy = pricePolicy();
      const vipRoomFee = room === "vip" ? Number(policy.vipRoomFee || 0) : 0;
      const staff = form.querySelector(".course-visit-staff")?.value || "";
      const masterStaffFee = isMasterStaffName(staff) ? Number(policy.masterStaffFee || 0) : 0;
      const oldExtra = Number(existingVisit?.vipRoomFee || 0) + Number(existingVisit?.masterStaffFee || 0);
      const newExtra = vipRoomFee + masterStaffFee;
      const visit = {
        number: visitNumber,
        date: form.querySelector(".course-visit-date")?.value || todayText(),
        salon,
        staff,
        room,
        vipRoom: room === "vip",
        vipRoomFee,
        masterStaffFee,
        extraTotal: newExtra,
        createdAt: existingVisit?.createdAt || todayText(),
        diagnosis: readDiagnosisPayload(prefix),
        signed: form.dataset.confirming === "true" ? true : Boolean(existingVisit?.signed),
        signature: form.dataset.confirming === "true" ? form.dataset.signature : (existingVisit?.signature || null),
        signedAt: form.dataset.confirming === "true" ? new Date().toISOString() : (existingVisit?.signedAt || null)
      };
      course.price = Math.max(0, Number(course.price || course.basePrice || 0) + newExtra - oldExtra);
      course.balance = Math.max(0, Number(course.balance || 0) + newExtra - oldExtra);
      course.visits = (course.visits || []).filter(item => Number(item.number) !== Number(visitNumber));
      course.visits.push(visit);
      course.visits.sort((a, b) => Number(a.number) - Number(b.number));
      course.staff = visit.staff;
      course.expandedVisit = null;
      const done = course.visits.length;
      customer.course = `Курс ${done}/${course.visitsTotal}`;
      customer.activeCourse = done < Number(course.visitsTotal || 0);
      customer.currentTreatment = currentTreatmentFromHistory(customer, { ...course, salon: visit.salon, staff: visit.staff, date: visit.date, diagnosis: visit.diagnosis }, `Курс ${visitNumber}/${course.visitsTotal}`);
      customer.last = visit.date;
      saveAndRefreshCustomerProfile(form.dataset.confirming === "true" ? "Үйлчилгээ гарын үсгээр баталгаажлаа" : "Курсийн оролт бүртгэгдлээ");
    });
  });
}

function bindCourseVisitSignature(form, existingVisit = null) {
  const openButton = form.querySelector(".course-visit-confirm");
  const panel = form.querySelector(".course-signature-panel");
  const canvas = form.querySelector(".course-signature-canvas");
  if (!openButton || !panel || !canvas || existingVisit?.signed) return;
  const context = canvas.getContext("2d");
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#172017";
  let drawing = false;
  let hasInk = false;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  canvas.addEventListener("pointerdown", event => {
    drawing = true;
    hasInk = true;
    canvas.setPointerCapture?.(event.pointerId);
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
  });
  const stopDrawing = () => {
    drawing = false;
    context.closePath();
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("pointerleave", stopDrawing);
  openButton.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    openButton.classList.toggle("active", !panel.classList.contains("hidden"));
    const diagnosisPanel = form.querySelector(".service-diagnosis-panel");
    if (diagnosisPanel) {
      diagnosisPanel.classList.add("hidden");
    }
    form.querySelector(".diagnosis-expand-btn")?.classList.remove("active");
  });
  form.querySelector(".course-signature-clear")?.addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
  });
  form.querySelector(".course-signature-submit")?.addEventListener("click", () => {
    if (!hasInk) return showToast("Гарын үсгээ зурна уу");
    form.dataset.signature = canvas.toDataURL("image/png");
    form.dataset.confirming = "true";
    form.requestSubmit();
  });
}

function renderCourseVisitSummary(visit = {}) {
  const signature = typeof visit.signature === "string" && visit.signature.startsWith("data:image/")
    ? `<div class="course-signature-summary"><strong>Хэрэглэгчийн гарын үсэг</strong><button class="diagnosis-photo-thumb" type="button" aria-label="Гарын үсэг томоор харах"><img src="${visit.signature}" alt="Хэрэглэгчийн гарын үсэг"></button><span>${visit.signedAt ? new Date(visit.signedAt).toLocaleString("mn-MN") : "Баталгаажсан"}</span></div>`
    : (visit.signed ? `<div class="course-signature-summary"><strong>Хэрэглэгчийн гарын үсэг</strong><span>Баталгаажсан</span></div>` : "");
  return `${renderDiagnosisSummary(visit.diagnosis || {})}${signature}`;
}

function renderDiagnosisSummary(diagnosis) {
  const types = diagnosis.types || [];
  const note = String(diagnosis.note || "").trim();
  const noteParts = note.split(",").map(item => item.trim()).filter(Boolean);
  const noteOnlyRepeatsTypes = noteParts.length > 0 && noteParts.every(item => types.includes(item));
  const chips = types.length
    ? types.map(type => `<span class="payment-history-chip">${type}</span>`).join("")
    : (note ? `<span class="payment-history-chip">${note}</span>` : `<span class="payment-history-chip">Онош сонгоогүй</span>`);
  const photoThumbs = (photos = [], label = "Оношилгооны зураг") => photos
    .filter(photo => typeof photo === "string" && photo.trim())
    .map((photo, index) => `<button class="diagnosis-photo-thumb" type="button" aria-label="${label} ${index + 1} томоор харах"><img src="${photo}" alt="${label} ${index + 1}" loading="lazy"></button>`)
    .join("");
  const generalThumbs = photoThumbs(diagnosis.generalPhotos || [], "Үсний байрлал");
  const scopeThumbs = photoThumbs(diagnosis.scopePhotos || [], "Хуйх, уг");
  return `
    <div class="diagnosis-summary-box">
      <div class="diagnosis-summary-title">Онош</div>
      <div class="payment-history-chips diagnosis-history-chips">
        ${chips}
        ${note && types.length && !noteOnlyRepeatsTypes ? `<span class="payment-history-chip">${note}</span>` : ""}
      </div>
      <div class="photo-summary-grid">
        <div><strong>Үсний байрлал</strong><span>${(diagnosis.generalPhotos || []).filter(Boolean).length}/5 зураг</span>${generalThumbs ? `<div class="diagnosis-photo-thumbs">${generalThumbs}</div>` : ""}</div>
        <div><strong>Хуйх, уг</strong><span>${(diagnosis.scopePhotos || []).filter(Boolean).length}/5 зураг</span>${scopeThumbs ? `<div class="diagnosis-photo-thumbs">${scopeThumbs}</div>` : ""}</div>
      </div>
    </div>
  `;
}

function bindDiagnosisPhotoPreview(root = document) {
  root?.querySelectorAll(".diagnosis-photo-thumb").forEach(button => {
    button.addEventListener("click", () => {
      const image = button.querySelector("img");
      const source = image?.getAttribute("src") || "";
      const label = image?.getAttribute("alt") || "Оношилгооны зураг";
      showDiagnosisPhotoPreview(source, label);
    });
  });
}

function showDiagnosisPhotoPreview(source = "", label = "Оношилгооны зураг") {
  if (!source) return;
  openModal(
    "Оношилгооны зураг",
    label,
    `<div class="diagnosis-large-image"><img src="${source}" alt="${htmlSafe(label)}"></div><div class="form-actions"><button class="secondary-btn" id="cancelModal" type="button">Хаах</button></div>`,
    () => {
      document.querySelector("#modalBackdrop .modal")?.classList.add("diagnosis-image-modal");
      document.getElementById("cancelModal")?.addEventListener("click", closeModal);
    }
  );
}

function serviceHasPayment(item = {}) {
  const payments = Array.isArray(item.payments) ? item.payments : [];
  return payments.some(payment => Number(payment.amount || 0) > 0 || Number(payment.paidAmount || 0) > 0 || Number(payment.bonusAmount || 0) > 0);
}

function isServiceWithinEditDays(item = {}) {
  const allowed = Number(generalSettings().serviceEditDays || 3);
  return daysBetween(item.createdAt || item.date || todayText(), todayText()) <= allowed;
}

function isServiceEditable(item) {
  return isServiceWithinEditDays(item) && !serviceHasPayment(item);
}

function profileServiceEditMode(item = {}) {
  if (!isServiceWithinEditDays(item)) return "locked";
  if (item.kind === "course" && Array.isArray(item.visits) && item.visits.length > 0) return "locked";
  if (serviceHasPayment(item)) return item.kind === "single" ? "diagnosis" : "locked";
  return "full";
}

function isServiceDeletable(item) {
  return isServiceWithinEditDays(item);
}

function renderProfile() {
  const shell = document.getElementById("profileShell");
  if (!shell) return;
  const customer = state.customers.find(c => c.id === state.selectedCustomerId && !c.deleted) || state.customers.find(c => !c.deleted);
  if (!customer) {
    shell.innerHTML = `<div class="empty-state">Хэрэглэгч алга</div>`;
    return;
  }
  const group = customerGroup(customer);
  const bonusInfo = groupBonusInfo(group);
  const stats = profileServiceStats(customer);
  const bonus = bonusInfo || {
    spent: Number(customer.spent || 0),
    percent: Number.parseFloat(customerBonusPercent(customer)) || 2,
    pool: Number(customer.balance || 0),
    used: 0,
    balance: Number(customer.balance || 0)
  };
  const period = groupPeriodInfo(group);
  const nextTier = nextBonusTierInfo(bonus.spent);
  const editingService = Number.isInteger(customer.profileServiceEditingIndex);
  const addingService = Boolean(customer.profileServiceOpen && !editingService);
  shell.innerHTML = `
    <section class="profile-content-grid">
      <section class="profile-service-column">
        <button class="profile-add-bar ${addingService ? "active" : ""}" id="profileAddServiceTop" type="button"><span>Үйлчилгээ нэмэх</span><i></i></button>
        ${addingService ? renderProfileServiceInlineForm(customer) : ""}
        <div id="historyList" class="profile-service-list">${renderCustomerServiceHistory(customer)}</div>
      </section>
      <aside class="profile-side-column">
        ${renderProfileInfoPanel(customer)}
        ${renderProfileGroupPanel(customer, group, bonus)}
        <section class="profile-side-card profile-bonus-card">
          <div class="profile-card-title">Групп бонус</div>
          <strong>${money(bonus.balance)}</strong>
          <div class="bonus-line-head"><span>${bonus.percent}%</span><span>${money(nextTier.missing)} дутуу → ${nextTier.nextPercent}%</span></div>
          <div class="bonus-line"><i style="width:${bonusProgressPercent(bonus.spent)}%"></i></div>
          <div class="group-period-box in-bonus">
            <div><span>Дахин тооцох хугацаа</span><strong>${period.used}/730 өдөр</strong></div>
            <div class="group-period-line"><i style="width:${period.percent}%"></i></div>
          </div>
          <div class="profile-mini-stat"><span>2 жилийн зарцуулалт</span><strong>${money(bonus.spent)}</strong></div>
          <div class="profile-mini-stat"><span>Нийт цугларсан бонус</span><strong>${money(bonus.pool)}</strong></div>
          <div class="profile-mini-stat"><span>Ашигласан дүн</span><strong>${money(bonus.used)}</strong></div>
          <div class="profile-mini-stat"><span>Нийт төлсөн</span><strong>${money(stats.totalPaid)}</strong></div>
          <div class="profile-mini-stat red"><span>Дутуу төлбөр</span><strong>${money(stats.totalBalance)}</strong></div>
        </section>
      </aside>
    </section>
  `;
  bindDiagnosisPhotoPreview(document.getElementById("historyList"));
  document.getElementById("profileAddServiceTop")?.addEventListener("click", () => {
    const wasOpen = Boolean(customer.profileServiceOpen && !Number.isInteger(customer.profileServiceEditingIndex));
    collapseCustomerServicePanels(customer);
    if (wasOpen) {
      delete customer.profileKassEditingIndex;
      delete customer.profileKassCart;
      delete customer.profileKassDraftSalon;
      delete customer.profileKassDraftDate;
      delete customer.profileKassGroup;
    }
    customer.profileServiceOpen = !wasOpen;
    customer.profileServiceKind = customer.profileServiceKind || "single";
    renderProfile();
  });
  document.getElementById("profileEditInfoBtn")?.addEventListener("click", () => {
    customer.profileInfoEditing = !customer.profileInfoEditing;
    renderProfile();
  });
  bindProfileInfoForm(customer);
  bindProfileServiceInlineForm(customer);
  document.getElementById("profileCreateGroupBtn")?.addEventListener("click", () => createCustomerGroup(customer.id));
  document.getElementById("profileJoinGroupBtn")?.addEventListener("click", () => {
    customer.profileJoinGroupOpen = !customer.profileJoinGroupOpen;
    renderProfile();
  });
  bindInlineJoinGroup(customer);
  document.getElementById("profileEditGroupNameBtn")?.addEventListener("click", () => {
    const group = customerGroup(customer);
    if (!group) return;
    group.editingName = !group.editingName;
    renderProfile();
  });
  document.getElementById("profileGroupNameInput")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("profileGroupNameForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const group = customerGroup(customer);
    if (!group) return;
    if (!requireCustomerEditCodeIfExpired(customer)) return;
    const name = formValue("profileGroupNameInput");
    if (!name) return;
    if (!/^\d{8}$/.test(name)) {
      showToast("Групп нэр 8 оронтой утасны дугаар байна");
      return;
    }
    const adminCustomer = state.customers.find(item => Number(item.id) === Number(group.adminCustomerId));
    if (adminCustomer?.phone && String(name) !== String(adminCustomer.phone)) {
      showToast("Групп нэр admin хэрэглэгчийн утастай ижил байх ёстой");
      return;
    }
    group.name = name;
    group.editingName = false;
    saveAndRefreshCustomerProfile("Групп нэр хадгалагдлаа");
  });
  document.querySelectorAll(".group-member-remove").forEach(button => {
    button.addEventListener("click", () => leaveCustomerGroup(Number(button.dataset.memberId)));
  });
  bindProfileGroupInlineSearch(customer);
  bindCourseVisitInlineForms(customer);
  document.getElementById("historyList")?.querySelectorAll(".course-slot-card").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest(".course-slot-edit")) return;
      const button = card.querySelector(".course-slot-btn");
      if (!button) return;
      if (button.dataset.filled === "true") {
        const historyIndex = Number(button.dataset.historyIndex);
        const visitNumber = Number(button.dataset.visit);
        const item = customer.serviceHistory?.[historyIndex];
        if (!item) return;
        const wasOpen = Number(item.diagnosisViewVisit) === visitNumber;
        collapseCustomerServicePanels(customer);
        if (!wasOpen) item.diagnosisViewVisit = visitNumber;
        renderProfile();
        return;
      }
      const historyIndex = Number(button.dataset.historyIndex);
      const visitNumber = Number(button.dataset.visit);
      const item = customer.serviceHistory?.[historyIndex];
      if (!item) return;
      const wasOpen = Number(item.expandedVisit) === visitNumber;
      collapseCustomerServicePanels(customer);
      if (!wasOpen) item.expandedVisit = visitNumber;
      renderProfile();
    });
  });
  document.getElementById("historyList")?.querySelectorAll(".course-slot-edit").forEach(button => {
    button.addEventListener("click", () => {
      const historyIndex = Number(button.dataset.historyIndex);
      const visitNumber = Number(button.dataset.visit);
      const item = customer.serviceHistory?.[historyIndex];
      if (!item) return;
      const wasOpen = Number(item.expandedVisit) === visitNumber;
      collapseCustomerServicePanels(customer);
      if (!wasOpen) item.expandedVisit = visitNumber;
      renderProfile();
    });
  });
  document.querySelectorAll("#historyList .history-diagnosis-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const item = customer.serviceHistory[Number(button.dataset.historyIndex)];
      if (!item) return;
      const wasOpen = Boolean(item.diagnosisOpen);
      collapseCustomerServicePanels(customer);
      item.diagnosisOpen = !wasOpen;
      renderProfile();
    });
  });
  document.querySelectorAll("#historyList .profile-payment-open").forEach(button => {
    button.addEventListener("click", () => {
      const item = customer.serviceHistory[Number(button.dataset.historyIndex)];
      if (!item) return;
      const wasOpen = Boolean(item.paymentFormOpen);
      collapseCustomerServicePanels(customer);
      item.paymentFormOpen = !wasOpen;
      renderProfile();
    });
  });
  document.querySelectorAll("#historyList .profile-service-edit").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.historyIndex);
      const item = customer.serviceHistory?.[index];
      if (!item) return;
      const editMode = profileServiceEditMode(item);
      if (editMode === "locked") {
        const message = (item.kind === "kass" || item.kind === "product") && serviceHasPayment(item)
          ? "Төлбөр орсон кассыг засах боломжгүй"
          : item.kind === "course" && Array.isArray(item.visits) && item.visits.length
          ? "Эхний оролт бүртгэгдсэн курсийн үндсэн үйлчилгээг засах боломжгүй"
          : serviceHasPayment(item)
            ? "Төлбөр орсон үйлчилгээний зөвхөн оношилгоог засах боломжтой"
            : "Үйлчилгээ засах хугацаа дууссан байна";
        showToast(message);
        return;
      }
      collapseCustomerServicePanels(customer);
      if (item.kind === "kass" || item.kind === "product") {
        customer.profileServiceKind = "kass";
        customer.profileServiceOpen = true;
        customer.profileKassEditingIndex = index;
        delete customer.profileKassCart;
        delete customer.profileKassDraftSalon;
        delete customer.profileKassDraftDate;
        customer.profileKassGroup = item.products?.[0]?.group || productGroups[0]?.[0];
        renderProfile();
        return;
      }
      customer.profileServiceKind = item.kind === "course" ? "course" : "single";
      customer.profileServiceEditMode = editMode;
      customer.profileServiceEditingIndex = index;
      renderProfile();
    });
  });
  bindInlinePaymentForms(customer);
  document.querySelectorAll("#historyList .profile-service-delete").forEach(button => {
    button.addEventListener("click", () => deleteCustomerHistoryItem(customer.id, Number(button.dataset.historyIndex)));
  });
}function bindProfileInfoForm(customer) {
  const form = document.getElementById("profileInfoForm");
  if (!form) return;
  enhanceNativeSelects(["profileInfoGender", "profileInfoDistrict", "profileInfoType"]);
  document.getElementById("profileInfoPhone")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!requireCustomerEditCodeIfExpired(customer)) return;
    const selectedType = document.getElementById("profileInfoType")?.value || "Хэрэглэгч";
    const profileUpdate = {
      name: formValue("profileInfoName"),
      phone: formValue("profileInfoPhone"),
      gender: formValue("profileInfoGender"),
      district: formValue("profileInfoDistrict"),
      khoroo: formValue("profileInfoKhoroo"),
      type: selectedType,
      bonus: `${customerTypeRule(selectedType).bonusPercent}%`
    };
    Object.assign(customer, profileUpdate);
    setCustomerAgeFromInput(customer, formValue("profileInfoAge"));
    profileUpdate.age = customer.age;
    profileUpdate.birthYear = customer.birthYear;
    pendingCustomerProfileUpdates.set(Number(customer.id), {
      ...profileUpdate,
      mutationVersion: localStateMutationVersion + 1
    });
    customer.profileInfoEditing = false;
    const adminGroup = state.customerGroups.find(group => Number(group.adminCustomerId) === Number(customer.id));
    const message = adminGroup && String(adminGroup.name || "") !== String(customer.phone || "")
      ? "Мэдээлэл хадгалагдлаа. Групп нэр утаснаас зөрж байна"
      : "Хэрэглэгчийн мэдээлэл хадгалагдлаа";
    saveAndRefreshCustomerProfile(message);
  });
  document.getElementById("profileDeleteCustomerBtn")?.addEventListener("click", () => deleteProfileCustomer(customer.id));
}

function deleteProfileCustomer(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  if (!customer) return;
  if (customer.groupId || isCustomerInAnyGroup(customerId)) {
    showToast("Групптэй хэрэглэгчийг устгах боломжгүй");
    return;
  }
  if (!requireDeleteCode()) return;
  customer.deletedAt = todayText();
  customer.deletedBy = "Менежер";
  customer.deleted = true;
  customer.profileInfoEditing = false;
  state.selectedCustomerId = state.customers.find(item => !item.deleted && !item.deletedAt)?.id || null;
  state.audit.unshift({ title: "customer_deleted", meta: `Менежер • ${customer.name} • ${customer.phone || ""}` });
  saveState();
  renderCustomers();
  renderCustomerSideProfile();
  renderProfile();
  renderAudit();
  renderInfoHeader(activeView);
  showToast("Хэрэглэгч устлаа");
}

function leaveCustomerGroup(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const group = customerGroup(customer);
  if (!customer || !group) return;
  if (!requireDeleteCode()) return;
  group.members = (group.members || []).filter(id => Number(id) !== Number(customer.id));
  if (Number(group.adminCustomerId) === Number(customer.id)) group.adminCustomerId = null;
  customer.groupId = null;
  customer.groupRole = null;
  saveAndRefreshCustomerProfile("Хэрэглэгч группээс гарлаа");
}
function selectedCustomer() {
  return state.customers.find(customer => Number(customer.id) === Number(state.selectedCustomerId) && !customer.deleted) || state.customers.find(customer => !customer.deleted);
}

function isChildCustomer(customer) {
  const limit = Number(document.getElementById("childAgeLimit")?.value || 9);
  const age = Number(customerAge(customer));
  return age > 0 && age <= limit;
}

function serviceAudienceForCustomer(customer) {
  return isChildCustomer(customer) ? "Хүүхэд" : "Том хүн";
}

function staffByName(name = "") {
  return state.staff.find(staff => staff.name === name);
}

function isMasterStaffName(name = "") {
  const staff = staffByName(name);
  return Boolean(staff && (staff.vip || String(staff.position || "").toLowerCase().includes("мастер")));
}

function profileServicePriceParts(customer) {
  const editingIndex = Number.isInteger(customer.profileServiceEditingIndex) ? customer.profileServiceEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const kind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
  const item = serviceOptionsForKind(kind, customer)[Number(document.getElementById("profileServiceSelect")?.value || 0)];
  const policy = pricePolicy();
  const basePrice = Number(item?.price || 0);
  const vipRoom = formValue("profileServiceRoom") === "vip";
  const vipRoomFee = vipRoom ? Number(policy.vipRoomFee || 0) : 0;
  const masterStaffFee = isMasterStaffName(formValue("profileServiceStaff")) ? Number(policy.masterStaffFee || 0) : 0;
  return {
    item,
    basePrice,
    vipRoom,
    vipRoomFee,
    masterStaffFee,
    total: basePrice + vipRoomFee + masterStaffFee
  };
}

function profileServicePriceBreakdownHtml(price) {
  if (!price.item) return "";
  const extraRows = [
    price.masterStaffFee ? `<div><span>Мастер массажист</span><strong>${money(price.masterStaffFee)}</strong></div>` : "",
    price.vipRoomFee ? `<div><span>Вип өрөө</span><strong>${money(price.vipRoomFee)}</strong></div>` : ""
  ].filter(Boolean).join("");
  return `
    <div class="price-breakdown-lines">
      <div><span>Үндсэн үнэ</span><strong>${money(price.basePrice)}</strong></div>
      ${extraRows}
      <div class="price-breakdown-total"><span>Нийт</span><strong>${money(price.total)}</strong></div>
    </div>
  `;
}

function updateProfileServicePrice(customer) {
  const price = profileServicePriceParts(customer);
  const target = document.getElementById("profileServicePrice");
  if (target) target.innerHTML = profileServicePriceBreakdownHtml(price);
}

function bindProfileKassCartControls(customer, form) {
  form.querySelectorAll(".profile-kass-qty-step").forEach(button => {
    button.addEventListener("click", () => {
      const item = customer.profileKassCart?.[Number(button.dataset.cartIndex)];
      if (!item) return;
      item.qty = Math.max(1, Math.floor(Number(item.qty || 1)) + Number(button.dataset.delta || 0));
      refreshProfileKassCart(customer, form);
    });
  });
  form.querySelectorAll(".profile-kass-remove").forEach(button => {
    button.addEventListener("click", () => {
      customer.profileKassCart?.splice(Number(button.dataset.cartIndex), 1);
      refreshProfileKassCart(customer, form);
    });
  });
}

function refreshProfileKassCart(customer, form) {
  const cart = Array.isArray(customer.profileKassCart) ? customer.profileKassCart : [];
  const cartBox = form.querySelector(".profile-kass-cart-box");
  if (cartBox) cartBox.innerHTML = renderProfileKassCartBox(cart);
  const submitButton = form.querySelector('.profile-kass-submit-row button[type="submit"]');
  if (submitButton) submitButton.disabled = !cart.length;
  bindProfileKassCartControls(customer, form);
}

function bindProfileKassInlineForm(customer, form) {
  enhanceNativeSelects(["profileKassSalon"]);
  form.querySelectorAll(".service-modal-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      delete customer.profileKassEditingIndex;
      delete customer.profileKassCart;
      delete customer.profileKassGroup;
      delete customer.profileKassDraftSalon;
      delete customer.profileKassDraftDate;
      customer.profileServiceKind = tab.dataset.kind || "single";
      customer.profileServiceOpen = true;
      renderProfile();
    });
  });
  form.querySelectorAll(".profile-kass-group").forEach(button => {
    button.addEventListener("click", () => {
      customer.profileKassDraftSalon = form.querySelector("#profileKassSalon")?.value || "";
      customer.profileKassDraftDate = form.querySelector("#profileKassDate")?.value || todayText();
      customer.profileKassGroup = button.dataset.group;
      renderProfile();
    });
  });
  form.querySelectorAll(".profile-kass-product").forEach(button => {
    button.addEventListener("click", () => {
      const group = customer.profileKassGroup || productGroups[0]?.[0];
      const product = serviceSettingsData.products[group]?.[Number(button.dataset.productIndex)];
      if (!product) return;
      customer.profileKassCart = Array.isArray(customer.profileKassCart) ? customer.profileKassCart : [];
      const existing = customer.profileKassCart.find(item => item.group === group && item.code === product.code && item.name === product.name);
      if (existing) {
        existing.qty = Math.max(1, Number(existing.qty || 1)) + 1;
      } else {
        customer.profileKassCart.push({
          group,
          code: product.code || "",
          name: product.name,
          price: Number(product.price || 0),
          sale: Number(product.sale || 0),
          saleNote: product.saleNote || "",
          qty: 1
        });
      }
      refreshProfileKassCart(customer, form);
    });
  });
  bindProfileKassCartControls(customer, form);
  form.querySelector(".profile-kass-cancel-edit")?.addEventListener("click", () => {
    delete customer.profileKassEditingIndex;
    delete customer.profileKassCart;
    delete customer.profileKassGroup;
    delete customer.profileKassDraftSalon;
    delete customer.profileKassDraftDate;
    customer.profileServiceKind = "single";
    customer.profileServiceOpen = false;
    renderProfile();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const cart = Array.isArray(customer.profileKassCart) ? customer.profileKassCart : [];
    if (!cart.length) {
      showToast("Бараа сонгоно уу");
      return;
    }
    if (!customer.groupId) {
      showToast("Эхлээд групп үүсгэх эсвэл группт нэгтгэнэ");
      return;
    }
    const salon = formValue("profileKassSalon");
    if (!salon) {
      showToast("Салбар сонгоно уу");
      return;
    }
    const date = formValue("profileKassDate") || todayText();
    const products = cart.map(item => {
      const qty = Math.max(1, Math.floor(Number(item.qty || 1)));
      const unitPrice = kassLineUnitPrice(item, qty);
      return {
        group: item.group,
        code: item.code || "",
        name: item.name,
        qty,
        price: Number(item.price || 0),
        sale: Number(item.sale || 0),
        saleNote: item.saleNote || "",
        unitPrice,
        lineTotal: unitPrice * qty,
        specialPriceApplied: unitPrice < Number(item.price || 0)
      };
    });
    const total = products.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const editingIndex = Number.isInteger(customer.profileKassEditingIndex) ? customer.profileKassEditingIndex : null;
    const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
    const historyItem = {
      kind: "kass",
      title: "Касс",
      service: "Касс",
      date,
      createdAt: editingItem?.createdAt || todayText(),
      staff: "Касс",
      salon,
      products,
      price: total,
      basePrice: total,
      balance: total,
      paymentMethod: "",
      payments: editingItem?.payments || [],
      paymentFormOpen: true
    };
    collapseCustomerServicePanels(customer);
    customer.serviceHistory = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
    if (editingItem) customer.serviceHistory[editingIndex] = historyItem;
    else customer.serviceHistory.unshift(historyItem);
    customer.unpaid = customerBalance(customer) > 0;
    customer.last = date;
    delete customer.profileKassCart;
    delete customer.profileKassGroup;
    delete customer.profileKassEditingIndex;
    delete customer.profileKassDraftSalon;
    delete customer.profileKassDraftDate;
    customer.profileServiceKind = "single";
    saveAndRefreshCustomerProfile(editingItem ? "Касс шинэчлэгдлээ. Төлбөрийн хэсэг нээгдлээ" : "Касс нэмэгдлээ. Төлбөрийн хэсэг нээгдлээ");
  });
}

function bindProfileServiceInlineForm(customer) {
  const form = document.getElementById("profileServiceForm");
  if (!form) return;
  const showSalon = ["admin", "manager"].includes(activeAccount.role);
  const editingIndex = Number.isInteger(customer.profileServiceEditingIndex) ? customer.profileServiceEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const formKind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
  if (!editingItem && formKind === "kass") {
    bindProfileKassInlineForm(customer, form);
    return;
  }
  form.querySelectorAll(".service-modal-tab:not(.disabled)").forEach(tab => {
    tab.addEventListener("click", () => {
      customer.profileServiceKind = tab.dataset.kind || "single";
      if (!Number.isInteger(customer.profileServiceEditingIndex)) customer.profileServiceOpen = true;
      renderProfile();
    });
  });
  enhanceNativeSelects(["profileServiceSelect", "profileServiceSalon", ...(formKind === "course" ? [] : ["profileServiceStaff", "profileServiceRoom"])]);
  form.querySelector(".profile-service-cancel-edit")?.addEventListener("click", () => {
    delete customer.profileServiceEditingIndex;
    delete customer.profileServiceEditMode;
    customer.profileServiceKind = "single";
    customer.profileServiceOpen = false;
    renderProfile();
  });
  updateProfileServicePrice(customer);
  document.getElementById("profileServiceSelect")?.addEventListener("change", () => updateProfileServicePrice(customer));
  document.getElementById("profileServiceRoom")?.addEventListener("change", () => updateProfileServicePrice(customer));
  document.getElementById("profileServiceStaff")?.addEventListener("change", () => updateProfileServicePrice(customer));
  document.getElementById("profileServiceSalon")?.addEventListener("change", event => {
    const staffSelect = document.getElementById("profileServiceStaff");
    if (!staffSelect) return;
    staffSelect.innerHTML = staffOptionHtmlForSalon(event.target.value, "", formValue("profileServiceDate") || todayText());
    enhanceNativeSelects(["profileServiceStaff"]);
    staffSelect.addEventListener("change", () => updateProfileServicePrice(customer));
    updateProfileServicePrice(customer);
  });
  document.getElementById("profileServiceDate")?.addEventListener("change", event => {
    const staffSelect = document.getElementById("profileServiceStaff");
    if (!staffSelect) return;
    const selectedStaff = staffSelect.value;
    const selectedSalon = formValue("profileServiceSalon") || activeAccount.salon;
    staffSelect.innerHTML = staffOptionHtmlForSalon(selectedSalon, selectedStaff, event.target.value || todayText());
    enhanceNativeSelects(["profileServiceStaff"]);
    updateProfileServicePrice(customer);
  });
  if ((editingItem ? editingItem.kind : customer.profileServiceKind) !== "course") {
    bindDiagnosisControls("profileService");
    hydrateDiagnosisForm("profileService", editingItem?.diagnosis, customer.profileServiceEditMode === "diagnosis");
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (editingItem && customer.profileServiceEditMode === "diagnosis") {
      editingItem.diagnosis = readDiagnosisPayload("profileService");
      delete customer.profileServiceEditingIndex;
      delete customer.profileServiceEditMode;
      customer.profileServiceOpen = false;
      saveAndRefreshCustomerProfile("Оношилгоо шинэчлэгдлээ");
      return;
    }
    if (!customer.groupId) {
      showToast("Эхлээд групп үүсгэх эсвэл группт нэгтгэнэ");
      return;
    }
    const kind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
    const priceParts = profileServicePriceParts(customer);
    const item = priceParts.item;
    if (!item) return;
    const date = formValue("profileServiceDate") || todayText();
    const salon = showSalon ? formValue("profileServiceSalon") : activeAccount.salon;
    if (showSalon && !formValue("profileServiceSalon")) {
      showToast("Салбар сонгоно уу");
      return;
    }
    const staff = kind === "course" ? "" : formValue("profileServiceStaff");
    if (kind !== "course" && !staff) {
      showToast("Ажилтан сонгоно уу");
      return;
    }
    const diagnosisPanel = document.getElementById("profileServiceDiagnosisPanel");
    const diagnosis = kind === "course"
      ? null
      : diagnosisPanel?.dataset.open === "true"
        ? readDiagnosisPayload("profileService")
        : (editingItem?.diagnosis || null);
    const historyItem = {
      kind,
      title: standardServiceName(item.name, kind),
      service: standardServiceName(item.name, kind),
      date,
      createdAt: todayText(),
      staff,
      salon,
      price: Number(priceParts.total || 0),
      balance: Number(priceParts.total || 0),
      basePrice: Number(priceParts.basePrice || 0),
      vipRoom: priceParts.vipRoom,
      vipRoomFee: Number(priceParts.vipRoomFee || 0),
      masterStaffFee: Number(priceParts.masterStaffFee || 0),
      paymentMethod: "",
      diagnosis
    };
    if (kind === "course") {
      historyItem.visitsTotal = parseVisitCount(item.visits || item.name);
      historyItem.visits = [];
      historyItem.price = Number(priceParts.basePrice || 0);
      historyItem.balance = Number(priceParts.basePrice || 0);
      historyItem.vipRoom = false;
      historyItem.vipRoomFee = 0;
      historyItem.masterStaffFee = 0;
      customer.activeCourse = true;
      customer.course = `Курс 0/${historyItem.visitsTotal}`;
    }
    customer.serviceHistory = customer.serviceHistory || [];
    if (editingItem) {
      const paidAmount = servicePaidAmount(editingItem);
      historyItem.createdAt = editingItem.createdAt || historyItem.createdAt;
      historyItem.payments = editingItem.payments || [];
      historyItem.paymentFormOpen = editingItem.paymentFormOpen || false;
      if (kind === "course" && Array.isArray(editingItem.visits) && editingItem.visits.length) {
        historyItem.visits = editingItem.visits;
        historyItem.visitsTotal = editingItem.visitsTotal || historyItem.visitsTotal;
      }
      historyItem.balance = Math.max(0, Number(priceParts.total || 0) - paidAmount);
      customer.serviceHistory[editingIndex] = historyItem;
    } else {
      customer.serviceHistory.unshift(historyItem);
    }
    customer.currentTreatment = currentTreatmentFromHistory(customer, historyItem, kind === "course" ? `Курс ${(historyItem.visits || []).length}/${historyItem.visitsTotal}` : "Нэг удаа");
    customer.unpaid = customerBalance(customer) > 0;
    customer.last = date;
    customer.profileServiceOpen = false;
    delete customer.profileServiceEditingIndex;
    delete customer.profileServiceEditMode;
    saveAndRefreshCustomerProfile(editingItem ? "Үйлчилгээ шинэчлэгдлээ" : "Үйлчилгээ нэмэгдлээ");
  });
}

function groupCandidateCustomers(customer, phone = "") {
  const q = String(phone || "").trim();
  return state.customers
    .filter(item => !item.deleted && !item.deletedAt)
    .filter(item => Number(item.id) !== Number(customer.id))
    .filter(item => !item.groupId)
    .filter(item => !q || String(item.phone || "").includes(q) || item.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5);
}

function renderProfileGroupSuggestions(customer) {
  const input = document.getElementById("profileGroupPhone");
  const box = document.getElementById("profileGroupSuggestions");
  if (!input || !box) return;
  const candidates = groupCandidateCustomers(customer, input.value);
  box.innerHTML = candidates.length ? candidates.map(item => `
    <button class="profile-suggestion-item" type="button" data-id="${item.id}">
      <strong>${item.name}</strong><span>${item.phone}</span>
    </button>
  `).join("") : `<span class="muted">Группгүй хэрэглэгч алга</span>`;
  box.querySelectorAll(".profile-suggestion-item").forEach(button => {
    button.addEventListener("click", () => addCustomerToCurrentGroup(customer.id, Number(button.dataset.id)));
  });
}

function addCustomerToCurrentGroup(customerId, memberId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const member = state.customers.find(item => Number(item.id) === Number(memberId));
  const group = customerGroup(customer);
  if (!customer || !member || !group) return;
  if (!requireCustomerEditCodeIfExpired(customer)) return;
  group.members = Array.from(new Set([...(group.members || []), member.id]));
  member.groupId = group.id;
  member.groupRole = "member";
  saveAndRefreshCustomerProfile("Гишүүн нэмэгдлээ");
}

function bindInlinePaymentForms(customer) {
  document.querySelectorAll(".inline-payment-form").forEach(form => {
    const method = form.querySelector(".inline-payment-method");
    if (method && !method.id) method.id = `inlinePaymentMethod${form.dataset.historyIndex}`;
    enhanceNativeSelects([method?.id].filter(Boolean));
    const voucherRole = form.querySelector(".inline-payment-voucher-role");
    if (voucherRole && !voucherRole.id) voucherRole.id = `inlinePaymentVoucherRole${form.dataset.historyIndex}`;
    enhanceNativeSelects([voucherRole?.id].filter(Boolean));
    const bonusInput = form.querySelector(".inline-payment-bonus");
    const amountInput = form.querySelector(".inline-payment-amount");
    const bonusApplyButton = form.querySelector(".inline-bonus-apply");
    const bonusHint = bonusInput?.closest("label")?.querySelector("small");
    const extraPanel = form.querySelector(".inline-payment-extra");
    const giftCardInput = form.querySelector(".inline-payment-gift-card");
    const giftCardNote = form.querySelector(".inline-payment-extra-note");
    const historyIndex = Number(form.dataset.historyIndex);
    const item = customer.serviceHistory?.[historyIndex];
    const balance = Number(item?.balance || 0);
    const group = customerGroup(customer);
    const bonus = groupBonusInfo(group);
    const bonusBalance = Math.max(0, Number(bonus?.balance || 0));
    const bonusAlreadyUsed = (item?.payments || []).some(payment => Number(payment.bonusAmount || 0) > 0);
    const maxBonus = bonusAlreadyUsed ? 0 : Math.max(0, Math.min(bonusBalance, Math.floor(serviceTotalAmount(item) * 0.5), balance));
    const bonusRow = form.querySelector(".inline-bonus-row");
    let bonusApplied = false;
    const updateBonusLimit = () => {
      if (!bonusInput) return 0;
      bonusInput.max = String(maxBonus);
      bonusInput.dataset.max = String(maxBonus);
      bonusInput.disabled = maxBonus <= 0;
      bonusInput.placeholder = bonusAlreadyUsed ? "Бонус ашигласан" : (maxBonus > 0 ? `${money(maxBonus)} хүртэл` : "Бонус байхгүй");
      if (bonusHint) bonusHint.textContent = "";
      if (bonusInput.value !== "") {
        bonusInput.value = moneyInputValue(Math.max(0, Math.min(parseMoneyInput(bonusInput.value), maxBonus)));
      }
      return maxBonus;
    };
    const setBonusApplied = applied => {
      const bonusAmount = Math.max(0, Math.min(parseMoneyInput(bonusInput?.value), maxBonus));
      bonusApplied = Boolean(applied && bonusAmount > 0);
      bonusRow?.classList.toggle("applied", bonusApplied);
      bonusApplyButton?.classList.toggle("applied", bonusApplied);
      bonusApplyButton?.setAttribute("aria-pressed", String(bonusApplied));
      if (bonusApplyButton) bonusApplyButton.textContent = "БОНУС";
      if (bonusInput) bonusInput.readOnly = bonusApplied;
      if (amountInput) {
        amountInput.readOnly = false;
        amountInput.value = bonusApplied ? moneyInputValue(Math.max(0, balance - bonusAmount)) : moneyInputValue(balance);
      }
    };
    amountInput?.addEventListener("input", () => {
      const raw = amountInput.value;
      if (raw === "") {
        updateBonusLimit();
        return;
      }
      const appliedBonusAmount = bonusApplied
        ? Math.max(0, Math.min(parseMoneyInput(bonusInput?.value), maxBonus))
        : 0;
      const payableBalance = Math.max(0, balance - appliedBonusAmount);
      amountInput.value = moneyInputValue(Math.max(1, Math.min(parseMoneyInput(raw), payableBalance)));
    });
    bonusInput?.addEventListener("input", () => {
      bonusInput.value = moneyInputValue(Math.max(0, Math.min(parseMoneyInput(bonusInput.value), maxBonus)));
    });
    bonusApplyButton?.addEventListener("click", () => {
      setBonusApplied(!bonusApplied);
    });
    const updatePaymentExtras = () => {
      const value = method?.value || "card";
      extraPanel?.classList.toggle("show", value === "voucher" || value === "gift_card");
      form.querySelector(".inline-voucher-field")?.classList.toggle("hidden", value !== "voucher");
      form.querySelector(".inline-voucher-note-field")?.classList.toggle("hidden", value !== "voucher");
      form.querySelector(".inline-gift-card-field")?.classList.toggle("hidden", value !== "gift_card");
      if (giftCardNote) {
        giftCardNote.innerHTML = value === "gift_card"
          ? giftCardPaymentMessage(giftCardInput?.value)
          : value === "voucher"
            ? "Ваучерийн дүн хэрэглээнд тооцогдоно, бонус бодогдохгүй."
            : "";
      }
    };
    method?.addEventListener("change", updatePaymentExtras);
    giftCardInput?.addEventListener("input", event => {
      event.target.value = event.target.value.trim();
      updatePaymentExtras();
    });
    updateBonusLimit();
    updatePaymentExtras();
    form.addEventListener("submit", event => {
      event.preventDefault();
      const historyItem = customer.serviceHistory?.[historyIndex];
      if (!historyItem) return;
      const currentBalance = Number(historyItem.balance || 0);
      const amount = Math.max(0, Math.min(parseMoneyInput(amountInput?.value), currentBalance));
      if (!amount) {
        showToast("Төлөх дүн оруулна уу");
        return;
      }
      const currentBonusUsed = (historyItem.payments || []).some(payment => Number(payment.bonusAmount || 0) > 0);
      const bonusAmount = currentBonusUsed || !bonusApplied ? 0 : Math.max(0, Math.min(parseMoneyInput(bonusInput?.value), maxBonus, Math.max(0, currentBalance - amount)));
      const appliedAmount = Math.min(currentBalance, amount + bonusAmount);
      const methodSelect = form.querySelector(".inline-payment-method");
      const methodLabel = methodSelect?.selectedOptions?.[0]?.textContent || "";
      let referenceLabel = "";
      let giftCardUsageId = "";
      if (methodSelect?.value === "voucher") {
        const roleId = form.querySelector(".inline-payment-voucher-role")?.value;
        const role = state.voucherRoles.find(item => String(item.id) === String(roleId));
        if (!role) {
          showToast("Ваучерийн эрх сонгоно уу");
          return;
        }
        referenceLabel = role.name;
        state.voucherLogs.unshift({
          id: nextId(state.voucherLogs),
          date: form.querySelector(".inline-payment-date")?.value || todayText(),
          time: currentTimeText(),
          customer: customer.name,
          phone: customer.phone,
          roleId: role.id,
          roleName: role.name,
          rolePosition: role.position || "",
          amount,
          note: form.querySelector(".inline-payment-voucher-note")?.value?.trim() || historyItem.service || historyItem.title || ""
        });
      }
      if (methodSelect?.value === "gift_card") {
        const cardNumber = form.querySelector(".inline-payment-gift-card")?.value?.trim() || "";
        const card = findGiftCard(cardNumber);
        if (!card || giftCardStatus(card) === "inactive" || giftCardStatus(card) === "used" || Number(card.remainingAmount || 0) <= 0) {
          showToast("Ашиглах боломжтой бэлгийн карт оруулна уу");
          return;
        }
        if (amount > Number(card.remainingAmount || 0)) {
          showToast(`Картын үлдэгдэл ${money(card.remainingAmount)}`);
          return;
        }
        referenceLabel = card.cardNumber;
        giftCardUsageId = `gcu-${Date.now()}-${historyIndex}-${card.usage?.length || 0}`;
        card.remainingAmount = Math.max(0, Number(card.remainingAmount || 0) - amount);
        card.status = card.remainingAmount <= 0 ? "used" : "new";
        card.usage = Array.isArray(card.usage) ? card.usage : [];
        card.usage.unshift({
          id: giftCardUsageId,
          date: form.querySelector(".inline-payment-date")?.value || todayText(),
          time: currentTimeText(),
          customer: customer.name,
          phone: customer.phone,
          service: historyItem.service || historyItem.title || "",
          amount
        });
      }
      const paidDate = form.querySelector(".inline-payment-date")?.value || todayText();
      historyItem.payments = historyItem.payments || [];
      const groupPayment = applyGroupPayment(group, amount, bonusAmount, paidDate, {
        bonusEligible: !["voucher", "gift_card"].includes(methodSelect?.value || "")
      });
      historyItem.payments.unshift({
        amount: appliedAmount,
        bonusAmount,
        paidAmount: amount,
        date: paidDate,
        createdAt: dateTimeText(paidDate),
        method: methodSelect?.value || "",
        methodLabel,
        referenceLabel,
        giftCardUsageId,
        ...(groupPayment || {})
      });
      historyItem.balance = Math.max(0, currentBalance - appliedAmount);
      historyItem.paymentFormOpen = false;
      if (customer.currentTreatment?.service === (historyItem.service || historyItem.title)) {
        customer.currentTreatment.paymentBalance = historyItem.balance;
        if (historyItem.balance <= 0) customer.currentTreatment.stage = "Төлбөр хаагдсан";
      }
      customer.unpaid = customerBalance(customer) > 0;
      saveAndRefreshCustomerProfile("Төлбөр хадгалагдлаа");
    });
  });
}

function bindProfileGroupInlineSearch(customer) {
  const input = document.getElementById("profileGroupPhone");
  const addButton = document.getElementById("profileAddGroupMemberBtn");
  if (!input || !addButton) return;
  input.addEventListener("focus", () => renderProfileGroupSuggestions(customer));
  input.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
    renderProfileGroupSuggestions(customer);
  });
  addButton.addEventListener("click", () => {
    const member = groupCandidateCustomers(customer, input.value).find(item => item.phone === input.value);
    if (!member) {
      showToast("Ийм утасны дугаартай группгүй хэрэглэгч алга");
      renderProfileGroupSuggestions(customer);
      return;
    }
    addCustomerToCurrentGroup(customer.id, member.id);
  });
}

function deleteCustomerHistoryItem(customerId, historyIndex) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const historyItem = customer?.serviceHistory?.[historyIndex];
  if (!historyItem) return;
  if (!isServiceDeletable(historyItem)) {
    showToast("Үйлчилгээ устгах хугацаа дууссан байна");
    return;
  }
  if (!requireDeleteCode()) return;
  const group = customerGroup(customer);
  (historyItem.payments || []).forEach(payment => {
    reverseGroupPayment(payment, group);
    reverseGiftCardPayment(payment, customer, historyItem);
  });
  customer.serviceHistory.splice(historyIndex, 1);
  customer.currentTreatment = customer.serviceHistory[0] ? currentTreatmentFromHistory(customer, customer.serviceHistory[0], customer.serviceHistory[0].kind === "course" ? customer.course || "Курс" : "Нэг удаа") : null;
  customer.activeCourse = customer.serviceHistory.some(item => item.kind === "course");
  customer.unpaid = customerBalance(customer) > 0;
  state.audit.unshift({ title: "service_deleted", meta: `Менежер • ${customer.name} • ${historyItem.service || historyItem.title || "Үйлчилгээ"} • гүйцэтгэлээс давхар хасна` });
  saveAndRefreshCustomerProfile("Үйлчилгээ устлаа");
}

function saveAndRefreshCustomerProfile(message) {
  saveState();
  renderCustomers();
  renderCustomerSideProfile();
  renderProfile();
  renderInfoHeader(activeView);
  if (message) showToast(message);
}

function startDemoTreatment(customerId) {
  openCustomerServiceModal(customerId);
}

function serviceOptionsForKind(kind, customer = null) {
  const items = kind === "course" ? serviceSettingsData.course : serviceSettingsData.single;
  const audience = customer ? serviceAudienceForCustomer(customer) : "";
  return items
    .filter(item => !audience || (audience === "Хүүхэд" ? item.customer === "Хүүхэд" : item.customer !== "Хүүхэд"))
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => kind === "course" ? parseVisitCount(b.visits || b.name) - parseVisitCount(a.visits || a.name) || a.index - b.index : a.index - b.index);
}

function serviceOptionLabel(item, kind) {
  const name = standardServiceName(item.name, kind);
  return kind === "course" ? `${name} · ${serviceVisitText(item)}` : name;
}

function serviceOptionHtml(kind, selectedIndex = 0, customer = null) {
  return serviceOptionsForKind(kind, customer).map((item, index) => `<option value="${index}" ${index === selectedIndex ? "selected" : ""}>${serviceOptionLabel(item, kind)}</option>`).join("");
}

function parseVisitCount(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 4;
}

function staffOptionHtml(selected = "") {
  return state.staff
    .filter(staff => staff.status !== "inactive")
    .map(staff => `<option value="${staff.name}" ${staff.name === selected ? "selected" : ""}>${staff.name}</option>`)
    .join("");
}

function staffHasActiveAssignment(staff, salon, date = todayText()) {
  if (!staff || !salon || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
  return state.assignments.some(assignment => {
    const status = String(assignment.status || "active").toLowerCase();
    const startDate = String(assignment.startDate || assignment.date || "");
    const endDate = String(assignment.endDate || assignment.date || "");
    if (status !== "active") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
    return (Number(assignment.staffId) === Number(staff.id) || assignment.staff === staff.name)
      && assignment.to === salon
      && date >= startDate
      && date <= endDate;
  });
}

function staffOptionHtmlForSalon(salon = "", selected = "", date = todayText()) {
  if (!salon) return `<option value="">Эхлээд салбар сонгоно уу</option>`;
  const staff = state.staff.filter(item => {
    if (item.status === "inactive") return false;
    const assigned = staffHasActiveAssignment(item, salon, date);
    return item.salon === salon || assigned || item.name === selected;
  });
  return staff.length
    ? staff.map(item => {
        const temporary = item.salon !== salon && staffHasActiveAssignment(item, salon, date);
        return `<option value="${item.name}" ${item.name === selected ? "selected" : ""}>${item.name}${temporary ? " · Түр томилгоо" : ""}</option>`;
      }).join("")
    : `<option value="">Ажилтан алга</option>`;
}

function diagnosisFormHtml(prefix = "service", open = false) {
  const generalPositions = ["Орой", "Зүүн тал", "Баруун тал", "Урд", "Ард"];
  return `
    <div class="service-diagnosis-panel ${open ? "" : "hidden"}" id="${prefix}DiagnosisPanel" data-open="${open ? "true" : "false"}">
      <div class="diagnosis-chip-row">
        ${state.diagnosisTypes.map(type => `<button class="secondary-btn diagnosis-pick" type="button" data-type="${type}">${type}</button>`).join("")}
      </div>
      <textarea class="input modal-textarea" id="${prefix}DiagnosisNote" placeholder="Оношилгооны тэмдэглэл"></textarea>
      <div class="diagnosis-photo-columns stacked">
        <section class="camera-capture-section">
          <h4>Толгой, үсний ерөнхий зураг</h4>
          <div class="camera-position-grid">
            ${generalPositions.map((name, index) => `
              <div class="camera-shot-card" data-target="general" data-index="${index}">
                <span>${name}</span>
                <div class="camera-preview-mini">
                  <video class="camera-video" autoplay muted playsinline></video>
                  <canvas class="camera-canvas" width="960" height="720"></canvas>
                  <em>Камер нээгдээгүй</em>
                </div>
                <button class="secondary-btn photo-capture" type="button" data-target="general" data-index="${index}">Камер нээх</button>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="camera-capture-section">
          <h4>Хуйх, үсний угийн зураг</h4>
          <div class="camera-position-grid">
            ${Array.from({ length: 5 }, (_, index) => `
              <div class="camera-shot-card" data-target="scope" data-index="${index}">
                <span>Зураг ${index + 1}</span>
                <div class="camera-preview-mini">
                  <video class="camera-video" autoplay muted playsinline></video>
                  <canvas class="camera-canvas" width="960" height="720"></canvas>
                  <em>Камер нээгдээгүй</em>
                </div>
                <button class="secondary-btn photo-capture" type="button" data-target="scope" data-index="${index}">Камер нээх</button>
              </div>
            `).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
}
function readDiagnosisPayload(prefix = "service") {
  const panel = document.getElementById(`${prefix}DiagnosisPanel`);
  if (!panel || (panel.classList.contains("hidden") && panel.dataset.open !== "true")) {
    releaseDiagnosisCameraSession();
    return null;
  }
  const types = Array.from(panel.querySelectorAll(".diagnosis-pick.active")).map(button => button.dataset.type);
  const readPhoto = button => button.dataset.photo || button.classList.contains("active");
  const generalPhotos = Array.from(panel.querySelectorAll('.photo-capture[data-target="general"]')).map(readPhoto);
  const scopePhotos = Array.from(panel.querySelectorAll('.photo-capture[data-target="scope"]')).map(readPhoto);
  const note = document.getElementById(`${prefix}DiagnosisNote`)?.value.trim() || "";
  const payload = !types.length && !note && !generalPhotos.some(Boolean) && !scopePhotos.some(Boolean)
    ? null
    : { types, note, generalPhotos, scopePhotos };
  releaseDiagnosisCameraSession();
  return payload;
}

function hydrateDiagnosisForm(prefix = "service", diagnosis = null, open = true) {
  if (!diagnosis) return;
  const panel = document.getElementById(`${prefix}DiagnosisPanel`);
  if (!panel) return;
  const hasDiagnosis = (diagnosis.types || []).length || diagnosis.note || (diagnosis.generalPhotos || []).some(Boolean) || (diagnosis.scopePhotos || []).some(Boolean);
  if (!hasDiagnosis) return;
  if (open) {
    panel.classList.remove("hidden");
    panel.dataset.open = "true";
    document.getElementById(`${prefix}DiagnosisToggle`)?.classList.add("active");
  }
  panel.querySelectorAll(".diagnosis-pick").forEach(button => {
    button.classList.toggle("active", (diagnosis.types || []).includes(button.dataset.type));
  });
  const note = document.getElementById(`${prefix}DiagnosisNote`);
  if (note) note.value = diagnosis.note || "";
  ["general", "scope"].forEach(target => {
    const photos = diagnosis[`${target}Photos`] || [];
    panel.querySelectorAll(`.photo-capture[data-target="${target}"]`).forEach(button => {
      const active = Boolean(photos[Number(button.dataset.index)]);
      button.classList.toggle("active", active);
      button.textContent = active ? "Дахин авах" : "Камер нээх";
      const card = button.closest(".camera-shot-card");
      const preview = card?.querySelector(".camera-preview-mini");
      const canvas = card?.querySelector(".camera-canvas");
      const label = preview?.querySelector("em");
      if (card) card.classList.toggle("captured", active);
      if (card) card.classList.toggle("legacy-photo", active && typeof photos[Number(button.dataset.index)] !== "string");
      if (typeof photos[Number(button.dataset.index)] === "string") {
        button.dataset.photo = photos[Number(button.dataset.index)];
        const image = new Image();
        image.onload = () => {
          const context = canvas?.getContext("2d");
          if (context && canvas) context.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = photos[Number(button.dataset.index)];
      }
      if (label && active) label.textContent = typeof photos[Number(button.dataset.index)] === "string" ? "" : "Зураг хадгалагдсан";
    });
  });
}

function detachDiagnosisCamera(card) {
  const video = card?.querySelector(".camera-video");
  if (video) video.srcObject = null;
  card?.classList.remove("camera-live");
}

function releaseDiagnosisCameraSession() {
  closeDiagnosisCameraOverlay();
  if (diagnosisCameraStream?.getTracks) diagnosisCameraStream.getTracks().forEach(track => track.stop());
  diagnosisCameraStream = null;
  document.querySelectorAll(".camera-shot-card").forEach(detachDiagnosisCamera);
}

function diagnosisCameraSessionActive() {
  return Boolean(diagnosisCameraStream?.getVideoTracks?.().some(track => track.readyState === "live"));
}

function closeDiagnosisCameraOverlay() {
  const overlay = document.querySelector(".diagnosis-camera-overlay");
  const video = overlay?.querySelector("video");
  if (video) video.srcObject = null;
  overlay?.remove();
  document.body.classList.remove("camera-overlay-open");
}

function diagnosisCaptureConfig() {
  const settings = generalSettings();
  const mode = settings.diagnosisCaptureMode === "native" ? "native" : "fixed";
  const size = /^\d+x\d+$/.test(settings.diagnosisCaptureSize || "") ? settings.diagnosisCaptureSize : "1280x960";
  const [width, height] = size.split("x").map(Number);
  return {
    mode,
    width,
    height,
    quality: Math.max(0.8, Math.min(0.95, Number(settings.diagnosisJpegQuality || 0.92)))
  };
}

function diagnosisCameraVideoConstraints() {
  const config = diagnosisCaptureConfig();
  return {
    facingMode: { ideal: "environment" },
    width: { ideal: config.mode === "native" ? 4096 : config.width },
    height: { ideal: config.mode === "native" ? 2160 : config.height }
  };
}

async function ensureDiagnosisCameraStream(label) {
  if (!navigator.mediaDevices?.getUserMedia) {
    if (label) label.textContent = "Энэ браузер камераар зураг авахыг дэмжихгүй байна";
    return null;
  }
  try {
    if (label) label.textContent = "Камер нээж байна...";
    if (!diagnosisCameraSessionActive()) {
      diagnosisCameraStream = await navigator.mediaDevices.getUserMedia({
        video: diagnosisCameraVideoConstraints(),
        audio: false
      });
    }
    if (label) label.textContent = "";
    return diagnosisCameraStream;
  } catch (error) {
    diagnosisCameraStream = null;
    if (label) label.textContent = error?.name === "NotAllowedError"
      ? "Камерын зөвшөөрөл өгнө үү"
      : "Камер нээгдсэнгүй";
    return null;
  }
}

async function openDiagnosisCameraFullscreen(card, button) {
  const label = card?.querySelector(".camera-preview-mini em");
  if (!card || !button) return;
  const stream = await ensureDiagnosisCameraStream(label);
  if (!stream) return;
  closeDiagnosisCameraOverlay();
  const positionName = card.querySelector(":scope > span")?.textContent?.trim() || "Оношилгооны зураг";
  const overlay = document.createElement("div");
  overlay.className = "diagnosis-camera-overlay";
  overlay.innerHTML = `
    <div class="diagnosis-camera-topbar">
      <strong>${htmlSafe(positionName)}</strong>
      <button class="diagnosis-camera-close" type="button" aria-label="Камер хаах">×</button>
    </div>
    <video autoplay muted playsinline></video>
    <div class="diagnosis-camera-actions">
      <button class="secondary-btn diagnosis-camera-cancel" type="button">Болих</button>
      <button class="primary-btn diagnosis-camera-shoot" type="button">Зураг авах</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("camera-overlay-open");
  const video = overlay.querySelector("video");
  video.srcObject = stream;
  await video.play();
  const close = () => closeDiagnosisCameraOverlay();
  overlay.querySelector(".diagnosis-camera-close")?.addEventListener("click", close);
  overlay.querySelector(".diagnosis-camera-cancel")?.addEventListener("click", close);
  overlay.querySelector(".diagnosis-camera-shoot")?.addEventListener("click", async event => {
    const shootButton = event.currentTarget;
    shootButton.disabled = true;
    shootButton.textContent = "Хадгалж байна...";
    try {
      await captureDiagnosisCamera(card, button, video);
      close();
    } catch (error) {
      shootButton.disabled = false;
      shootButton.textContent = "Зураг авах";
      showToast(error.message || "Зураг хадгалагдсангүй");
    }
  });
}

async function captureDiagnosisCamera(card, button, sourceVideo = null) {
  const video = sourceVideo || card?.querySelector(".camera-video");
  const canvas = card?.querySelector(".camera-canvas");
  const label = card?.querySelector(".camera-preview-mini em");
  if (!card || !video || !canvas || !video.srcObject) return false;
  const context = canvas.getContext("2d");
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const config = diagnosisCaptureConfig();
  if (config.mode === "native") {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    context.drawImage(video, 0, 0, sourceWidth, sourceHeight);
  } else {
    canvas.width = config.width;
    canvas.height = config.height;
  }
  const targetRatio = canvas.width / canvas.height;
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (config.mode !== "native" && sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else if (config.mode !== "native") {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  if (config.mode !== "native") context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const photoFile = await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(new File([blob], `diagnosis-${Date.now()}.webp`, { type: "image/webp" })) : reject(new Error("Зураг бэлтгэгдсэнгүй")), "image/webp", config.quality);
  });
  button.dataset.photo = await uploadBranchImage(photoFile, "private");
  card.classList.add("captured");
  card.classList.remove("legacy-photo");
  button.classList.add("active");
  button.textContent = "Дахин авах";
  if (label) label.textContent = "";
  if (!sourceVideo) detachDiagnosisCamera(card);
  return true;
}
function bindDiagnosisControls(prefix = "service") {
  const diagnosisToggle = document.getElementById(`${prefix}DiagnosisToggle`);
  diagnosisToggle?.addEventListener("click", () => {
    const panel = document.getElementById(`${prefix}DiagnosisPanel`);
    panel?.classList.toggle("hidden");
    const open = !panel?.classList.contains("hidden");
    if (panel) panel.dataset.open = open ? "true" : "false";
    diagnosisToggle.classList.toggle("active", open);
    if (open) {
      const form = diagnosisToggle.closest("form");
      form?.querySelector(".course-signature-panel")?.classList.add("hidden");
      form?.querySelector(".course-visit-confirm")?.classList.remove("active");
    }
    if (!open) releaseDiagnosisCameraSession();
  });
  document.querySelectorAll(`#${prefix}DiagnosisPanel .diagnosis-pick`).forEach(button => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      const note = document.getElementById(`${prefix}DiagnosisNote`);
      if (!note || !button.classList.contains("active")) return;
      const value = button.dataset.type || button.textContent.trim();
      const parts = note.value.split(",").map(item => item.trim()).filter(Boolean);
      if (!parts.includes(value)) {
        parts.push(value);
        note.value = parts.join(", ");
      }
    });
  });
  document.querySelectorAll(`#${prefix}DiagnosisPanel .photo-capture`).forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".camera-shot-card");
      openDiagnosisCameraFullscreen(card, button);
    });
    const card = button.closest(".camera-shot-card");
    card?.querySelector(".camera-preview-mini")?.addEventListener("click", () => {
      if (!card.classList.contains("captured") || card.classList.contains("camera-live")) return;
      const label = card.querySelector(":scope > span")?.textContent?.trim() || "Оношилгооны зураг";
      if (!button.dataset.photo) return showToast("Хуучин demo зураг тул томруулах файл хадгалагдаагүй байна");
      showDiagnosisPhotoPreview(button.dataset.photo, label);
    });
  });
}
function updateCustomerServicePrice(kind = "single") {
  const select = document.getElementById("customerServiceSelect");
  const customerId = Number(document.getElementById("customerServiceForm")?.dataset.customerId || 0);
  const customer = state.customers.find(item => Number(item.id) === customerId) || null;
  const item = serviceOptionsForKind(kind, customer)[Number(select?.value || 0)] || serviceOptionsForKind(kind, customer)[0];
  document.getElementById("customerServicePrice").textContent = item ? money(item.price || 0) : "—";
}

function openCustomerServiceModal(customerId, defaultKind = "single") {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  if (!customer) return;
  if (!customer.groupId) {
    showToast("Эхлээд групп үүсгэх эсвэл группт нэгдэнэ");
    renderCustomerSideProfile();
    return;
  }
  const showSalon = ["admin", "manager"].includes(activeAccount.role);
  const selectedKind = defaultKind === "course" ? "course" : "single";
  openModal(
    "Үйлчилгээ нэмэх",
    `${customer.name} • ${customer.phone}`,
    `
      <form id="customerServiceForm" class="clean-form customer-service-form" data-kind="${selectedKind}" data-customer-id="${customer.id}">
        <div class="service-modal-tabs">
          <button class="service-modal-tab ${selectedKind === "single" ? "active" : ""}" type="button" data-kind="single">Нэг удаа</button>
          <button class="service-modal-tab ${selectedKind === "course" ? "active" : ""}" type="button" data-kind="course">Курс</button>
          <button class="service-modal-tab disabled" type="button" disabled>Касс</button>
        </div>
        <div class="customer-service-grid">
          <label>Үйлчилгээ
            <select class="input" id="customerServiceSelect">${serviceOptionHtml(selectedKind, 0, customer)}</select>
          </label>
          <label>Огноо
            <input class="input" id="customerServiceDate" type="date" value="${todayText()}" required>
          </label>
          <label>Ажилтан
            <select class="input" id="customerServiceStaff" required>${staffOptionHtmlForSalon(showSalon ? "" : activeAccount.salon, "", todayText())}</select>
          </label>
          ${showSalon ? `<label>Салбар<select class="input" id="customerServiceSalon">${state.salons.map(s => `<option ${s.name === activeAccount.salon ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>` : ""}
          <div class="service-price-readout"><span>Үнэ</span><strong id="customerServicePrice">—</strong></div>
        </div>
        <button class="secondary-btn diagnosis-expand-btn" id="serviceDiagnosisToggle" type="button"><span>Оношилгоо</span><i></i></button>
        ${diagnosisFormHtml("service")}
        <div class="form-actions">
          <button type="button" class="secondary-btn icon-clear" id="cancelModal" aria-label="Болих">×</button>
          <button type="submit" class="primary-btn">Нэмэх</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      const form = document.getElementById("customerServiceForm");
      const select = document.getElementById("customerServiceSelect");
      const hydrateKind = kind => {
        form.dataset.kind = kind;
        select.innerHTML = serviceOptionHtml(kind, 0, customer);
        document.querySelectorAll(".service-modal-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.kind === kind));
        updateCustomerServicePrice(kind);
        enhanceNativeSelects(["customerServiceSelect", "customerServiceStaff", "customerServiceSalon"]);
      };
      document.querySelectorAll(".service-modal-tab:not(.disabled)").forEach(tab => tab.addEventListener("click", () => hydrateKind(tab.dataset.kind)));
      select.addEventListener("change", () => updateCustomerServicePrice(form.dataset.kind));
      document.getElementById("customerServiceSalon")?.addEventListener("change", event => {
        const staffSelect = document.getElementById("customerServiceStaff");
        if (!staffSelect) return;
        staffSelect.innerHTML = staffOptionHtmlForSalon(event.target.value, "", formValue("customerServiceDate") || todayText());
        enhanceNativeSelects(["customerServiceStaff"]);
      });
      document.getElementById("customerServiceDate")?.addEventListener("change", event => {
        const staffSelect = document.getElementById("customerServiceStaff");
        if (!staffSelect) return;
        const salon = showSalon ? formValue("customerServiceSalon") : activeAccount.salon;
        staffSelect.innerHTML = staffOptionHtmlForSalon(salon, staffSelect.value, event.target.value || todayText());
        enhanceNativeSelects(["customerServiceStaff"]);
      });
      bindDiagnosisControls("service");
      hydrateKind(selectedKind);
      form.addEventListener("submit", event => {
        event.preventDefault();
        const kind = form.dataset.kind;
        const item = serviceOptionsForKind(kind, customer)[Number(select.value || 0)];
        if (!item) return;
        const date = formValue("customerServiceDate") || todayText();
        const staff = formValue("customerServiceStaff");
        const salon = showSalon ? formValue("customerServiceSalon") : activeAccount.salon;
        const price = Number(item.price || 0);
        const diagnosis = readDiagnosisPayload("service");
        const historyItem = {
          id: `svc-${Date.now()}`,
          kind,
          title: standardServiceName(item.name, kind),
          service: standardServiceName(item.name, kind),
          date,
          createdAt: todayText(),
          staff,
          salon,
          price,
          balance: price,
          qr: "Баталгаажуулалт хүлээгдэж буй",
          diagnosis,
          diagnosisOpen: false
        };
        if (kind === "course") {
          historyItem.visitsTotal = parseInt(item.visits, 10) || 4;
          historyItem.visits = [];
          customer.activeCourse = true;
          customer.course = `Курс 0/${historyItem.visitsTotal}`;
        } else {
          customer.currentTreatment = currentTreatmentFromHistory(customer, historyItem, "Нэг удаа");
        }
        customer.serviceHistory = customer.serviceHistory || [];
        customer.serviceHistory.unshift(historyItem);
        customer.unpaid = true;
        customer.last = date;
        closeModal();
        saveAndRefreshCustomerProfile("Үйлчилгээ нэмэгдлээ");
      });
    }
  );
}

function currentTreatmentFromHistory(customer, item, progress) {
  return {
    id: `tr-${customer.id}-${Date.now()}`,
    service: item.service,
    salon: item.salon,
    staff: item.staff,
    progress,
    stage: item.diagnosis ? "Оношилгоо хийгдсэн" : "Үйлчилгээ эхэлсэн",
    photos: item.diagnosis ? ((item.diagnosis.generalPhotos || []).filter(Boolean).length + (item.diagnosis.scopePhotos || []).filter(Boolean).length) : 0,
    photoLimit: generalSettings().diagnosisPhotoLimit,
    qrStatus: "Хүлээгдэж буй",
    paymentBalance: Number(item.balance || 0),
    startedAt: item.date
  };
}

function openCourseVisitModal(customerId, historyIndex, visitNumber) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const course = customer?.serviceHistory?.[historyIndex];
  if (!customer || !course || course.kind !== "course") return;
  state.selectedCustomerId = customer.id;
  course.expandedVisit = Number(course.expandedVisit) === Number(visitNumber) ? null : Number(visitNumber);
  customer.profileServiceOpen = false;
  setView("profile");
  renderProfile();
}function openDiagnosisCameraModal(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const treatment = customer?.currentTreatment;
  if (!customer || !treatment) return;
  openModal(
    "Оношилгооны зураг",
    `${customer.name} • ${treatment.service}`,
    `
      <form id="diagnosisCameraForm" class="clean-form">
        <div class="camera-preview-box">
          <strong>Web camera</strong>
          <span>Туршилтын горимд зураг нэмэх товчоор тоо нэмэгдэнэ</span>
        </div>
        <div class="diagnosis-chip-row">
          ${state.diagnosisTypes.slice(0, 8).map(type => `<button class="secondary-btn diagnosis-pick" type="button" data-type="${type}">${type}</button>`).join("")}
        </div>
        <label>Тэмдэглэл
          <textarea class="input modal-textarea" id="diagnosisCameraNote" placeholder="Оношилгооны тэмдэглэл">${treatment.diagnosisNote || ""}</textarea>
        </label>
        <div class="camera-count-row">
          <span>Зураг: <strong id="diagnosisPhotoCount">${Number(treatment.photos || 0)}</strong> / ${treatment.photoLimit}</span>
          <button class="secondary-btn" id="diagnosisAddPhotoBtn" type="button">Зураг авах</button>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
          <button type="submit" class="primary-btn">Хадгалах</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      document.querySelectorAll(".diagnosis-pick").forEach(button => {
        button.addEventListener("click", () => {
          const note = document.getElementById("diagnosisCameraNote");
          note.value = [note.value.trim(), button.dataset.type].filter(Boolean).join(", ");
        });
      });
      document.getElementById("diagnosisAddPhotoBtn").addEventListener("click", () => {
        const max = Number(treatment.photoLimit || generalSettings().diagnosisPhotoLimit);
        treatment.photos = Math.min(max, Number(treatment.photos || 0) + 1);
        document.getElementById("diagnosisPhotoCount").textContent = treatment.photos;
      });
      document.getElementById("diagnosisCameraForm").addEventListener("submit", event => {
        event.preventDefault();
        treatment.diagnosisNote = document.getElementById("diagnosisCameraNote").value.trim();
        treatment.stage = Number(treatment.photos || 0) > 0 ? "Оношилгоо хийгдсэн" : "Оношилгоо хүлээгдэж буй";
        const latest = customer.serviceHistory?.[0];
        if (latest) {
          latest.photos = Number(treatment.photos || 0);
          latest.qr = treatment.qrStatus === "Баталгаажсан" ? "Баталгаажсан" : "Баталгаажуулалт хүлээгдэж буй";
        }
        closeModal();
        saveAndRefreshCustomerProfile("Оношилгоо хадгалагдлаа");
      });
    }
  );
}

function openSignatureQrModal(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const treatment = customer?.currentTreatment;
  if (!customer || !treatment) return;
  openModal(
    "QR баталгаажуулалт",
    `${customer.name} хэрэглэгч утсан дээрээ гарын үсгээ зурж илгээнэ`,
    `
      <div class="qr-demo-box">
        <strong>QR</strong>
        <span>${customer.phone}</span>
      </div>
      <div class="signature-line">Гарын үсэг хүлээн авах хэсэг</div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
        <button type="button" class="secondary-btn" id="qrSentBtn">QR илгээгдсэн</button>
        <button type="button" class="primary-btn" id="qrConfirmBtn">Баталгаажуулах</button>
      </div>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      document.getElementById("qrSentBtn").addEventListener("click", () => {
        treatment.qrStatus = "Илгээгдсэн";
        closeModal();
        saveAndRefreshCustomerProfile("QR илгээгдлээ");
      });
      document.getElementById("qrConfirmBtn").addEventListener("click", () => {
        treatment.qrStatus = "Баталгаажсан";
        treatment.stage = "QR баталгаажсан";
        const latest = customer.serviceHistory?.[0];
        if (latest) latest.qr = "Баталгаажсан";
        closeModal();
        saveAndRefreshCustomerProfile("Гарын үсэг баталгаажлаа");
      });
    }
  );
}

function openCustomerPaymentModal(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const treatment = customer?.currentTreatment;
  if (!customer || !treatment) return;
  const balance = Number(treatment.paymentBalance || 0);
  openModal(
    "Төлбөр төлөх",
    `${customer.name} • үлдэгдэл ${money(balance)}`,
    `
      <form id="profilePaymentForm" class="clean-form">
        <label>Төлөх дүн
          <input class="input" id="profilePaymentAmount" type="number" min="1" max="${balance}" value="${balance || ""}" ${balance <= 0 ? "disabled" : ""}>
        </label>
        <label>Төлбөрийн хэлбэр
          <select class="input" id="profilePaymentMethod">
            <option value="cash">Бэлэн</option>
            <option value="card">Карт</option>
            <option value="transfer">Данс</option>
            <option value="bonus">Бонус</option>
            <option value="gift_card">Бэлгийн карт</option>
            <option value="voucher">Ваучер</option>
          </select>
        </label>
        <div class="form-actions">
          <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
          <button type="submit" class="primary-btn" ${balance <= 0 ? "disabled" : ""}>Хадгалах</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      enhanceNativeSelects(["profilePaymentMethod"]);
      document.getElementById("profilePaymentForm").addEventListener("submit", event => {
        event.preventDefault();
        const amount = Math.max(0, Math.min(Number(formValue("profilePaymentAmount")), Number(treatment.paymentBalance || 0)));
        if (!amount) return;
        treatment.paymentBalance = Math.max(0, Number(treatment.paymentBalance || 0) - amount);
        customer.unpaid = treatment.paymentBalance > 0;
        customer.balance = Math.max(0, Number(customer.balance || 0) - (formValue("profilePaymentMethod") === "bonus" ? amount : 0));
        customer.serviceHistory = customer.serviceHistory || [];
        customer.serviceHistory.unshift({
          title: "Төлбөр",
          meta: `${todayText()} • ${money(amount)} • ${document.getElementById("profilePaymentMethod").selectedOptions[0]?.textContent || ""}`,
          photos: 0,
          qr: treatment.paymentBalance > 0 ? "Үлдэгдэлтэй" : "Төлбөр хаагдсан"
        });
        if (treatment.paymentBalance <= 0 && treatment.qrStatus === "Баталгаажсан") {
          treatment.stage = "Хаагдсан";
        }
        closeModal();
        saveAndRefreshCustomerProfile("Төлбөр хадгалагдлаа");
      });
    }
  );
}

function openJoinGroupModal(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  if (!customer || customer.groupId) return;
  const groups = state.customerGroups.filter(group => (group.members || []).length);
  openModal(
    "Группт нэгдэх",
    "Группийн нэр буюу утсаар хайна",
    `
      <form id="joinGroupForm" class="clean-form">
        <label>Групп хайх
          <input class="input" id="joinGroupSearch" placeholder="Утас эсвэл группийн нэр">
        </label>
        <div class="join-group-results" id="joinGroupResults"></div>
        <div class="form-actions">
          <button type="button" class="secondary-btn icon-clear" id="cancelModal" aria-label="Болих">×</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      const render = () => {
        const q = formValue("joinGroupSearch").toLowerCase();
        const results = groups.filter(group => group.name.toLowerCase().includes(q)).slice(0, 8);
        document.getElementById("joinGroupResults").innerHTML = results.map(group => `
          <button class="join-group-item" type="button" data-id="${group.id}">
            <strong>${group.name}</strong><span>${groupMembers(group).length} гишүүн</span>
          </button>
        `).join("") || `<div class="empty-state">Групп олдсонгүй</div>`;
        document.querySelectorAll(".join-group-item").forEach(button => button.addEventListener("click", () => {
          const group = state.customerGroups.find(item => Number(item.id) === Number(button.dataset.id));
          if (!group) return;
          group.members = Array.from(new Set([...(group.members || []), customer.id]));
          customer.groupId = group.id;
          customer.groupRole = "member";
          closeModal();
          saveAndRefreshCustomerProfile("Группт нэгдлээ");
        }));
      };
      document.getElementById("joinGroupSearch").addEventListener("input", render);
      render();
    }
  );
}

function createCustomerGroup(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  if (!customer || customer.groupId) return;
  if (!requireCustomerEditCodeIfExpired(customer)) return;
  const groupId = nextId(state.customerGroups);
  state.customerGroups.unshift({
    id: groupId,
    name: customer.phone,
    adminCustomerId: customer.id,
    spent2y: Number(customer.spent || 0),
    bonusPool: Number(customer.balance || 0),
    usedBonus: 0,
    members: [customer.id]
  });
  customer.groupId = groupId;
  customer.groupRole = "admin";
  saveAndRefreshCustomerProfile("Групп үүслээ");
}

function openAddGroupMemberModal(customerId) {
  const customer = state.customers.find(item => Number(item.id) === Number(customerId));
  const group = customerGroup(customer);
  if (!customer || !group) return;
  const candidates = state.customers.filter(item => !item.deleted && !item.deletedAt && !item.groupId && Number(item.id) !== Number(customer.id));
  openModal(
    "Группт гишүүн нэмэх",
    `${group.name} групп`,
    `
      <form id="addGroupMemberForm" class="clean-form">
        <label>Хэрэглэгч
          <select class="input" id="groupMemberCustomer" ${candidates.length ? "" : "disabled"}>
            ${candidates.map(item => `<option value="${item.id}">${item.name} • ${item.phone}</option>`).join("")}
          </select>
        </label>
        ${candidates.length ? "" : `<div class="empty-state">Группгүй хэрэглэгч алга</div>`}
        <div class="form-actions">
          <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
          <button type="submit" class="primary-btn" ${candidates.length ? "" : "disabled"}>Нэмэх</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      enhanceNativeSelects(["groupMemberCustomer"]);
      document.getElementById("addGroupMemberForm").addEventListener("submit", event => {
        event.preventDefault();
        const member = state.customers.find(item => Number(item.id) === Number(formValue("groupMemberCustomer")));
        if (!member) return;
        group.members = Array.from(new Set([...(group.members || []), member.id]));
        member.groupId = group.id;
        member.groupRole = "member";
        closeModal();
        saveAndRefreshCustomerProfile("Гишүүн нэмэгдлээ");
      });
    }
  );
}

function renderCatalog() {
  const catalogRows = document.getElementById("catalogRows");
  if (!catalogRows) return;
  catalogRows.innerHTML = state.catalog.map(item => `
    <tr>
      <td><strong>${item.code}</strong></td>
      <td>${item.name}</td>
      <td>${badge(item.type, item.type === "course" ? "green" : "gray")}</td>
      <td>${money(item.price)}</td>
      <td>${item.salons}</td>
      <td>${item.rules}</td>
    </tr>
  `).join("");

  document.getElementById("serviceItem").innerHTML = state.catalog.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
}

function resetHumanResourceForm() {
  humanResourceEditingId = null;
  document.getElementById("hrStaffForm")?.reset();
  const bonus = document.getElementById("hrStaffBonus");
  const kass = document.getElementById("hrStaffKass");
  const status = document.getElementById("hrStaffStatus");
  const position = document.getElementById("hrStaffPosition");
  populateHumanResourceSalonSelect();
  if (bonus) bonus.value = "10";
  if (kass) kass.value = "2";
  if (status) status.value = "active";
  if (position) position.value = "Массажист";
  const title = document.getElementById("hrFormTitle");
  const submit = document.getElementById("hrStaffSubmit");
  const cancel = document.getElementById("hrCancelEdit");
  if (title) title.textContent = "Ажилтан нэмэх";
  if (submit) submit.textContent = "Нэмэх";
  cancel?.classList.add("hidden");
  enhanceNativeSelects(["hrStaffSalon", "hrStaffPosition", "hrStaffStatus"]);
}

function renderHumanResources() {
  ensureHumanResourceShell();
  const rows = document.getElementById("hrStaffRows");
  if (!rows) return;
  populateHumanResourceSalonSelect(document.getElementById("hrStaffSalon")?.value);
  enhanceNativeSelects(["hrStaffSalon", "hrStaffPosition", "hrStaffStatus"]);
  rows.innerHTML = accountStaff().map(staff => `
    <tr>
      <td><strong>${staff.name}</strong></td>
      <td>${staff.phone || ""}</td>
      <td>${staff.salon || ""}</td>
      <td>${staff.position || "Массажист"}</td>
      <td>${formatPercent(staff.bonusCommission ?? parseFloat(staff.commission) ?? 10)}</td>
      <td>${formatPercent(staff.kassCommission ?? 2)}</td>
      <td><span class="status-text ${staff.status === "inactive" ? "inactive" : ""}">${humanResourceStatusText(staff.status)}</span></td>
      <td>
        <div class="table-actions">
          <button class="secondary-btn icon-action hr-edit" type="button" data-id="${staff.id}" aria-label="Засах">${editIcon()}</button>
          <button class="danger-btn icon-danger hr-delete" type="button" data-id="${staff.id}" aria-label="Устгах">${trashIcon()}</button>
        </div>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".hr-edit").forEach(button => {
    button.addEventListener("click", () => editHumanResourceStaff(Number(button.dataset.id)));
  });
  document.querySelectorAll(".hr-delete").forEach(button => {
    button.addEventListener("click", () => deleteHumanResourceStaff(Number(button.dataset.id)));
  });
  renderHumanResourceAssignments();
  renderInfoHeader(activeView);
}

function assignmentPeriodText(assignment = {}) {
  const dates = assignment.startDate === assignment.endDate
    ? assignment.startDate
    : `${assignment.startDate} — ${assignment.endDate}`;
  return `${dates} · ${assignment.startTime || "09:00"}–${assignment.endTime || "20:00"}`;
}

function assignmentStaffScope() {
  return state.staff.filter(item => item.status !== "inactive" && (!isSalonAccount() || item.salon === activeAccount.salon));
}

function assignmentCanBeManaged(assignment) {
  return !isSalonAccount() || assignment.from === activeAccount.salon;
}

function canEditAssignment(assignment) {
  return assignmentCanBeManaged(assignment) && canEditKassSchedule({ date: assignment.startDate });
}

function renderHumanResourceAssignments() {
  const staffSelect = document.getElementById("hrAssignmentStaff");
  const salonSelect = document.getElementById("hrAssignmentSalon");
  const rows = document.getElementById("hrAssignmentRows");
  const pagination = document.getElementById("hrAssignmentPagination");
  if (!staffSelect || !salonSelect || !rows) return;

  const selectedStaff = staffSelect.value;
  const selectedSalon = salonSelect.value;
  staffSelect.innerHTML = `<option value="">— Сонгох —</option>${assignmentStaffScope()
    .map(item => `<option value="${item.id}" ${String(item.id) === selectedStaff ? "selected" : ""}>${item.name} · ${item.salon || "Салбаргүй"}</option>`)
    .join("")}`;
  salonSelect.innerHTML = `<option value="">— Сонгох —</option>${state.salons
    .filter(item => item.active !== false && (!isSalonAccount() || item.name !== activeAccount.salon))
    .map(item => `<option value="${item.name}" ${item.name === selectedSalon ? "selected" : ""}>${item.name}</option>`)
    .join("")}`;

  const startDate = document.getElementById("hrAssignmentStartDate");
  const endDate = document.getElementById("hrAssignmentEndDate");
  if (startDate && !startDate.value) startDate.value = todayText();
  if (endDate && !endDate.value) endDate.value = startDate?.value || todayText();

  const nameSearch = String(document.getElementById("hrAssignmentNameSearch")?.value || "").trim().toLowerCase();
  const fromSearch = document.getElementById("hrAssignmentFromSearch")?.value || "";
  const toSearch = document.getElementById("hrAssignmentToSearch")?.value || "";
  const filteredAssignments = state.assignments
    .filter(assignmentCanBeManaged)
    .filter(assignment => !nameSearch || String(assignment.staff || "").toLowerCase().includes(nameSearch))
    .filter(assignment => !fromSearch || assignment.endDate >= fromSearch)
    .filter(assignment => !toSearch || assignment.startDate <= toSearch)
    .slice()
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filteredAssignments.length / pageSize));
  assignmentPage = Math.min(Math.max(1, assignmentPage), pageCount);
  const pageRows = filteredAssignments.slice((assignmentPage - 1) * pageSize, assignmentPage * pageSize);

  rows.innerHTML = pageRows
    .map(assignment => {
      const editable = canEditAssignment(assignment);
      return `
        <tr>
          <td><strong>${assignment.staff}</strong></td>
          <td>${assignment.from}</td>
          <td><span class="assignment-route">→ ${assignment.to}</span></td>
          <td>${assignmentPeriodText(assignment)}</td>
          <td>${assignment.reason || "—"}</td>
          <td>
            <div class="table-actions assignment-actions">
              <button class="secondary-btn icon-action assignment-edit" type="button" data-id="${assignment.id}" aria-label="Томилгоо засах" ${editable ? "" : "disabled"}>${editIcon()}</button>
              <button class="danger-btn icon-danger assignment-delete" type="button" data-id="${assignment.id}" aria-label="Томилгоо устгах" ${editable ? "" : "disabled"}>${trashIcon()}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="6"><div class="empty-state">Түр томилгоо бүртгэгдээгүй байна</div></td></tr>`;

  if (pagination) {
    pagination.innerHTML = filteredAssignments.length > pageSize ? `
      <button class="secondary-btn" type="button" id="assignmentPrevPage" ${assignmentPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${assignmentPage} / ${pageCount} · ${filteredAssignments.length} бүртгэл</span>
      <button class="secondary-btn" type="button" id="assignmentNextPage" ${assignmentPage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : filteredAssignments.length ? `<span>${filteredAssignments.length} бүртгэл</span>` : "";
    document.getElementById("assignmentPrevPage")?.addEventListener("click", () => {
      assignmentPage -= 1;
      renderHumanResourceAssignments();
    });
    document.getElementById("assignmentNextPage")?.addEventListener("click", () => {
      assignmentPage += 1;
      renderHumanResourceAssignments();
    });
  }

  rows.querySelectorAll(".assignment-edit").forEach(button => {
    button.addEventListener("click", () => editHumanResourceAssignment(Number(button.dataset.id)));
  });
  rows.querySelectorAll(".assignment-delete").forEach(button => {
    button.addEventListener("click", () => deleteHumanResourceAssignment(Number(button.dataset.id)));
  });
  enhanceNativeSelects(["hrAssignmentStaff", "hrAssignmentSalon", "hrAssignmentStartTime", "hrAssignmentEndTime"]);
}

function saveHumanResourceAssignment(event) {
  event.preventDefault();
  const staff = state.staff.find(item => Number(item.id) === Number(formValue("hrAssignmentStaff")));
  const destination = formValue("hrAssignmentSalon");
  const startDate = formValue("hrAssignmentStartDate");
  const endDate = formValue("hrAssignmentEndDate");
  const startTime = formValue("hrAssignmentStartTime") || "09:00";
  const endTime = formValue("hrAssignmentEndTime") || "20:00";
  if (!staff || !destination) return showToast("Ажилтан болон очих салбарыг сонгоно уу");
  if (isSalonAccount() && staff.salon !== activeAccount.salon) return showToast("Зөвхөн өөрийн салбарын ажилтныг томилно");
  if (staff.salon === destination) return showToast("Үндсэн салбараас өөр салбар сонгоно уу");
  const newStart = `${startDate}T${startTime}`;
  const newEnd = `${endDate}T${endTime}`;
  if (!startDate || !endDate || newEnd <= newStart) return showToast("Томилгооны хугацааг зөв оруулна уу");

  const overlaps = state.assignments.some(item =>
    Number(item.staffId) === Number(staff.id) &&
    Number(item.id) !== Number(assignmentEditingId) &&
    item.status !== "cancelled" &&
    newStart < `${item.endDate}T${item.endTime || "20:00"}` &&
    newEnd > `${item.startDate}T${item.startTime || "09:00"}`
  );
  if (overlaps) return showToast("Энэ ажилтны сонгосон хугацаанд өөр томилгоо байна");

  const payload = {
    staffId: staff.id,
    staff: staff.name,
    from: staff.salon || "",
    to: destination,
    startDate,
    endDate,
    startTime,
    endTime,
    reason: formValue("hrAssignmentReason") || "Салбарын ачаалал нөхөх",
    status: "active"
  };
  const editing = state.assignments.find(item => Number(item.id) === Number(assignmentEditingId));
  if (editing) Object.assign(editing, payload);
  else state.assignments.unshift({ id: nextId(state.assignments), ...payload });
  state.audit.unshift({ title: editing ? "staff_assignment_updated" : "staff_assigned", meta: `Менежер • ${staff.name} • ${staff.salon} → ${destination} • ${startDate}` });
  saveState();
  resetHumanResourceAssignmentForm();
  renderHumanResourceAssignments();
  renderAudit();
  showToast(editing ? "Томилгоо шинэчлэгдлээ" : "Түр томилгоо бүртгэгдлээ");
}

function resetHumanResourceAssignmentForm() {
  assignmentEditingId = null;
  document.getElementById("hrAssignmentForm")?.reset();
  const startDate = document.getElementById("hrAssignmentStartDate");
  const endDate = document.getElementById("hrAssignmentEndDate");
  if (startDate) startDate.value = todayText();
  if (endDate) endDate.value = todayText();
  const startTime = document.getElementById("hrAssignmentStartTime");
  const endTime = document.getElementById("hrAssignmentEndTime");
  if (startTime) startTime.value = "09:00";
  if (endTime) endTime.value = "20:00";
  const submit = document.getElementById("hrAssignmentSubmit");
  if (submit) submit.textContent = "Томилох";
  document.getElementById("hrAssignmentCancel")?.classList.add("hidden");
}

function editHumanResourceAssignment(id) {
  const assignment = state.assignments.find(item => Number(item.id) === Number(id));
  if (!assignment || !canEditAssignment(assignment)) return showToast("Засах хугацаа дууссан байна");
  if (!requireEditCode()) return;
  assignmentEditingId = id;
  document.getElementById("hrAssignmentStaff").value = assignment.staffId || "";
  document.getElementById("hrAssignmentSalon").value = assignment.to || "";
  document.getElementById("hrAssignmentStartDate").value = assignment.startDate || todayText();
  document.getElementById("hrAssignmentEndDate").value = assignment.endDate || todayText();
  document.getElementById("hrAssignmentStartTime").value = assignment.startTime || "09:00";
  document.getElementById("hrAssignmentEndTime").value = assignment.endTime || "20:00";
  document.getElementById("hrAssignmentReason").value = assignment.reason || "";
  document.getElementById("hrAssignmentSubmit").textContent = "Хадгалах";
  document.getElementById("hrAssignmentCancel")?.classList.remove("hidden");
  enhanceNativeSelects(["hrAssignmentStaff", "hrAssignmentSalon", "hrAssignmentStartTime", "hrAssignmentEndTime"]);
}

function deleteHumanResourceAssignment(id) {
  const assignment = state.assignments.find(item => Number(item.id) === Number(id));
  if (!assignment || !assignmentCanBeManaged(assignment)) return showToast("Энэ томилгоог устгах эрхгүй байна");
  if (!canEditAssignment(assignment)) return showToast("Устгах хугацаа дууссан байна");
  if (!requireDeleteCode()) return;
  state.assignments = state.assignments.filter(item => Number(item.id) !== Number(id));
  if (assignment) state.audit.unshift({ title: "staff_assignment_deleted", meta: `Менежер • ${assignment.staff} • ${assignment.to}` });
  saveState();
  if (Number(assignmentEditingId) === Number(id)) resetHumanResourceAssignmentForm();
  renderHumanResourceAssignments();
  renderAudit();
  showToast("Томилгоо устлаа");
}

function saveHumanResourceStaff(event) {
  event.preventDefault();
  const name = formValue("hrStaffName");
  if (!name) return;
  const phone = formValue("hrStaffPhone").replace(/\D/g, "").slice(0, 8);
  const payload = {
    name,
    phone,
    salon: isSalonAccount() ? activeAccount.salon : (formValue("hrStaffSalon") || state.salons[0]?.name || ""),
    position: formValue("hrStaffPosition") || "Массажист",
    bonusCommission: Number(formValue("hrStaffBonus")) || 0,
    kassCommission: Number(formValue("hrStaffKass")) || 0,
    status: formValue("hrStaffStatus") || "active",
    commission: `${Number(formValue("hrStaffBonus")) || 0}%`,
    vip: formValue("hrStaffPosition") === "Мастер массажист"
  };
  if (humanResourceEditingId) {
    const staff = state.staff.find(item => item.id === humanResourceEditingId);
    if (!staff || !canAccessSalon(staff.salon)) return showToast("Өөр салбарын ажилтны мэдээллийг засах эрхгүй");
    if (staff) Object.assign(staff, payload);
    state.audit.unshift({ title: "staff_updated", meta: `Менежер • ${name}` });
    showToast("Ажилтан шинэчлэгдлээ");
  } else {
    state.staff.unshift({ id: nextId(state.staff), ...payload });
    state.audit.unshift({ title: "staff_created", meta: `Менежер • ${name}` });
    showToast("Ажилтан нэмэгдлээ");
  }
  saveState();
  resetHumanResourceForm();
  renderHumanResources();
  renderKassSchedule();
  renderStaff();
  renderAudit();
}

function editHumanResourceStaff(id) {
  const staff = state.staff.find(item => item.id === id);
  if (!staff || !canAccessSalon(staff.salon)) return showToast("Өөр салбарын ажилтны мэдээллийг засах эрхгүй");
  humanResourceEditingId = id;
  document.getElementById("hrStaffName").value = staff.name || "";
  document.getElementById("hrStaffPhone").value = staff.phone || "";
  populateHumanResourceSalonSelect(staff.salon || state.salons[0]?.name || "");
  document.getElementById("hrStaffPosition").value = normalizePositionName(staff.position || (staff.vip ? "Мастер массажист" : "Массажист"));
  document.getElementById("hrStaffBonus").value = Number(staff.bonusCommission ?? parseFloat(staff.commission) ?? 10).toFixed(2);
  document.getElementById("hrStaffKass").value = Number(staff.kassCommission ?? 2).toFixed(2);
  document.getElementById("hrStaffStatus").value = staff.status || "active";
  document.getElementById("hrFormTitle").textContent = "Ажилтан засах";
  document.getElementById("hrStaffSubmit").textContent = "Шинэчлэх";
  document.getElementById("hrCancelEdit").classList.remove("hidden");
  enhanceNativeSelects(["hrStaffSalon", "hrStaffPosition", "hrStaffStatus"]);
}

function toggleHumanResourceStatus(id) {
  const staff = state.staff.find(item => item.id === id);
  if (!staff || !canAccessSalon(staff.salon)) return showToast("Өөр салбарын ажилтны төлөвийг засах эрхгүй");
  staff.status = staff.status === "inactive" ? "active" : "inactive";
  state.audit.unshift({ title: "staff_status_updated", meta: `Менежер • ${staff.name} • ${humanResourceStatusText(staff.status)}` });
  saveState();
  renderHumanResources();
  renderKassSchedule();
  renderStaff();
  renderAudit();
}

function deleteHumanResourceStaff(id) {
  const staff = state.staff.find(item => item.id === id);
  if (!staff || !canAccessSalon(staff.salon)) return showToast("Өөр салбарын ажилтныг устгах эрхгүй");
  if (!requireDeleteCode()) return;
  state.staff = state.staff.filter(item => item.id !== id);
  if (humanResourceEditingId === id) resetHumanResourceForm();
  state.audit.unshift({ title: "staff_deleted", meta: `Менежер • ${staff?.name || id}` });
  saveState();
  renderHumanResources();
  renderStaff();
  renderAudit();
  showToast("Ажилтан устлаа");
}

function renderStaff() {
  const staffRows = document.getElementById("staffRows");
  if (staffRows) {
    staffRows.innerHTML = state.staff.map(staff => `
      <tr>
        <td><strong>${staff.name}</strong></td>
        <td>${staff.salon}</td>
        <td>${staff.vip ? badge("Вип", "green") : badge("Энгийн", "gray")}</td>
        <td>${staff.commission}</td>
        <td>${badge(staff.status === "active" ? "Идэвхтэй" : staff.status, "green")}</td>
      </tr>
    `).join("");
  }

  const staffOptions = state.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  const serviceStaff = document.getElementById("serviceStaff");
  if (serviceStaff) serviceStaff.innerHTML = staffOptions;
  const assignStaff = document.getElementById("assignStaff");
  if (assignStaff) assignStaff.innerHTML = staffOptions;
}

function renderBookings() {
  const q = document.getElementById("bookingSearch")?.value || "";
  const status = document.getElementById("bookingStatusFilter")?.value || "all";
  const salon = isSalonAccount() ? activeAccount.salon : (document.getElementById("bookingSalonFilter")?.value || "all");
  const date = document.getElementById("bookingDateFilter")?.value || "";
  const pagination = document.getElementById("bookingPagination");
  const bookings = state.bookings
    .filter(b => !q || b.phone.includes(q))
    .filter(b => salon === "all" || b.salon === salon)
    .filter(b => !date || b.date === date)
    .filter(b => status === "all" || b.status === status)
    .slice()
    .sort((a, b) => {
      const pendingOrder = Number(b.status === "pending") - Number(a.status === "pending");
      if (pendingOrder) return pendingOrder;
      const dateTimeOrder = `${b.date || ""} ${b.time || ""}`.localeCompare(`${a.date || ""} ${a.time || ""}`);
      return dateTimeOrder || Number(b.id || 0) - Number(a.id || 0);
    });
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  bookingPage = Math.min(Math.max(bookingPage, 1), pageCount);
  const pageRows = bookings.slice((bookingPage - 1) * pageSize, bookingPage * pageSize);
  document.getElementById("bookingRows").innerHTML = pageRows.map((booking, index) => `
    <tr>
      <td>${bookings.length - ((bookingPage - 1) * pageSize + index)}</td>
      <td>${booking.salon}</td>
      <td>${dateWithWeekday(booking.date)}</td>
      <td>${booking.time}</td>
      <td>${booking.phone}</td>
      <td>${bookingSourceText(booking.source, booking.status)}</td>
      <td>${bookingStatusLabel(booking.status)}</td>
      <td>
        <div class="table-actions">
          ${booking.status === "pending" ? `<button class="primary-btn booking-confirm" data-id="${booking.id}">Батлах</button>` : ""}
          <button class="secondary-btn icon-action booking-edit" data-id="${booking.id}" aria-label="Засах">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 17.5V20h2.5L17.1 9.4l-2.5-2.5L4 17.5Zm12-12 2.5 2.5 1.1-1.1a1.8 1.8 0 0 0 0-2.5 1.8 1.8 0 0 0-2.5 0L16 5.5Z"></path>
            </svg>
          </button>
          <button class="danger-btn icon-danger booking-delete" data-id="${booking.id}" aria-label="Устгах">${trashIcon()}</button>
        </div>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".booking-confirm").forEach(button => {
    button.addEventListener("click", () => updateBookingStatus(Number(button.dataset.id), "confirmed"));
  });
  document.querySelectorAll(".booking-delete").forEach(button => {
    button.addEventListener("click", () => deleteBooking(Number(button.dataset.id)));
  });
  document.querySelectorAll(".booking-edit").forEach(button => {
    button.addEventListener("click", () => openBookingModal(Number(button.dataset.id)));
  });
  if (pagination) {
    pagination.innerHTML = bookings.length > pageSize ? `
      <button class="secondary-btn" type="button" id="bookingPrevPage" ${bookingPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${bookingPage} / ${pageCount}</span>
      <button class="secondary-btn" type="button" id="bookingNextPage" ${bookingPage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("bookingPrevPage")?.addEventListener("click", () => {
      bookingPage -= 1;
      renderBookings();
    });
    document.getElementById("bookingNextPage")?.addEventListener("click", () => {
      bookingPage += 1;
      renderBookings();
    });
  }

  renderInfoHeader(activeView);
}

function renderServices() {
  const serviceList = document.getElementById("serviceList");
  if (!serviceList) return;
  serviceList.innerHTML = state.services.map(service => `
    <div class="stack-item">
      <strong>${service.customer} • ${money(service.total)}</strong>
      <span>${service.service} • ${service.staff} • ${service.salon}</span>
    </div>
  `).join("");
  updateServiceTotal();
}

function voucherLogRoleKey(log = {}) {
  if (log.roleId !== undefined && log.roleId !== null && String(log.roleId) !== "") {
    return `id:${String(log.roleId)}`;
  }
  const snapshot = `${String(log.roleName || "").trim().toLowerCase()}\u0000${String(log.rolePosition || "").trim().toLowerCase()}`;
  return `legacy:${encodeURIComponent(snapshot)}`;
}

function ensureVoucherLogRoleIds() {
  let changed = false;
  state.voucherLogs.forEach(log => {
    if (log.roleId !== undefined && log.roleId !== null && String(log.roleId) !== "") return;
    const role = state.voucherRoles.find(item =>
      String(item.name || "").trim().toLowerCase() === String(log.roleName || "").trim().toLowerCase() &&
      String(item.position || "").trim().toLowerCase() === String(log.rolePosition || "").trim().toLowerCase()
    );
    if (!role) return;
    log.roleId = role.id;
    changed = true;
  });
  return changed;
}

function voucherRoleFilterEntries() {
  const entries = state.voucherRoles.map(role => ({
    value: `id:${role.id}`,
    label: `${role.name}${role.position ? ` · ${role.position}` : ""}`
  }));
  const seen = new Set(entries.map(entry => entry.value));
  state.voucherLogs
    .slice()
    .sort((a, b) => `${b.date || ""}${b.time || ""}`.localeCompare(`${a.date || ""}${a.time || ""}`))
    .forEach(log => {
      const value = voucherLogRoleKey(log);
      if (seen.has(value)) return;
      const baseLabel = `${log.roleName || "Нэргүй эрх"}${log.rolePosition ? ` · ${log.rolePosition}` : ""}`;
      entries.push({ value, label: `${baseLabel} · ${value.startsWith("id:") ? "Устгасан" : "Түүхэн"}` });
      seen.add(value);
    });
  return entries;
}

function nextVoucherRoleId() {
  const ids = [
    ...state.voucherRoles.map(role => Number(role.id) || 0),
    ...state.voucherLogs.map(log => Number(log.roleId) || 0)
  ];
  return Math.max(0, ...ids) + 1;
}

function renderVouchers() {
  const roleRows = document.getElementById("voucherRoleRows");
  const logRows = document.getElementById("voucherLogRows");
  const pagination = document.getElementById("voucherPagination");
  if (!roleRows || !logRows) return;
  if (ensureVoucherLogRoleIds()) saveState();
  const roleSubmit = document.getElementById("voucherRoleSubmit");
  if (roleSubmit) roleSubmit.textContent = voucherRoleEditingId ? "Шинэчлэх" : "Нэмэх";
  const roleFilterSelect = document.getElementById("voucherRoleFilter");
  const selectedRoleFilter = roleFilterSelect?.value || "";
  const roleFilterEntries = voucherRoleFilterEntries();
  if (roleFilterSelect) {
    const validSelectedRoleFilter = roleFilterEntries.some(entry => entry.value === selectedRoleFilter) ? selectedRoleFilter : "";
    roleFilterSelect.innerHTML = `
      <option value="">Бүх роль</option>
      ${roleFilterEntries.map(entry => `<option value="${htmlSafe(entry.value)}" ${entry.value === validSelectedRoleFilter ? "selected" : ""}>${htmlSafe(entry.label)}</option>`).join("")}
    `;
    roleFilterSelect.value = validSelectedRoleFilter;
    if (!roleFilterSelect.id) roleFilterSelect.id = "voucherRoleFilter";
    enhanceNativeSelects(["voucherRoleFilter"]);
  }

  roleRows.innerHTML = state.voucherRoles.map(role => `
    <div class="voucher-role-item">
      <div class="voucher-role-main">
        <strong>${role.name}</strong>
        <span>${role.position || ""}</span>
      </div>
      <div class="table-actions">
        <button class="secondary-btn icon-action voucher-role-edit" type="button" data-id="${role.id}" aria-label="Засах">${editIcon()}</button>
        <button class="danger-btn icon-danger voucher-role-delete" type="button" data-id="${role.id}" aria-label="Устгах">${trashIcon()}</button>
      </div>
    </div>
  `).join("");

  const dateFilter = document.getElementById("voucherDateFilter")?.value || "";
  const customerFilter = document.getElementById("voucherCustomerFilter")?.value.trim().toLowerCase() || "";
  const phoneFilter = document.getElementById("voucherPhoneFilter")?.value.trim() || "";
  const roleFilter = document.getElementById("voucherRoleFilter")?.value || "";
  const logs = state.voucherLogs
    .filter(item => !dateFilter || item.date === dateFilter)
    .filter(item => !customerFilter || item.customer.toLowerCase().includes(customerFilter))
    .filter(item => !phoneFilter || item.phone.includes(phoneFilter))
    .filter(item => !roleFilter || voucherLogRoleKey(item) === roleFilter)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  voucherPage = Math.min(Math.max(voucherPage, 1), pageCount);
  const pageRows = logs.slice((voucherPage - 1) * pageSize, voucherPage * pageSize);

  logRows.innerHTML = pageRows.map(log => `
    <tr>
      <td>${log.date}</td>
      <td>${log.time || ""}</td>
      <td>${log.customer}</td>
      <td>${log.phone}</td>
      <td><span class="voucher-log-role"><strong>${log.roleName}</strong><em>${log.rolePosition || ""}</em></span></td>
      <td><strong>${money(log.amount)}</strong></td>
      <td>${log.note || ""}</td>
    </tr>
  `).join("");

  roleRows.querySelectorAll(".voucher-role-delete").forEach(button => {
    button.addEventListener("click", () => {
      if (!requireDeleteCode()) return;
      const id = Number(button.dataset.id);
      state.voucherRoles = state.voucherRoles.filter(item => Number(item.id) !== id);
      if (Number(voucherRoleEditingId) === id) {
        voucherRoleEditingId = null;
        document.getElementById("voucherRoleForm")?.reset();
      }
      saveState();
      renderVouchers();
      renderInfoHeader(activeView);
      showToast("Ваучерийн эрх устлаа");
    });
  });
  roleRows.querySelectorAll(".voucher-role-edit").forEach(button => {
    button.addEventListener("click", () => {
      const role = state.voucherRoles.find(item => Number(item.id) === Number(button.dataset.id));
      if (!role) return;
      voucherRoleEditingId = role.id;
      document.getElementById("voucherRoleName").value = role.name || "";
      document.getElementById("voucherRolePosition").value = role.position || "";
      renderVouchers();
      renderInfoHeader(activeView);
    });
  });
  if (pagination) {
    pagination.innerHTML = logs.length > pageSize ? `
      <button class="secondary-btn" type="button" id="voucherPrevPage" ${voucherPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${voucherPage} / ${pageCount}</span>
      <button class="secondary-btn" type="button" id="voucherNextPage" ${voucherPage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("voucherPrevPage")?.addEventListener("click", () => {
      voucherPage -= 1;
      renderVouchers();
    });
    document.getElementById("voucherNextPage")?.addEventListener("click", () => {
      voucherPage += 1;
      renderVouchers();
    });
  }
}

function resetGiftCardForm() {
  giftCardEditingId = null;
  document.getElementById("giftCardForm")?.reset();
  const submit = document.getElementById("giftCardSubmit");
  if (submit) submit.textContent = "Нэмэх";
}

function renderGiftCards() {
  const rows = document.getElementById("giftCardRows");
  const pagination = document.getElementById("giftCardPagination");
  if (!rows) return;
  enhanceNativeSelects(["giftCardStatusFilter"]);

  const numberFilter = document.getElementById("giftCardNumberFilter")?.value.trim().toLowerCase() || "";
  const statusFilter = document.getElementById("giftCardStatusFilter")?.value || "all";
  const fromDate = document.getElementById("giftCardFromFilter")?.value || "";
  const toDate = document.getElementById("giftCardToFilter")?.value || "";
  const cards = [...state.giftCards]
    .filter(card => !numberFilter || card.cardNumber.toLowerCase().includes(numberFilter))
    .filter(card => statusFilter === "all" || giftCardStatus(card) === statusFilter)
    .filter(card => !fromDate || card.createdAt >= fromDate)
    .filter(card => !toDate || card.createdAt <= toDate)
    .sort((a, b) => `${b.createdAt}${b.id}`.localeCompare(`${a.createdAt}${a.id}`));
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  giftCardPage = Math.min(Math.max(giftCardPage, 1), pageCount);
  const pageRows = cards.slice((giftCardPage - 1) * pageSize, giftCardPage * pageSize);

  rows.innerHTML = pageRows.map(card => {
    const status = giftCardStatus(card);
    const editable = giftCardCanEdit(card);
    const usage = Array.isArray(card.usage) ? card.usage : [];
    const usageText = usage.length
      ? usage.map(item => `${item.date} · ${item.customer} · ${money(item.amount)}`).join("<br>")
      : "Ашиглалт байхгүй";
    return `
      <tr class="${status === "used" || status === "inactive" ? "locked-row" : ""}">
        <td><strong>${card.cardNumber}</strong></td>
        <td><span class="gift-card-status ${status}">${giftCardStatusText(card)}</span></td>
        <td><strong>${money(card.amount)}</strong></td>
        <td>${money(card.remainingAmount)}</td>
        <td>${card.createdAt || ""}</td>
        <td>${card.expiryDate || "—"}</td>
        <td><span class="gift-card-usage">${usageText}</span></td>
        <td>
          <div class="table-actions">
            <button class="secondary-btn gift-card-toggle" type="button" data-id="${card.id}" ${status === "used" ? "disabled" : ""}>${status === "inactive" ? "Идэвхжүүлэх" : "Идэвхгүй"}</button>
            <button class="secondary-btn icon-action gift-card-edit" type="button" data-id="${card.id}" aria-label="Засах" ${editable ? "" : "disabled"}>${editIcon()}</button>
            <button class="danger-btn icon-danger gift-card-delete" type="button" data-id="${card.id}" aria-label="Устгах" ${editable ? "" : "disabled"}>${trashIcon()}</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  rows.querySelectorAll(".gift-card-edit").forEach(button => {
    button.addEventListener("click", () => editGiftCard(Number(button.dataset.id)));
  });
  rows.querySelectorAll(".gift-card-toggle").forEach(button => {
    button.addEventListener("click", () => toggleGiftCard(Number(button.dataset.id)));
  });
  rows.querySelectorAll(".gift-card-delete").forEach(button => {
    button.addEventListener("click", () => deleteGiftCard(Number(button.dataset.id)));
  });

  if (pagination) {
    pagination.innerHTML = cards.length > pageSize ? `
      <button class="secondary-btn" type="button" id="giftCardPrevPage" ${giftCardPage <= 1 ? "disabled" : ""}>Өмнөх</button>
      <span>${giftCardPage} / ${pageCount}</span>
      <button class="secondary-btn" type="button" id="giftCardNextPage" ${giftCardPage >= pageCount ? "disabled" : ""}>Дараах</button>
    ` : "";
    document.getElementById("giftCardPrevPage")?.addEventListener("click", () => {
      giftCardPage -= 1;
      renderGiftCards();
    });
    document.getElementById("giftCardNextPage")?.addEventListener("click", () => {
      giftCardPage += 1;
      renderGiftCards();
    });
  }
}

function saveGiftCard(event) {
  event.preventDefault();
  const numbers = document.getElementById("giftCardNumbers").value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
  const amount = Number(formValue("giftCardAmount"));
  const expiryDate = document.getElementById("giftCardExpiry").value || "";
  if (!numbers.length || amount <= 0) return;

  if (giftCardEditingId) {
    const card = state.giftCards.find(item => Number(item.id) === Number(giftCardEditingId));
    const nextNumber = numbers[0];
    if (!card || !giftCardCanEdit(card)) {
      showToast("Зөвхөн ашиглаагүй картыг засна");
      return;
    }
    const duplicate = state.giftCards.some(item => item.cardNumber === nextNumber && Number(item.id) !== Number(card.id));
    if (duplicate) {
      showToast("Картын дугаар давхардсан байна");
      return;
    }
    card.cardNumber = nextNumber;
    card.amount = amount;
    card.remainingAmount = amount;
    card.expiryDate = expiryDate;
    showToast("Бэлгийн карт шинэчлэгдлээ");
  } else {
    let inserted = 0;
    let skipped = 0;
    numbers.forEach(number => {
      if (state.giftCards.some(card => card.cardNumber === number)) {
        skipped += 1;
        return;
      }
      state.giftCards.unshift({
        id: nextId(state.giftCards),
        cardNumber: number,
        status: "new",
        amount,
        remainingAmount: amount,
        createdAt: todayText(),
        expiryDate,
        usage: []
      });
      inserted += 1;
    });
    showToast(`${inserted} карт нэмэгдлээ${skipped ? `, ${skipped} давхардсан` : ""}`);
  }
  saveState();
  resetGiftCardForm();
  giftCardPage = 1;
  renderGiftCards();
  renderInfoHeader(activeView);
}

function editGiftCard(id) {
  const card = state.giftCards.find(item => Number(item.id) === Number(id));
  if (!card || !giftCardCanEdit(card)) return;
  giftCardEditingId = id;
  document.getElementById("giftCardNumbers").value = card.cardNumber;
  document.getElementById("giftCardAmount").value = card.amount;
  document.getElementById("giftCardExpiry").value = card.expiryDate || "";
  document.getElementById("giftCardSubmit").textContent = "Шинэчлэх";
  document.getElementById("giftCardNumbers").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toggleGiftCard(id) {
  const card = state.giftCards.find(item => Number(item.id) === Number(id));
  if (!card || giftCardStatus(card) === "used") return;
  if (!requireEditCode()) return;
  card.status = card.status === "inactive" ? "new" : "inactive";
  saveState();
  renderGiftCards();
  renderInfoHeader(activeView);
  showToast("Бэлгийн картын төлөв өөрчлөгдлөө");
}

function deleteGiftCard(id) {
  const card = state.giftCards.find(item => Number(item.id) === Number(id));
  if (!card || !giftCardCanEdit(card)) return;
  if (!requireDeleteCode()) return;
  state.giftCards = state.giftCards.filter(item => Number(item.id) !== Number(id));
  saveState();
  renderGiftCards();
  renderInfoHeader(activeView);
  showToast("Бэлгийн карт устлаа");
}

function homepageSettings() {
  const storedCatalog = state.homepageSettings?.catalog || {};
  const hasStoredFlipCode = Object.prototype.hasOwnProperty.call(storedCatalog, "flipHtml5Code");
  const hasLegacyFlipCode = Object.prototype.hasOwnProperty.call(storedCatalog, "customViewerHtml");
  const storedFlipCode = hasStoredFlipCode
    ? String(storedCatalog.flipHtml5Code ?? "")
    : hasLegacyFlipCode
      ? String(storedCatalog.customViewerHtml ?? "")
      : DEFAULT_CATALOG_VIEWER_HTML;
  const storedHintCss = String(storedCatalog.dragHintCss || DEFAULT_CATALOG_DRAG_HINT_CSS).replace(/#(?:68bd63|7da64b|789f4a)/gi, "#78a450");
  state.homepageSettings = {
    ...structuredClone(defaultState.homepageSettings),
    ...(state.homepageSettings || {}),
    catalog: {
      flipHtml5Code: storedFlipCode,
      dragHintEnabled: storedCatalog.dragHintEnabled !== false,
      dragHintHtml: storedCatalog.dragHintHtml || DEFAULT_CATALOG_DRAG_HINT_HTML,
      dragHintCss: storedHintCss,
      adCoverDesktop: Math.max(0, Math.min(300, Number(storedCatalog.adCoverDesktop) || 0)),
      adCoverMobile: Math.max(0, Math.min(300, Number(storedCatalog.adCoverMobile) || 0))
    },
    booking: {
      ...structuredClone(defaultState.homepageSettings.booking),
      ...(state.homepageSettings?.booking || {})
    },
    salons: { ...(state.homepageSettings?.salons || {}) },
    results: { ...structuredClone(defaultState.homepageSettings.results), ...(state.homepageSettings?.results || {}) }
  };
  state.homepageSettings.results.categories = Array.isArray(state.homepageSettings.results.categories) ? state.homepageSettings.results.categories : ["Бүгд"];
  state.homepageSettings.results.posts = Array.isArray(state.homepageSettings.results.posts) ? state.homepageSettings.results.posts : [];
  return state.homepageSettings;
}

function setHomepageSettingsTab(name = "catalog") {
  activeHomepageSettingsTab = ["catalog", "booking", "results"].includes(name) ? name : "catalog";
  document.querySelectorAll("[data-homepage-tab]").forEach(button => {
    const active = button.dataset.homepageTab === activeHomepageSettingsTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("homepageCatalogPanel")?.classList.toggle("hidden", activeHomepageSettingsTab !== "catalog");
  document.getElementById("homepageBookingPanel")?.classList.toggle("hidden", activeHomepageSettingsTab !== "booking");
  document.getElementById("homepageResultsPanel")?.classList.toggle("hidden", activeHomepageSettingsTab !== "results");
}

function homepageSalonConfig(salon) {
  const settings = homepageSettings();
  return settings.salons[salon.id] || settings.salons[salon.name] || { coverImage: "", gallery: [], mapUrl: "" };
}

function renderHomepageSalonSettings() {
  const root = document.getElementById("homepageSalonSettings");
  if (!root) return;
  root.innerHTML = state.salons.map(salon => {
    const config = homepageSalonConfig(salon);
    return `<article class="homepage-salon-setting" data-homepage-salon="${salon.id}">
      <div class="homepage-salon-title"><strong>${htmlSafe(salon.name)}</strong><span>${htmlSafe(salon.phone || "Утасгүй")}</span></div>
      <label>Cover зураг<input class="input homepage-salon-cover" value="${htmlSafe(config.coverImage || "")}" placeholder="assets/salons/cover.jpg"></label>
      <label>Slider зургууд<textarea class="input homepage-salon-gallery" placeholder="Нэг мөрөнд нэг зураг">${htmlSafe((config.gallery || []).join("\n"))}</textarea></label>
      <label>Google Maps холбоос<input class="input homepage-salon-map" value="${htmlSafe(config.mapUrl || "")}" placeholder="https://maps.google.com/..."></label>
    </article>`;
  }).join("") || `<div class="empty-state">Салбар бүртгээгүй байна</div>`;
}

function homepageResultImages(post = {}) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean).slice(0, 2) : [];
  if (!images.length) images.push(...[post.beforeImage, post.afterImage].filter(Boolean).slice(0, 2));
  return [images[0] || "", images[1] || ""];
}

function renderHomepageResultImageDraft() {
  [["homepageResultImageOne", "homepageResultImageOnePreview", "Эхний зураг"], ["homepageResultImageTwo", "homepageResultImageTwoPreview", "Хоёр дахь зураг"]].forEach(([inputId, previewId, label]) => {
    const url = document.getElementById(inputId)?.value || "";
    const preview = document.getElementById(previewId);
    if (preview) preview.innerHTML = url ? `<img src="${htmlSafe(url)}" alt="${label}">` : "";
  });
}

function safeRichTextColor(value = "") {
  const color = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(color) ? color : "";
}

function sanitizeHomepageRichText(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set(["B", "STRONG", "I", "EM", "UL", "OL", "LI", "P", "DIV", "BR", "SPAN"]);
  [...template.content.querySelectorAll("*")].reverse().forEach(element => {
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(tag)) {
      element.remove();
      return;
    }
    const color = safeRichTextColor(tag === "FONT" ? element.getAttribute("color") : element.style.color);
    const bold = /^(bold|[6-9]00)$/i.test(String(element.style.fontWeight || ""));
    const italic = String(element.style.fontStyle || "").toLowerCase() === "italic";
    if (tag === "FONT") {
      const span = document.createElement("span");
      if (color) span.style.color = color;
      span.append(...element.childNodes);
      element.replaceWith(span);
      return;
    }
    if (!allowed.has(tag)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
    if (tag === "SPAN" && color) element.style.color = color;
    if (bold && !["B", "STRONG"].includes(tag)) {
      const strong = document.createElement("strong");
      strong.append(...element.childNodes);
      element.append(strong);
    }
    if (italic && !["I", "EM"].includes(tag)) {
      const emphasis = document.createElement("em");
      emphasis.append(...element.childNodes);
      element.append(emphasis);
    }
  });
  return template.innerHTML.trim();
}

function homepageRichTextPlain(value = "") {
  const container = document.createElement("div");
  container.innerHTML = value;
  return String(container.textContent || "").trim();
}

function setHomepageResultDescription(value = "") {
  const editor = document.getElementById("homepageResultDescription");
  if (!editor) return;
  editor.innerHTML = sanitizeHomepageRichText(value);
  homepageResultEditorRange = null;
}

function captureHomepageResultEditorRange() {
  const editor = document.getElementById("homepageResultDescription");
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) homepageResultEditorRange = range.cloneRange();
}

function applyHomepageResultEditorCommand(command, value = null) {
  const editor = document.getElementById("homepageResultDescription");
  if (!editor) return;
  editor.focus();
  if (homepageResultEditorRange) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(homepageResultEditorRange);
  }
  document.execCommand("styleWithCSS", false, false);
  document.execCommand(command, false, value);
  captureHomepageResultEditorRange();
}

function resetHomepageResultForm() {
  homepageResultEditingId = null;
  document.getElementById("homepageResultForm")?.reset();
  ["homepageResultImageOne", "homepageResultImageTwo"].forEach(id => { const field = document.getElementById(id); if (field) field.value = ""; });
  setHomepageResultDescription("");
  renderHomepageResultImageDraft();
  const published = document.getElementById("homepageResultPublished");
  if (published) published.value = "true";
  const textColor = document.getElementById("homepageResultTextColor");
  if (textColor) textColor.value = "#666666";
  document.getElementById("homepageResultSubmit").textContent = "Нэмэх";
  document.getElementById("homepageResultCancel").classList.add("hidden");
  enhanceNativeSelects(["homepageResultPublished"]);
}

function renderHomepageResults() {
  const settings = homepageSettings();
  const list = document.getElementById("homepageResultList");
  if (!list) return;
  list.innerHTML = settings.results.posts.map(post => `<article class="homepage-result-item">
    <div><strong>${htmlSafe(post.title || "Гарчиггүй")}</strong>${post.webUrl ? `<span>${htmlSafe(post.webUrl)}</span>` : ""}</div>
    <span>${htmlSafe([post.duration, post.published === false ? "Нуусан" : "Нийтэлсэн"].filter(Boolean).join(" • "))}</span>
    <div class="table-actions"><button class="secondary-btn icon-action" type="button" data-homepage-result-edit="${post.id}" aria-label="Үр дүн засах" title="Засах">${editIcon()}</button><button class="danger-btn icon-danger" type="button" data-homepage-result-delete="${post.id}" aria-label="Үр дүн устгах">${trashIcon()}</button></div>
  </article>`).join("") || `<div class="empty-state">Үр дүн оруулаагүй байна</div>`;
  list.querySelectorAll("[data-homepage-result-edit]").forEach(button => {
    button.addEventListener("click", () => editHomepageResult(button.dataset.homepageResultEdit));
  });
  list.querySelectorAll("[data-homepage-result-delete]").forEach(button => {
    button.addEventListener("click", () => deleteHomepageResult(button.dataset.homepageResultDelete));
  });
}

function resetHomepageCatalogCodeFields() {
  const html = document.getElementById("homepageCatalogViewerHtml");
  const hintEnabled = document.getElementById("homepageCatalogDragHintEnabled");
  const hintHtml = document.getElementById("homepageCatalogDragHintHtml");
  const hintCss = document.getElementById("homepageCatalogDragHintCss");
  const adCoverDesktop = document.getElementById("homepageCatalogAdCoverDesktop");
  const adCoverMobile = document.getElementById("homepageCatalogAdCoverMobile");
  if (html) html.value = DEFAULT_CATALOG_VIEWER_HTML;
  if (hintEnabled) hintEnabled.value = "true";
  if (hintHtml) hintHtml.value = DEFAULT_CATALOG_DRAG_HINT_HTML;
  if (hintCss) hintCss.value = DEFAULT_CATALOG_DRAG_HINT_CSS;
  if (adCoverDesktop) adCoverDesktop.value = "0";
  if (adCoverMobile) adCoverMobile.value = "0";
  enhanceNativeSelects(["homepageCatalogDragHintEnabled"]);
  showToast("FlipHTML5 болон icon-ы эх код сэргээгдлээ. Хадгалах товч дарж баталгаажуулна уу");
}

function renderHomepageSettings() {
  const settings = homepageSettings();
  const viewerHtml = document.getElementById("homepageCatalogViewerHtml");
  const dragHintEnabled = document.getElementById("homepageCatalogDragHintEnabled");
  const dragHintHtml = document.getElementById("homepageCatalogDragHintHtml");
  const dragHintCss = document.getElementById("homepageCatalogDragHintCss");
  const adCoverDesktop = document.getElementById("homepageCatalogAdCoverDesktop");
  const adCoverMobile = document.getElementById("homepageCatalogAdCoverMobile");
  if (viewerHtml) viewerHtml.value = settings.catalog.flipHtml5Code ?? DEFAULT_CATALOG_VIEWER_HTML;
  if (dragHintEnabled) dragHintEnabled.value = settings.catalog.dragHintEnabled === false ? "false" : "true";
  if (dragHintHtml) dragHintHtml.value = settings.catalog.dragHintHtml || DEFAULT_CATALOG_DRAG_HINT_HTML;
  if (dragHintCss) dragHintCss.value = settings.catalog.dragHintCss || DEFAULT_CATALOG_DRAG_HINT_CSS;
  if (adCoverDesktop) adCoverDesktop.value = String(settings.catalog.adCoverDesktop || 0);
  if (adCoverMobile) adCoverMobile.value = String(settings.catalog.adCoverMobile || 0);
  renderHomepageSalonSettings();
  renderHomepageResults();
  document.getElementById("homepageCatalogPanel")?.classList.remove("hidden");
  document.getElementById("homepageResultsPanel")?.classList.remove("hidden");
  enhanceNativeSelects(["homepageResultPublished", "homepageCatalogDragHintEnabled"]);
}

function saveHomepageCatalog(event) {
  event.preventDefault();
  const settings = homepageSettings();
  settings.catalog.flipHtml5Code = formValue("homepageCatalogViewerHtml");
  settings.catalog.dragHintEnabled = formValue("homepageCatalogDragHintEnabled") !== "false";
  settings.catalog.dragHintHtml = formValue("homepageCatalogDragHintHtml") || DEFAULT_CATALOG_DRAG_HINT_HTML;
  settings.catalog.dragHintCss = formValue("homepageCatalogDragHintCss") || DEFAULT_CATALOG_DRAG_HINT_CSS;
  settings.catalog.adCoverDesktop = Math.max(0, Math.min(300, Number(formValue("homepageCatalogAdCoverDesktop")) || 0));
  settings.catalog.adCoverMobile = Math.max(0, Math.min(300, Number(formValue("homepageCatalogAdCoverMobile")) || 0));
  saveState();
  renderInfoHeader(activeView);
  showToast("Каталогийн тохиргоо хадгалагдлаа");
}

function saveHomepageSalons(event) {
  event.preventDefault();
  const settings = homepageSettings();
  document.querySelectorAll("[data-homepage-salon]").forEach(card => {
    settings.salons[card.dataset.homepageSalon] = {
      coverImage: card.querySelector(".homepage-salon-cover")?.value.trim() || "",
      gallery: String(card.querySelector(".homepage-salon-gallery")?.value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean),
      mapUrl: card.querySelector(".homepage-salon-map")?.value.trim() || ""
    };
  });
  saveState();
  showToast("Салоны нүүрний тохиргоо хадгалагдлаа");
}

function normalizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
    const url = new URL(normalized);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function saveHomepageResult(event) {
  event.preventDefault();
  const settings = homepageSettings();
  const wasEditing = Boolean(homepageResultEditingId);
  const images = [formValue("homepageResultImageOne"), formValue("homepageResultImageTwo")];
  const rawWebUrl = formValue("homepageResultWebUrl");
  const webUrl = normalizeExternalUrl(rawWebUrl);
  const descriptionHtml = sanitizeHomepageRichText(document.getElementById("homepageResultDescription")?.innerHTML || "");
  const payload = {
    title: formValue("homepageResultTitle"),
    duration: formValue("homepageResultDuration"),
    images,
    beforeImage: images[0],
    afterImage: images[1],
    description: homepageRichTextPlain(descriptionHtml),
    descriptionHtml,
    webUrl,
    published: document.getElementById("homepageResultPublished")?.value !== "false"
  };
  if (!payload.title) return showToast("Үр дүнгийн гарчиг оруулна уу");
  if (!images[0] || !images[1]) return showToast("Үр дүнгийн хоёр зургийг оруулна уу");
  if (rawWebUrl && !webUrl) return showToast("Web холбоосоо зөв оруулна уу");
  if (homepageResultEditingId) {
    const post = settings.results.posts.find(item => Number(item.id) === Number(homepageResultEditingId));
    if (post) Object.assign(post, payload);
  } else {
    settings.results.posts.unshift({ id: nextId(settings.results.posts), ...payload });
  }
  saveState();
  resetHomepageResultForm();
  renderHomepageResults();
  renderInfoHeader(activeView);
  showToast(wasEditing ? "Үр дүн шинэчлэгдлээ" : "Үр дүн нэмэгдлээ");
}

function editHomepageResult(id) {
  if (!requireEditCode()) return;
  const post = homepageSettings().results.posts.find(item => Number(item.id) === Number(id));
  if (!post) return;
  homepageResultEditingId = Number(id);
  const images = homepageResultImages(post);
  document.getElementById("homepageResultTitle").value = post.title || "";
  document.getElementById("homepageResultDuration").value = post.duration || "";
  document.getElementById("homepageResultImageOne").value = images[0];
  document.getElementById("homepageResultImageTwo").value = images[1];
  setHomepageResultDescription(post.descriptionHtml || htmlSafe(post.description || "").replace(/\n/g, "<br>"));
  document.getElementById("homepageResultWebUrl").value = post.webUrl || "";
  document.getElementById("homepageResultPublished").value = String(post.published !== false);
  renderHomepageResultImageDraft();
  syncNativeSelectProxy(document.getElementById("homepageResultPublished"));
  document.getElementById("homepageResultSubmit").textContent = "Хадгалах";
  document.getElementById("homepageResultCancel").classList.remove("hidden");
  document.getElementById("homepageResultTitle").focus();
}

function deleteHomepageResult(id) {
  if (!requireDeleteCode()) return;
  const settings = homepageSettings();
  const previousLength = settings.results.posts.length;
  settings.results.posts = settings.results.posts.filter(item => Number(item.id) !== Number(id));
  if (settings.results.posts.length === previousLength) return showToast("Устгах үр дүн олдсонгүй");
  if (Number(homepageResultEditingId) === Number(id)) resetHomepageResultForm();
  saveState();
  renderHomepageResults();
  renderInfoHeader(activeView);
  showToast("Үр дүн устлаа");
}

function databaseBackups() {
  return Array.isArray(serverDatabaseBackups) ? serverDatabaseBackups : [];
}

function databaseSelectedCategory() {
  return document.getElementById("databaseCategory")?.value || "all";
}

function databaseCategoryLabel(category = "all") {
  return {
    all: "Бүх өгөгдөл",
    customers: "Хэрэглэгч ба групп",
    bookings: "Цаг захиалга",
    services: "Үйлчилгээ ба оношилгоо",
    kass: "Касс ба төлбөр",
    staff: "Ажилтан ба томилгоо",
    settings: "Салбар ба тохиргоо"
  }[category] || "Бүх өгөгдөл";
}

function databaseCategoryStateKeys(category = "all") {
  const keys = {
    customers: ["customers", "customerGroups", "customerTypes", "customerTypeRules"],
    bookings: ["bookings"],
    services: ["customers", "services", "catalog", "diagnosisTypes"],
    kass: ["customers", "kassSchedules", "voucherLogs", "giftCards", "voucherRoles"],
    staff: ["staff", "assignments"],
    settings: ["salons", "holidays", "scheduleSettings", "generalSettings", "homepageSettings", "pricePolicy", "discounts"]
  };
  return keys[category] || Object.keys(state).filter(key => !key.startsWith("paginationDemo"));
}

function databaseCategoryData(category = "all", source = state) {
  const result = {};
  databaseCategoryStateKeys(category).forEach(key => {
    if (source[key] !== undefined) result[key] = structuredClone(source[key]);
  });
  if (category === "all" || category === "services") {
    result._serviceSettings = structuredClone(source._serviceSettings || {
      data: serviceSettingsData,
      groups: productGroups
    });
  }
  return result;
}

function databaseCategorySummaryText(category = "all") {
  const summaries = {
    all: `${state.customers.length} хэрэглэгч • ${state.bookings.length} цаг • ${state.staff.length} ажилтан`,
    customers: `${state.customers.length} хэрэглэгч • ${state.customerGroups.length} групп`,
    bookings: `${state.bookings.length} цаг захиалга`,
    services: `${state.customers.reduce((sum, customer) => sum + (customer.serviceHistory || []).length, 0)} үйлчилгээний түүх • ${state.diagnosisTypes.length} онош`,
    kass: `${kassRevenueSourceRows().length} төлбөр • ${state.kassSchedules.length} касс хуваарь`,
    staff: `${state.staff.length} ажилтан • ${state.assignments.length} томилгоо`,
    settings: `${state.salons.length} салбар • ${state.discounts.length} хямдрал`
  };
  return summaries[category] || summaries.all;
}

function databaseEnvelope(data = state, reason = "Гараар татсан", category = "all") {
  return {
    system: "Khalgai Salon System",
    version: 1,
    exportedAt: auditNowText(),
    reason,
    category,
    categoryLabel: databaseCategoryLabel(category),
    data: clearTransientState(data)
  };
}

async function loadDatabaseBackups({ silent = false } = {}) {
  if (!serverStorageReady || !isAdminAccount()) {
    serverDatabaseBackups = [];
    renderDatabaseBackups();
    return [];
  }
  try {
    const result = await serverApi("backups.php");
    serverDatabaseBackups = Array.isArray(result.backups) ? result.backups : [];
    serverBackupIntervalDays = Number(result.settings?.intervalDays ?? 14);
    localStorage.removeItem(DATABASE_BACKUP_KEY);
    renderDatabaseBackups();
    renderInfoHeader(activeView);
    return serverDatabaseBackups;
  } catch (error) {
    if (!silent) showToast(error?.message || "Backup жагсаалт ачаалсангүй");
    return [];
  }
}

async function createDatabaseBackup(reason = "Гараар үүсгэсэн backup") {
  if (!serverStorageReady) throw new Error("Server database-д нэвтэрсний дараа backup үүсгэнэ үү");
  const result = await serverApi("backups.php", {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  await loadDatabaseBackups({ silent: true });
  return result.backup;
}

function downloadDatabaseJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function databaseImportedState(payload) {
  const candidate = payload?.data || payload?.state || payload;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("JSON бүтэц буруу байна");
  const knownCollections = ["customers", "bookings", "salons", "staff", "catalog", "kassSchedules", "voucherLogs", "giftCards"];
  if (!knownCollections.some(key => Array.isArray(candidate[key]))) throw new Error("Салоны өгөгдөл олдсонгүй");
  return candidate;
}

function databaseRecordKey(collection, item, index) {
  if (item === null || typeof item !== "object") return `value:${String(item)}`;
  if (collection === "customers") {
    if (item.legacyCustomerId !== undefined && item.legacyCustomerId !== null) return `legacy-customer:${item.legacyCustomerId}`;
    return `phone:${item.phone || item.id || index}`;
  }
  if (collection === "salons") return `salon:${item.name || item.id || index}`;
  if (collection === "staff") return `staff:${item.phone || item.id || item.name || index}`;
  if (collection === "giftCards") return `card:${item.cardNumber || item.id || index}`;
  if (collection === "audit") return `audit:${item.createdAt || ""}:${item.title || ""}:${item.meta || ""}`;
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
  if (item.code) return `code:${item.code}`;
  return `json:${JSON.stringify(item)}`;
}

function databaseMergeArrays(collection, current = [], incoming = []) {
  const merged = new Map();
  current.forEach((item, index) => merged.set(databaseRecordKey(collection, item, index), structuredClone(item)));
  incoming.forEach((item, index) => {
    const key = databaseRecordKey(collection, item, current.length + index);
    const previous = merged.get(key);
    merged.set(key, previous && typeof previous === "object" && typeof item === "object" ? { ...previous, ...structuredClone(item) } : structuredClone(item));
  });
  return [...merged.values()];
}

function databaseMergeState(current, incoming) {
  const merged = structuredClone(current);
  Object.entries(incoming).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      merged[key] = databaseMergeArrays(key, Array.isArray(merged[key]) ? merged[key] : [], value);
    } else if (value && typeof value === "object") {
      merged[key] = { ...(merged[key] || {}), ...structuredClone(value) };
    } else {
      merged[key] = value;
    }
  });
  return merged;
}

function databaseReplaceCategoryState(current, incoming, category = "all") {
  if (category === "all") return { ...structuredClone(defaultState), ...structuredClone(incoming) };
  const replaced = structuredClone(current);
  databaseCategoryStateKeys(category).forEach(key => {
    if (incoming[key] !== undefined) replaced[key] = structuredClone(incoming[key]);
  });
  return replaced;
}

function persistImportedServiceSettings(incoming = {}) {
  if (!incoming._serviceSettings) return;
  localStorage.setItem(SERVICE_SETTINGS_KEY, JSON.stringify(incoming._serviceSettings));
}

function setDatabaseTab(name = "import") {
  activeDatabaseTab = ["import", "backup", "cleanup"].includes(name) ? name : "import";
  document.querySelector("#settingsDatabaseView .database-shell")?.classList.toggle("database-backup-open", activeDatabaseTab === "backup");
  document.querySelectorAll(".database-section-tab").forEach(button => {
    const active = button.dataset.databaseTab === activeDatabaseTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.getElementById("databaseImportTab")?.classList.toggle("hidden", activeDatabaseTab !== "import");
  document.getElementById("databaseBackupTab")?.classList.toggle("hidden", activeDatabaseTab !== "backup");
  document.getElementById("databaseCleanupTab")?.classList.toggle("hidden", activeDatabaseTab !== "cleanup");
  document.getElementById("databaseScopeBar")?.classList.toggle("hidden", activeDatabaseTab === "cleanup");
  if (activeDatabaseTab === "backup") renderDatabaseBackups();
}

function renderDatabaseBackups() {
  const list = document.getElementById("databaseBackupList");
  if (!list) return;
  const interval = document.getElementById("databaseBackupInterval");
  if (interval) {
    interval.value = String(serverBackupIntervalDays);
    syncNativeSelectProxy(interval);
  }
  const backups = databaseBackups();
  list.innerHTML = backups.map(backup => {
    const size = Math.max(1, Math.ceil(Number(backup.sizeBytes || 0) / 1024));
    return `
      <div class="database-backup-item">
        <div>
          <strong>${htmlSafe(backup.createdAt || "—")}</strong>
          <span>${htmlSafe(databaseCategoryLabel(backup.category || "all"))} • ${htmlSafe(backup.reason || "Backup")} • ${size} KB</span>
        </div>
        <div class="table-actions">
          <button class="secondary-btn database-backup-download" type="button" data-id="${backup.id}">Татах</button>
          <button class="secondary-btn database-backup-restore" type="button" data-id="${backup.id}">Сэргээх</button>
          <button class="danger-btn icon-danger database-backup-delete" type="button" data-id="${backup.id}" aria-label="Backup устгах">${trashIcon()}</button>
        </div>
      </div>
    `;
  }).join("") || `<div class="empty-state">Backup үүсгээгүй байна</div>`;

  list.querySelectorAll(".database-backup-download").forEach(button => {
    button.addEventListener("click", async () => {
      const backup = databaseBackups().find(item => Number(item.id) === Number(button.dataset.id));
      if (!backup) return;
      button.disabled = true;
      try {
        const result = await serverApi(`backups.php?id=${backup.id}`);
        downloadDatabaseJson(`khalgai-all-backup-${String(backup.createdAt || todayText()).replace(/[: ]/g, "-")}.json`, databaseEnvelope(result.data || {}, backup.reason, "all"));
      } catch (error) {
        showToast(error?.message || "Backup татаж чадсангүй");
      } finally {
        button.disabled = false;
      }
    });
  });
  list.querySelectorAll(".database-backup-restore").forEach(button => {
    button.addEventListener("click", async () => {
      if (!requireEditCode()) return;
      const backup = databaseBackups().find(item => Number(item.id) === Number(button.dataset.id));
      if (!backup || !window.confirm("Энэ backup-аас мэдээллийг сэргээх үү?")) return;
      button.disabled = true;
      try {
        await serverApi("backups.php", {
          method: "PUT",
          body: JSON.stringify({ id: backup.id })
        });
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DATABASE_BACKUP_KEY);
        window.location.reload();
      } catch (error) {
        button.disabled = false;
        showToast(error?.message || "Backup сэргээж чадсангүй");
      }
    });
  });
  list.querySelectorAll(".database-backup-delete").forEach(button => {
    button.addEventListener("click", async () => {
      if (!requireDeleteCode()) return;
      button.disabled = true;
      try {
        await serverApi("backups.php", {
          method: "DELETE",
          body: JSON.stringify({ id: Number(button.dataset.id) })
        });
        await loadDatabaseBackups({ silent: true });
        showToast("Backup устлаа");
      } catch (error) {
        button.disabled = false;
        showToast(error?.message || "Backup устгаж чадсангүй");
      }
    });
  });
}

function renderDatabaseSettings() {
  setDatabaseTab(activeDatabaseTab);
  const category = databaseSelectedCategory();
  const summary = document.getElementById("databaseCategorySummary");
  if (summary) summary.textContent = databaseCategorySummaryText(category);
  enhanceNativeSelects(["databaseCategory", "databaseImportMode", "databaseBackupInterval"]);
  renderDatabaseBackups();
  loadDatabaseBackups({ silent: true });
}

async function importDatabaseFile(event) {
  event.preventDefault();
  const file = document.getElementById("databaseImportFile")?.files?.[0];
  if (!file) return showToast("JSON файл сонгоно уу");
  try {
    const payload = JSON.parse(await file.text());
    const selectedCategory = databaseSelectedCategory();
    const category = selectedCategory === "all" && payload?.category && payload.category !== "all" ? payload.category : selectedCategory;
    const imported = databaseImportedState(payload);
    const incoming = databaseCategoryData(category, imported);
    const mode = document.getElementById("databaseImportMode")?.value || "merge";
    if (mode === "replace" && !requireEditCode()) return;
    if (!window.confirm(mode === "replace" ? "Одоогийн өгөгдлийг бүрэн солих уу?" : "Өгөгдлийг одоогийн сантай нэгтгэх үү?")) return;
    await createDatabaseBackup("Өгөгдөл импортлохын өмнөх автомат backup");
    const stateIncoming = structuredClone(incoming);
    delete stateIncoming._serviceSettings;
    const nextState = mode === "replace"
      ? databaseReplaceCategoryState(state, stateIncoming, category)
      : databaseMergeState(state, stateIncoming);
    persistImportedServiceSettings(incoming);
    if (!serverStorageReady) throw new Error("Server database-д нэвтэрсний дараа импорт хийнэ үү");
    const nextServerData = {
      ...clearTransientState(nextState),
      _serviceSettings: incoming._serviceSettings || {
        data: structuredClone(serviceSettingsData),
        groups: structuredClone(productGroups)
      }
    };
    const result = await serverApi("state.php", {
      method: "PUT",
      body: JSON.stringify({ revision: serverStorageRevision, data: nextServerData })
    });
    serverStorageRevision = Number(result.revision || serverStorageRevision);
    state = nextState;
    const localStateJson = JSON.stringify(clearTransientState(nextState));
    try {
      localStorage.setItem(STORAGE_KEY, localStateJson);
    } catch (storageError) {
      localStorage.removeItem(DATABASE_BACKUP_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
    window.location.reload();
  } catch (error) {
    showToast(error?.message || "Файл уншихад алдаа гарлаа");
  }
}

async function clearOperationalDatabase() {
  if (!requireDeleteCode()) return;
  if (!window.confirm("Үйл ажиллагааны бүх өгөгдлийг backup аваад цэвэрлэх үү?")) return;
  try {
    await createDatabaseBackup("Өгөгдөл цэвэрлэхийн өмнөх автомат backup");
    const cleaned = structuredClone(state);
    ["customers", "customerGroups", "bookings", "holidays", "assignments", "kassSchedules", "services", "voucherLogs", "giftCards"].forEach(key => {
      cleaned[key] = [];
    });
    cleaned.audit = [{ title: "database_cleared", meta: "Админ • Үйл ажиллагааны өгөгдөл цэвэрлэсэн", createdAt: auditNowText() }];
    cleaned.selectedCustomerId = null;
    cleaned.permanentlyDeletedCustomerIds = state.customers.map(item => Number(item.id));
    cleaned.databaseOperationalDataCleared = true;
    const result = await serverApi("state.php", {
      method: "PUT",
      body: JSON.stringify({ revision: serverStorageRevision, data: { ...clearTransientState(cleaned), _serviceSettings: serverStateData()._serviceSettings } })
    });
    serverStorageRevision = Number(result.revision || serverStorageRevision);
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  } catch (error) {
    showToast(error?.message || "Өгөгдөл цэвэрлэж чадсангүй");
  }
}

function auditActionText(title = "") {
  const actionNames = {
    staff_assigned: "Ажилтан өөр салбарт томилсон",
    staff_assignment_updated: "Ажилтны томилгоог зассан",
    staff_assignment_deleted: "Ажилтны томилгоог устгасан",
    payment_created: "Төлбөр бүртгэсэн",
    customer_created: "Шинэ хэрэглэгч бүртгэсэн",
    customer_updated: "Хэрэглэгчийн мэдээллийг зассан",
    customer_deleted: "Хэрэглэгчийг устгасан",
    customer_permanently_deleted: "Хэрэглэгчийг бүр мөсөн устгасан",
    service_created: "Үйлчилгээ бүртгэсэн",
    service_deleted: "Үйлчилгээ устгасан",
    booking_created: "Шинэ цаг захиалга бүртгэсэн",
    booking_updated: "Цаг захиалгыг зассан",
    booking_status_updated: "Цаг захиалгын төлөв өөрчилсөн",
    booking_deleted: "Цаг захиалга устгасан",
    kass_schedule_saved: "Касс хуваарь хадгалсан",
    staff_created: "Шинэ ажилтан бүртгэсэн",
    staff_updated: "Ажилтны мэдээллийг зассан",
    staff_status_updated: "Ажилтны төлөв өөрчилсөн",
    staff_deleted: "Ажилтан устгасан",
    branch_created: "Шинэ салбар нэмсэн",
    branch_updated: "Салбарын мэдээллийг зассан",
    branch_status_changed: "Салбарын төлөв өөрчилсөн",
    branch_deleted: "Салбар устгасан",
    holiday_saved: "Амралтын өдөр хадгалсан",
    holiday_deleted: "Амралтын өдөр устгасан",
    group_updated: "Группийн мэдээллийг зассан",
    catalog_created: "Бараа, үйлчилгээ нэмсэн",
    excel_exported: "Тайлан татсан",
    database_cleared: "Үйл ажиллагааны өгөгдөл цэвэрлэсэн",
    user_created: "Системийн хэрэглэгч нэмсэн",
    user_updated: "Системийн хэрэглэгчийн мэдээлэл зассан",
    user_status_changed: "Системийн хэрэглэгчийн төлөв өөрчилсөн"
  };
  return actionNames[title] || title || "Үйлдэл бүртгэгдсэн";
}

function auditMetaText(meta = "") {
  return String(meta)
    .replace(/\bReception\b/g, "Бүртгэлийн ажилтан")
    .replace(/\bSuper Admin\b/g, "Ерөнхий админ")
    .replace(/Staff performance report татсан/gi, "Ажилтны гүйцэтгэлийн тайлан татсан")
    .replace(/(\d+) слот\b/g, "$1 цагийн сонголт")
    .replace(/давхар орохоос хамгаалсан/gi, "давхар бүртгэгдээгүй")
    .replace(/гүйцэтгэлээс давхар хасна/gi, "ажилтны гүйцэтгэлээс мөн хасагдсан");
}

function auditMetaParts(meta = "") {
  const parts = auditMetaText(meta).split(" • ").map(part => part.trim()).filter(Boolean);
  return {
    actor: parts.shift() || "Менежер",
    details: parts.join(" • ") || "Системийн мэдээлэл шинэчилсэн"
  };
}

function auditCreatedAtText(value = "", demoIndex = 0) {
  if (!value) {
    const demoDate = new Date("2026-07-17T15:30:00");
    demoDate.setMinutes(demoDate.getMinutes() - demoIndex * 17);
    return `${demoDate.getFullYear()}-${String(demoDate.getMonth() + 1).padStart(2, "0")}-${String(demoDate.getDate()).padStart(2, "0")} ${String(demoDate.getHours()).padStart(2, "0")}:${String(demoDate.getMinutes()).padStart(2, "0")}`;
  }
  return String(value).replace("T", " ").slice(0, 16);
}

function renderAudit() {
  const list = document.getElementById("auditList");
  const filter = document.getElementById("auditActionFilter");
  const pagination = document.getElementById("auditPagination");
  if (!list || !filter || !pagination) return;

  const selectedType = filter.value;
  const actionTypes = [...new Set(state.audit.map(item => item.title).filter(Boolean))]
    .sort((a, b) => auditActionText(a).localeCompare(auditActionText(b), "mn"));
  filter.innerHTML = `<option value="">Бүх үйлдэл</option>${actionTypes.map(type => `<option value="${htmlSafe(type)}">${htmlSafe(auditActionText(type))}</option>`).join("")}`;
  filter.value = actionTypes.includes(selectedType) ? selectedType : "";
  enhanceNativeSelects(["auditActionFilter"]);

  const filtered = state.audit.filter(item => !filter.value || item.title === filter.value);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  auditPage = Math.min(Math.max(auditPage, 1), pageCount);
  const pageItems = filtered.slice((auditPage - 1) * pageSize, auditPage * pageSize);

  list.innerHTML = pageItems.map((item, index) => {
    const meta = auditMetaParts(item.meta);
    return `
      <div class="history-item">
        <strong>${htmlSafe(auditActionText(item.title))}</strong>
        <span class="audit-history-meta">${htmlSafe(auditCreatedAtText(item.createdAt, (auditPage - 1) * pageSize + index))} • ${htmlSafe(meta.actor)} • ${htmlSafe(meta.details)}</span>
      </div>
    `;
  }).join("") || `<div class="empty-state">Сонгосон төрлийн үйлдэл бүртгэгдээгүй байна</div>`;

  pagination.innerHTML = filtered.length > pageSize ? `
    <button class="secondary-btn" type="button" id="auditPrev" ${auditPage <= 1 ? "disabled" : ""}>Өмнөх</button>
    <span>${auditPage} / ${pageCount}</span>
    <button class="secondary-btn" type="button" id="auditNext" ${auditPage >= pageCount ? "disabled" : ""}>Дараах</button>
  ` : "";
  document.getElementById("auditPrev")?.addEventListener("click", () => {
    auditPage -= 1;
    renderAudit();
  });
  document.getElementById("auditNext")?.addEventListener("click", () => {
    auditPage += 1;
    renderAudit();
  });
}

function updateServiceTotal() {
  const itemId = Number(document.getElementById("serviceItem").value || 1);
  const item = state.catalog.find(c => c.id === itemId) || state.catalog[0];
  const policy = pricePolicy();
  const surcharge = (document.getElementById("vipRoom").checked ? policy.vipRoomFee : 0) + (document.getElementById("vipStaff").checked ? policy.masterStaffFee : 0);
  document.getElementById("basePrice").textContent = money(item.price);
  document.getElementById("surchargePrice").textContent = money(surcharge);
  document.getElementById("totalPrice").textContent = money(item.price + surcharge);
}

function openCustomerModal() {
  const defaultBonus = `${customerTypeRule("Хэрэглэгч").bonusPercent}%`;
  openModal(
    "Хэрэглэгч нэмэх",
    "Бүртгэлийн мэдээлэл",
    `
      <form id="customerModalForm" class="clean-form customer-create-form">
        <label>Нэр
          <input id="modalCustomerName" class="input" required placeholder="Жишээ: Бат Хулан">
        </label>
        <label>Утас
          <input id="modalCustomerPhone" class="input" required inputmode="numeric" maxlength="8" minlength="8" placeholder="99112233">
        </label>
        <label>Нас
          <input id="modalCustomerAge" class="input" required type="number" min="1" max="120" placeholder="32">
        </label>
        <label>Хүйс
          <select id="modalCustomerGender" class="input" required>
            <option value="" disabled selected>Сонгох</option>
            <option>Эмэгтэй</option>
            <option>Эрэгтэй</option>
          </select>
        </label>
        <label>Дүүрэг
          <input id="modalCustomerDistrict" class="input" required placeholder="Жишээ: Хан-Уул">
        </label>
        <label>Хороо
          <input id="modalCustomerKhoroo" class="input" required placeholder="Жишээ: 2-р хороо">
        </label>
        <label>Төрөл
          <select id="modalCustomerType" class="input" required>
            ${customerTypeOptions("Хэрэглэгч")}
          </select>
        </label>
        <label>Bonus хувь
          <input id="modalCustomerBonus" class="input" value="${defaultBonus}" readonly>
        </label>
        <div class="form-actions">
          <button type="button" class="secondary-btn icon-clear" id="cancelModal" aria-label="Болих">×</button>
          <button type="submit" class="primary-btn">Хадгалах</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      document.getElementById("modalCustomerType").addEventListener("change", event => {
        document.getElementById("modalCustomerBonus").value = `${customerTypeRule(event.target.value).bonusPercent}%`;
      });
      enhanceNativeSelects(["modalCustomerType", "modalCustomerGender"]);
      document.getElementById("customerModalForm").addEventListener("submit", event => {
        event.preventDefault();
        const customerId = nextId(state.customers);
        const phone = formValue("modalCustomerPhone");
        if (phone.length !== 8) {
          showToast("Утасны дугаар 8 оронтой байна");
          return;
        }
        const selectedType = formValue("modalCustomerType") || "Хэрэглэгч";
        const ageValue = formValue("modalCustomerAge");
        const birthYear = birthYearFromAge(ageValue);
        state.customers.unshift({
          id: customerId,
          name: formValue("modalCustomerName"),
          phone,
          age: birthYear ? customerAge({ birthYear }) : "",
          birthYear,
          gender: formValue("modalCustomerGender"),
          district: formValue("modalCustomerDistrict"),
          khoroo: formValue("modalCustomerKhoroo"),
          type: selectedType,
          bonus: formValue("modalCustomerBonus") || defaultBonus,
          activeCourse: false,
          course: "",
          unpaid: false,
          spent: 0,
          balance: 0,
          last: "-",
          registeredAt: todayText(),
          salon: activeAccount.salon,
          groupId: null,
          groupRole: "",
          currentTreatment: null,
          serviceHistory: []
        });
        state.selectedCustomerId = customerId;
        state.audit.unshift({ title: "customer_created", meta: `Менежер • ${formValue("modalCustomerName")} • ${selectedType}` });
        saveState();
        closeModal();
        renderCustomers();
        renderAudit();
        showToast("Хэрэглэгч нэмэгдлээ");
      });
    }
  );
}

function openStaffModal() {
  openModal(
    "Ажилтан нэмэх",
    "Үндсэн салбар, Вип эсэх, урамшуулал тохируулна",
    `
      <form id="staffModalForm" class="clean-form">
        <label>Нэр
          <input id="modalStaffName" class="input" required placeholder="Жишээ: Энхмаа">
        </label>
        <label>Үндсэн салбар
          <select id="modalStaffSalon" class="input">
            ${state.salons.map(s => `<option>${s.name}</option>`).join("")}
          </select>
        </label>
        <label>Commission
          <input id="modalStaffCommission" class="input" value="10%">
        </label>
        <label class="check"><input type="checkbox" id="modalStaffVip"> Вип ажилтан</label>
        <div class="form-actions">
          <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
          <button type="submit" class="primary-btn">Хадгалах</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      document.getElementById("staffModalForm").addEventListener("submit", event => {
        event.preventDefault();
        state.staff.unshift({
          id: nextId(state.staff),
          name: formValue("modalStaffName"),
          salon: formValue("modalStaffSalon"),
          vip: document.getElementById("modalStaffVip").checked,
          commission: formValue("modalStaffCommission") || "10%",
          status: "active"
        });
        state.audit.unshift({ title: "staff_created", meta: `Менежер • ${formValue("modalStaffName")} • ${formValue("modalStaffSalon")}` });
        saveState();
        closeModal();
        renderStaff();
        renderAudit();
        showToast("Ажилтан нэмэгдлээ");
      });
    }
  );
}

function openCatalogModal() {
  openModal(
    "Catalog нэмэх",
    "Үйлчилгээ, бүтээгдэхүүний үндсэн жагсаалт. Салбар өөрөө засахгүй.",
    `
      <form id="catalogModalForm" class="clean-form">
        <label>Код
          <input id="modalCatalogCode" class="input" required placeholder="SRV-005">
        </label>
        <label>Нэр
          <input id="modalCatalogName" class="input" required placeholder="Үйлчилгээний нэр">
        </label>
        <label>Төрөл
          <select id="modalCatalogType" class="input">
            <option value="service">service</option>
            <option value="course">course</option>
            <option value="product">product</option>
          </select>
        </label>
        <label>Default үнэ
          <input id="modalCatalogPrice" class="input" type="number" value="50000">
        </label>
        <label>Хамаарах салбар
          <select id="modalCatalogSalons" class="input">
            <option>Бүх салбар</option>
            <option>Сонгосон</option>
            ${state.salons.map(s => `<option>${s.name}</option>`).join("")}
          </select>
        </label>
        <div class="form-actions">
          <button type="button" class="secondary-btn" id="cancelModal">Болих</button>
          <button type="submit" class="primary-btn">Хадгалах</button>
        </div>
      </form>
    `,
    () => {
      document.getElementById("cancelModal").addEventListener("click", closeModal);
      document.getElementById("catalogModalForm").addEventListener("submit", event => {
        event.preventDefault();
        state.catalog.unshift({
          id: nextId(state.catalog),
          code: formValue("modalCatalogCode"),
          name: formValue("modalCatalogName"),
          type: formValue("modalCatalogType"),
          price: Number(formValue("modalCatalogPrice") || 0),
          salons: formValue("modalCatalogSalons"),
          rules: "Admin managed"
        });
        state.audit.unshift({ title: "catalog_created", meta: `Super Admin • ${formValue("modalCatalogName")} • ${money(formValue("modalCatalogPrice"))}` });
        saveState();
        closeModal();
        renderCatalog();
        renderAudit();
        showToast("Catalog нэмэгдлээ");
      });
    }
  );
}

function updateBookingStatus(id, status) {
  const booking = state.bookings.find(item => Number(item.id) === Number(id));
  if (!booking || !canAccessSalon(booking.salon)) return showToast("Өөр салбарын цагийг өөрчлөх эрхгүй");
  booking.status = status;
  state.audit.unshift({ title: "booking_status_updated", meta: `Админ • ${booking.phone} • ${bookingStatusText(status)}` });
  saveState();
  renderBookings();
  renderAudit();
  renderInfoHeader(activeView);
  showToast(status === "confirmed" ? "Цаг батлагдлаа" : "Цаг цуцлагдлаа");
}

function requireDeleteCode() {
  const code = window.prompt("Устгах код оруулна уу");
  if (code === null) return false;
  if (code.trim() === String(generalSettings().deleteCode || DELETE_CODE)) return true;
  showToast("Устгах код буруу байна");
  return false;
}

function requireEditCode() {
  const code = window.prompt("Засах код оруулна уу");
  if (code === null) return false;
  if (code.trim() === String(generalSettings().deleteCode || DELETE_CODE)) return true;
  showToast("Засах код буруу байна");
  return false;
}

function deleteBooking(id) {
  const booking = state.bookings.find(item => Number(item.id) === Number(id));
  if (!booking || !canAccessSalon(booking.salon)) return showToast("Өөр салбарын цагийг устгах эрхгүй");
  if (!requireDeleteCode()) return;
  state.bookings = state.bookings.filter(item => Number(item.id) !== Number(id));
  if (booking) {
    state.audit.unshift({ title: "booking_deleted", meta: `Админ • ${booking.phone} • ${booking.date} ${booking.time}` });
  }
  saveState();
  renderBookings();
  renderAudit();
  renderInfoHeader(activeView);
  showToast("Цаг устгагдлаа");
}

function setupCustomSelect() {
  [
    ["bookingStatusDropdown", "bookingStatusFilter"],
    ["bookingSalonDropdown", "bookingSalonFilter"]
  ].forEach(([dropdownId, inputId]) => {
    const dropdown = document.getElementById(dropdownId);
    const input = document.getElementById(inputId);
    if (!dropdown || !input) return;
    const trigger = dropdown.querySelector(".custom-select-trigger");
    const triggerText = trigger.querySelector("span");
    const menu = dropdown.querySelector(".custom-select-menu");
    if (dropdown.dataset.bound === "true" || !menu) return;
    dropdown.dataset.bound = "true";

    trigger.addEventListener("click", () => {
      document.querySelectorAll(".panel-head-actions .custom-select.open").forEach(item => {
        if (item !== dropdown) item.classList.remove("open");
      });
      const isOpen = dropdown.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });

    menu.addEventListener("click", event => {
      const option = event.target.closest("button[data-value]");
      if (!option || !menu.contains(option)) return;
      input.value = option.dataset.value;
      triggerText.textContent = option.textContent;
      menu.querySelectorAll("button[data-value]").forEach(item => item.classList.toggle("active", item === option));
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      bookingPage = 1;
      renderBookings();
    });

    document.addEventListener("click", event => {
      if (dropdown.contains(event.target)) return;
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    });
  });
}

function resetCustomSelect(dropdownId, inputId) {
  const dropdown = document.getElementById(dropdownId);
  const input = document.getElementById(inputId);
  if (!dropdown || !input) return;
  const firstOption = dropdown.querySelector(".custom-select-menu button");
  const triggerText = dropdown.querySelector(".custom-select-trigger span");
  if (!firstOption || !triggerText) return;
  input.value = firstOption.dataset.value;
  triggerText.textContent = firstOption.textContent;
  dropdown.querySelectorAll(".custom-select-menu button").forEach(option => {
    option.classList.toggle("active", option === firstOption);
  });
  dropdown.classList.remove("open");
  dropdown.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
}

function clearBookingFilters() {
  document.getElementById("bookingSearch").value = "";
  document.getElementById("bookingDateFilter").value = "";
  resetCustomSelect("bookingSalonDropdown", "bookingSalonFilter");
  if (isSalonAccount()) {
    document.getElementById("bookingSalonFilter").value = activeAccount.salon;
    renderSalons();
  }
  resetCustomSelect("bookingStatusDropdown", "bookingStatusFilter");
  bookingPage = 1;
  renderBookings();
}

function setupInlineCustomSelects(root = document) {
  root.querySelectorAll(".custom-select[data-input]").forEach(dropdown => {
    if (dropdown.dataset.bound === "1") return;
    const input = document.getElementById(dropdown.dataset.input);
    const trigger = dropdown.querySelector(".custom-select-trigger");
    const triggerText = trigger.querySelector("span");
    const options = dropdown.querySelectorAll(".custom-select-menu button");
    if (!input || !trigger || !triggerText) return;
    dropdown.dataset.bound = "1";

    trigger.addEventListener("click", () => {
      root.querySelectorAll(".custom-select.open").forEach(item => {
        if (item !== dropdown) item.classList.remove("open");
      });
      const isOpen = dropdown.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
    });

    options.forEach(option => {
      option.addEventListener("click", () => {
        input.value = option.dataset.value;
        triggerText.textContent = option.textContent;
        options.forEach(item => item.classList.toggle("active", item === option));
        dropdown.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        input.dispatchEvent(new Event("change"));
      });
    });

    document.addEventListener("click", event => {
      if (dropdown.contains(event.target)) return;
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    });
  });
}

function enhanceNativeSelect(select) {
  if (!select) return;
  if (select.nextElementSibling?.classList.contains("native-select-proxy")) {
    select.nextElementSibling.remove();
  }
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  const wrapper = document.createElement("div");
  wrapper.className = `custom-select native-select-proxy${select.disabled ? " locked" : ""}`;
  wrapper.innerHTML = `
    <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span>${selectedOption?.textContent || ""}</span>
    </button>
    <div class="custom-select-menu" role="listbox"></div>
  `;
  const menu = wrapper.querySelector(".custom-select-menu");
  const trigger = wrapper.querySelector(".custom-select-trigger");
  trigger.disabled = select.disabled;
  Array.from(select.options).forEach(option => {
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.classList.toggle("active", option.value === select.value);
    item.addEventListener("click", () => {
      select.value = option.value;
      wrapper.querySelector(".custom-select-trigger span").textContent = option.textContent;
      menu.querySelectorAll("button").forEach(button => button.classList.toggle("active", button === item));
      wrapper.classList.remove("open");
      wrapper.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.appendChild(item);
  });
  trigger.addEventListener("click", () => {
    if (select.disabled) return;
    document.querySelectorAll(".custom-select.open").forEach(item => {
      if (item !== wrapper) item.classList.remove("open");
    });
    const isOpen = wrapper.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
  select.classList.add("native-select-hidden");
  select.insertAdjacentElement("afterend", wrapper);
}

function syncNativeSelectProxy(select) {
  if (!select) return;
  const proxy = select.nextElementSibling?.classList.contains("native-select-proxy")
    ? select.nextElementSibling
    : null;
  if (!proxy) return;
  proxy.classList.toggle("locked", select.disabled);
  proxy.querySelector(".custom-select-trigger").disabled = select.disabled;
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  proxy.querySelector(".custom-select-trigger span").textContent = selectedOption?.textContent || "";
  proxy.querySelectorAll(".custom-select-menu button").forEach(button => {
    button.classList.toggle("active", button.dataset.value === select.value);
  });
}

function enhanceNativeSelects(ids) {
  ids.forEach(id => enhanceNativeSelect(document.getElementById(id)));
  if (!nativeSelectCloseBound) {
    document.addEventListener("click", event => {
      document.querySelectorAll(".native-select-proxy.open, .schedule-time-proxy.open").forEach(dropdown => {
        if (dropdown.contains(event.target)) return;
        dropdown.classList.remove("open");
        dropdown.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
      });
    });
    nativeSelectCloseBound = true;
  }
}

function scheduleTimeOptions() {
  const options = [];
  for (let hour = 7; hour <= 22; hour += 1) {
    options.push(`${String(hour).padStart(2, "0")}:00`);
    options.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return options;
}

function enhanceScheduleTimeInput(input) {
  if (!input) return;
  if (input.nextElementSibling?.classList.contains("schedule-time-proxy")) {
    input.nextElementSibling.remove();
  }
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select schedule-time-proxy";
  const selected = input.value || "09:00";
  wrapper.innerHTML = `
    <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span>${selected}</span>
    </button>
    <div class="custom-select-menu schedule-time-menu" role="listbox"></div>
  `;
  const trigger = wrapper.querySelector(".custom-select-trigger");
  const menu = wrapper.querySelector(".schedule-time-menu");
  scheduleTimeOptions().forEach(time => {
    const option = document.createElement("button");
    option.type = "button";
    option.textContent = time;
    option.classList.toggle("active", time === selected);
    option.addEventListener("click", () => {
      input.value = time;
      wrapper.querySelector(".custom-select-trigger span").textContent = time;
      menu.querySelectorAll("button").forEach(button => button.classList.toggle("active", button === option));
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    menu.appendChild(option);
  });
  trigger.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach(item => {
      if (item !== wrapper) item.classList.remove("open");
    });
    const isOpen = wrapper.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
  input.classList.add("native-select-hidden");
  input.insertAdjacentElement("afterend", wrapper);
}

function enhanceScheduleTimeInputs() {
  ["scheduleWorkStart", "scheduleWorkEnd", "scheduleWeekendStart", "scheduleWeekendEnd"].forEach(id => {
    enhanceScheduleTimeInput(document.getElementById(id));
  });
}

function closeBookingForm() {
  const slot = document.getElementById("bookingInlineSlot");
  if (slot) slot.innerHTML = "";
}

function getSalonCapacity(salonName) {
  const salon = state.salons.find(item => item.name === salonName);
  if (salon?.slotCapacity) return Number(salon.slotCapacity);
  return String(salonName || "").includes("Төв") ? 6 : 4;
}

function bookedCountForSlot(salonName, date, time, editingId) {
  return state.bookings.filter(booking =>
    booking.salon === salonName &&
    booking.date === date &&
    booking.time === time &&
    Number(booking.id) !== Number(editingId)
  ).length;
}

function bookingSlotMarkup(index, values, editing = false) {
  const salons = accountSalons();
  const requestedSalon = isSalonAccount() ? activeAccount.salon : values.salon;
  const selectedSalon = salons.some(salon => salon.name === requestedSalon) ? requestedSalon : salons[0]?.name || "";
  const selectedDate = values.date || todayText();
  const selectedTime = values.time || bookingOptionsForSalon(selectedSalon)[0] || "";
  return `
    <div class="booking-slot-row${index > 0 ? " extra-slot-row" : ""}" data-slot-index="${index}">
      <label>Салон
        <input type="hidden" class="booking-salon" id="bookingSalon${index}" value="${selectedSalon}">
        <div class="custom-select${isSalonAccount() ? " locked" : ""}" data-input="bookingSalon${index}">
          <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" ${isSalonAccount() ? "disabled" : ""}>
            <span>${selectedSalon}</span>
          </button>
          <div class="custom-select-menu" role="listbox">
            ${salons.map(s => `<button type="button" data-value="${s.name}" class="${s.name === selectedSalon ? "active" : ""}">${s.name}</button>`).join("")}
          </div>
        </div>
      </label>
      <label>Огноо
        <input class="input booking-date" type="date" min="${todayText()}" value="${selectedDate}">
      </label>
      <label>Цаг
        <input type="hidden" class="booking-time" value="${selectedTime}">
        <div class="custom-select time-dropdown booking-time-dropdown">
          <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span>${selectedTime}</span>
          </button>
          <div class="custom-select-menu time-menu booking-time-menu" role="listbox"></div>
        </div>
      </label>
    </div>
  `;
}

function renderBookingTimeOptions(editingId, row) {
  const rows = row ? [row] : Array.from(document.querySelectorAll(".booking-slot-row"));
  rows.forEach(slotRow => renderBookingTimeOptionsForRow(editingId, slotRow));
}

function renderBookingTimeOptionsForRow(editingId, slotRow) {
  const dropdown = slotRow.querySelector(".booking-time-dropdown");
  const menu = slotRow.querySelector(".booking-time-menu");
  const input = slotRow.querySelector(".booking-time");
  const triggerText = dropdown?.querySelector(".custom-select-trigger span");
  const salonName = slotRow.querySelector(".booking-salon")?.value || "";
  const date = slotRow.querySelector(".booking-date")?.value || "";
  if (!dropdown || !menu || !input || !triggerText) return;
  const capacity = getSalonCapacity(salonName);
  const timeOptions = bookingOptionsForSalon(salonName);
  const closedHoliday = holidayForDate(salonName, date);
  let firstAvailable = "";
  const availableByTime = timeOptions.map(time => ({
    time,
    occupied: bookedCountForSlot(salonName, date, time, editingId),
    past: isPastBookingTime(date, time) || Boolean(closedHoliday)
  }));
  firstAvailable = availableByTime.find(item => !item.past && item.occupied < capacity)?.time || "";
  if (closedHoliday || !input.value || isPastBookingTime(date, input.value) || bookedCountForSlot(salonName, date, input.value, editingId) >= capacity) {
    input.value = firstAvailable;
  }
  triggerText.textContent = closedHoliday ? "Амралтын өдөр" : input.value || "Сул цаггүй";
  menu.style.gridTemplateColumns = `repeat(${capacity}, minmax(58px, 1fr))`;
  menu.innerHTML = availableByTime.map(({ time, occupied, past }) => {
    return Array.from({ length: capacity }, (_, index) => {
      const disabled = past || index < occupied;
      const selected = input.value === time && !disabled && index === occupied ? " selected" : "";
      return `<button type="button" class="time-option${selected}" data-time="${time}" ${disabled ? "disabled" : ""}>${time}</button>`;
    }).join("");
  }).join("");
  menu.querySelectorAll(".time-option:not(:disabled)").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.dataset.time;
      triggerText.textContent = button.dataset.time;
      menu.querySelectorAll(".time-option").forEach(item => item.classList.toggle("selected", item === button));
      dropdown.classList.remove("open");
      dropdown.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
    });
  });
}

function bindBookingSlotRow(row, editId) {
  row.querySelector(".booking-time-dropdown").querySelector(".custom-select-trigger").addEventListener("click", () => {
    const dropdown = row.querySelector(".booking-time-dropdown");
    const isOpen = dropdown.classList.toggle("open");
    dropdown.querySelector(".custom-select-trigger").setAttribute("aria-expanded", String(isOpen));
  });
  row.querySelector(".booking-salon").addEventListener("change", () => renderBookingTimeOptions(editId, row));
  row.querySelector(".booking-date").addEventListener("change", () => renderBookingTimeOptions(editId, row));
}

function updateBookingSlotCount() {
  const count = document.getElementById("bookingSlotCount");
  if (count) count.value = document.querySelectorAll(".booking-slot-row").length;
}

function setBookingSlotCount(targetCount, editId) {
  const slots = document.getElementById("bookingSlots");
  if (!slots) return;
  const safeCount = Math.max(1, Math.min(4, targetCount));
  let rows = Array.from(document.querySelectorAll(".booking-slot-row"));
  while (rows.length < safeCount) {
    const index = rows.length;
    const lastRow = rows[rows.length - 1];
    const lastSalon = lastRow?.querySelector(".booking-salon")?.value || state.salons[0]?.name || "";
    const lastDate = lastRow?.querySelector(".booking-date")?.value || todayText();
    const nextTime = lastRow?.querySelector(".booking-time")?.value || bookingOptionsForSalon(lastSalon)[0] || "";
    slots.insertAdjacentHTML("beforeend", bookingSlotMarkup(index, {
      salon: lastSalon,
      date: lastDate,
      time: nextTime
    }));
    const newRow = slots.querySelector(`.booking-slot-row[data-slot-index="${index}"]`);
    setupInlineCustomSelects(newRow);
    bindBookingSlotRow(newRow, editId);
    renderBookingTimeOptions(editId, newRow);
    rows = Array.from(document.querySelectorAll(".booking-slot-row"));
  }
  while (rows.length > safeCount) {
    rows[rows.length - 1].remove();
    rows = Array.from(document.querySelectorAll(".booking-slot-row"));
  }
  updateBookingSlotCount();
}

function openBookingModal(editId) {
  const editing = state.bookings.find(item => Number(item.id) === Number(editId));
  if (editing && !canAccessSalon(editing.salon)) return showToast("Өөр салбарын цагийг засах эрхгүй");
  const minDate = todayText();
  const selectedDate = editing && !isPastDate(editing.date) ? editing.date : minDate;
  const selectedSalon = isSalonAccount() ? activeAccount.salon : (editing?.salon || state.salons[0]?.name || "");
  const selectedTime = editing?.time || bookingOptionsForSalon(selectedSalon)[0] || "";
  const slot = document.getElementById("bookingInlineSlot");
  slot.innerHTML = `
    <form id="bookingForm" class="clean-form inline-booking-form">
      <div class="inline-form-head">
        <strong>${editing ? "Цаг засах" : "Цаг захиалга"}</strong>
      </div>
      <div class="booking-entry-row">
        <div class="booking-slots" id="bookingSlots">
          ${bookingSlotMarkup(0, { salon: selectedSalon, date: selectedDate, time: selectedTime }, Boolean(editing))}
        </div>
        ${editing ? `<span class="slot-stepper-placeholder"></span>` : `
          <label class="slot-stepper-field">Слот
            <div class="slot-stepper" aria-label="Слотын тоо">
              <button class="secondary-btn slot-step-btn" id="bookingSlotMinus" type="button" aria-label="Слот хасах">−</button>
              <input class="input slot-count-input" id="bookingSlotCount" type="text" value="1" readonly aria-label="Слотын тоо">
              <button class="secondary-btn slot-step-btn" id="bookingSlotPlus" type="button" aria-label="Слот нэмэх">+</button>
            </div>
          </label>
        `}
        <label>Утас
          <input id="bookingPhone" class="input" required inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="99112233" value="${editing?.phone || ""}">
        </label>
        <div class="inline-booking-actions">
          <button class="primary-btn" type="submit">${editing ? "Хадгалах" : "Цаг бүртгэх"}</button>
        </div>
      </div>
    </form>
  `;
  setupInlineCustomSelects(slot);
  bindBookingSlotRow(slot.querySelector(".booking-slot-row"), editId);
  renderBookingTimeOptions(editId);
  if (!bookingDropdownCloseBound) {
    document.addEventListener("click", event => {
      document.querySelectorAll(".booking-time-dropdown.open").forEach(dropdown => {
        if (dropdown.contains(event.target)) return;
        dropdown.classList.remove("open");
        dropdown.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
      });
    });
    bookingDropdownCloseBound = true;
  }
  document.getElementById("bookingSlotMinus")?.addEventListener("click", () => {
    setBookingSlotCount(document.querySelectorAll(".booking-slot-row").length - 1, editId);
  });
  document.getElementById("bookingSlotPlus")?.addEventListener("click", () => {
    const currentCount = document.querySelectorAll(".booking-slot-row").length;
    if (currentCount >= 4) {
      showToast("Нэг дуудлагаар 4 хүртэл цаг захиална");
      return;
    }
    setBookingSlotCount(currentCount + 1, editId);
  });
  document.getElementById("bookingPhone").addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("bookingForm").addEventListener("submit", event => {
    event.preventDefault();
    const phone = document.getElementById("bookingPhone").value.trim();
    if (!/^\d{8}$/.test(phone)) {
      showToast("Утасны 8 оронтой дугаар оруулна уу");
      document.getElementById("bookingPhone").focus();
      return;
    }
    const slotValues = Array.from(document.querySelectorAll(".booking-slot-row")).map(row => ({
      salon: row.querySelector(".booking-salon").value,
      date: row.querySelector(".booking-date").value,
      time: row.querySelector(".booking-time").value,
      row
    }));
    if (slotValues.some(item => !canAccessSalon(item.salon))) {
      showToast("Зөвхөн өөрийн салбарт цаг бүртгэнэ");
      return;
    }
    const emptySlot = slotValues.find(item => !item.time);
    if (emptySlot) {
      showToast("Сул цаг сонгоно уу");
      renderBookingTimeOptions(editId, emptySlot.row);
      return;
    }
    const holidaySlot = slotValues.find(item => isHolidayClosed(item.salon, item.date));
    if (holidaySlot) {
      showToast("Тухайн өдөр амралттай байна");
      renderBookingTimeOptions(editId, holidaySlot.row);
      return;
    }
    const pastSlot = slotValues.find(item => isPastBookingTime(item.date, item.time));
    if (pastSlot) {
      showToast("Өнгөрсөн өдөр, цаг сонгох боломжгүй");
      renderBookingTimeOptions(editId, pastSlot.row);
      return;
    }
    const overCapacitySlot = slotValues.find(item => {
      const selectedCount = slotValues.filter(other =>
        other.salon === item.salon &&
        other.date === item.date &&
        other.time === item.time
      ).length;
      return bookedCountForSlot(item.salon, item.date, item.time, editId) + selectedCount > getSalonCapacity(item.salon);
    });
    if (overCapacitySlot) {
      showToast("Суудлын багтаамжаас хэтэрсэн байна");
      return;
    }
    if (editing) {
      const firstSlot = slotValues[0];
      editing.salon = firstSlot.salon;
      editing.date = firstSlot.date;
      editing.time = firstSlot.time;
      editing.phone = phone;
      state.audit.unshift({ title: "booking_updated", meta: `Админ • ${phone} • ${editing.date} ${editing.time} • ${bookingStatusText(editing.status)}` });
    } else {
      slotValues.slice().reverse().forEach((item, index) => {
        state.bookings.unshift({
          id: Date.now() + index,
          salon: item.salon,
          date: item.date,
          time: item.time,
          phone,
          source: "admin",
          status: "confirmed"
        });
      });
      state.audit.unshift({ title: "booking_created", meta: `Админ • ${phone} • ${slotValues.length} слот` });
    }
    saveState();
    openBookingModal();
    renderBookings();
    renderAudit();
    renderInfoHeader(activeView);
    showToast(editing ? "Цаг өөрчлөгдлөө" : "Цаг баталгаажлаа");
  });
  slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function bindEvents() {
  document.querySelectorAll(".nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });
  document.querySelectorAll(".nav-subitem").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });
  document.getElementById("settingsToggle").addEventListener("click", () => {
    if (document.body.classList.contains("sidebar-collapsed")) {
      document.body.classList.remove("sidebar-collapsed");
      localStorage.setItem(SIDEBAR_COMPACT_KEY, "expanded");
    }
    const submenu = document.getElementById("settingsSubmenu");
    const isOpen = submenu.classList.toggle("open");
    document.getElementById("settingsToggle").setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll("[data-view-target]").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.viewTarget));
  });
  document.querySelectorAll("[data-schedule-section]").forEach(button => {
    button.addEventListener("click", () => setScheduleSection(button.dataset.scheduleSection));
  });

  document.getElementById("serverLogoutBtn")?.addEventListener("click", async () => {
    try {
      await serverApi("logout.php", { method: "POST", body: "{}" });
    } finally {
      window.location.reload();
    }
  });
  document.getElementById("systemUserForm")?.addEventListener("submit", saveSystemUser);
  document.getElementById("systemUserRole")?.addEventListener("change", updateSystemUserSalonField);
  document.getElementById("systemUserCancel")?.addEventListener("click", resetSystemUserForm);
  document.getElementById("systemUsername")?.addEventListener("input", event => {
    event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);
  });
  document.getElementById("systemUserSearch")?.addEventListener("input", renderSystemUsers);
  ["systemUserRoleFilter", "systemUserStatusFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderSystemUsers);
  });
  document.getElementById("clearSystemUserFilters")?.addEventListener("click", () => {
    document.getElementById("systemUserSearch").value = "";
    document.getElementById("systemUserRoleFilter").value = "";
    document.getElementById("systemUserStatusFilter").value = "";
    renderSystemUsers();
  });
  document.getElementById("systemUserRows")?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-system-user-edit]");
    const toggleButton = event.target.closest("[data-system-user-toggle]");
    if (editButton) editSystemUser(editButton.dataset.systemUserEdit);
    if (toggleButton) toggleSystemUser(toggleButton.dataset.systemUserToggle);
  });

  document.getElementById("branchForm")?.addEventListener("submit", saveBranch);
  document.getElementById("branchCancel")?.addEventListener("click", closeBranchForm);
  document.getElementById("branchPageSettingsForm")?.addEventListener("submit", saveBranchPageSettings);
  document.getElementById("branchPhone")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("branchCoverUpload")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      document.getElementById("branchCoverImage").value = await uploadBranchImage(file);
      renderBranchMediaDraft();
      showToast("Cover зураг нэмэгдлээ");
    } catch (error) { showToast(error.message || "Зураг upload хийсэнгүй"); }
    event.target.value = "";
  });
  document.getElementById("branchGalleryUpload")?.addEventListener("change", async event => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    try {
      for (const file of files) branchGalleryDraft.push(await uploadBranchImage(file));
      renderBranchMediaDraft();
      showToast(`${files.length} slider зураг нэмэгдлээ`);
    } catch (error) { showToast(error.message || "Зураг upload хийсэнгүй"); }
    event.target.value = "";
  });
  document.getElementById("branchCoverPreview")?.addEventListener("click", event => {
    if (!event.target.closest("[data-branch-cover-remove]")) return;
    document.getElementById("branchCoverImage").value = "";
    renderBranchMediaDraft();
  });
  document.getElementById("branchGalleryList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-branch-gallery-remove]");
    if (!button) return;
    branchGalleryDraft.splice(Number(button.dataset.branchGalleryRemove), 1);
    renderBranchMediaDraft();
  });
  document.getElementById("holidayForm")?.addEventListener("submit", saveHoliday);
  document.getElementById("hrStaffForm")?.addEventListener("submit", saveHumanResourceStaff);
  document.getElementById("hrAssignmentForm")?.addEventListener("submit", saveHumanResourceAssignment);
  document.getElementById("voucherRoleForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = formValue("voucherRoleName");
    const position = formValue("voucherRolePosition");
    if (!name) return;
    const wasEditing = Boolean(voucherRoleEditingId);
    if (wasEditing) {
      const role = state.voucherRoles.find(item => Number(item.id) === Number(voucherRoleEditingId));
      if (role) Object.assign(role, { name, position });
      voucherRoleEditingId = null;
    } else {
      state.voucherRoles.unshift({ id: nextVoucherRoleId(), name, position });
    }
    saveState();
    event.target.reset();
    renderVouchers();
    renderInfoHeader(activeView);
    showToast(wasEditing ? "Ваучерийн эрх шинэчлэгдлээ" : "Ваучерийн эрх хадгалагдлаа");
  });
  ["voucherDateFilter", "voucherCustomerFilter", "voucherPhoneFilter", "voucherRoleFilter"].forEach(id => {
    const rerenderVoucherFirstPage = () => {
      voucherPage = 1;
      renderVouchers();
    };
    document.getElementById(id)?.addEventListener("input", rerenderVoucherFirstPage);
    document.getElementById(id)?.addEventListener("change", rerenderVoucherFirstPage);
  });
  document.getElementById("voucherPhoneFilter")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("voucherClearBtn")?.addEventListener("click", () => {
    ["voucherDateFilter", "voucherCustomerFilter", "voucherPhoneFilter", "voucherRoleFilter"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    voucherPage = 1;
    renderVouchers();
  });
  document.getElementById("giftCardForm")?.addEventListener("submit", saveGiftCard);
  ["giftCardNumberFilter", "giftCardStatusFilter", "giftCardFromFilter", "giftCardToFilter"].forEach(id => {
    const rerenderGiftCardsFirstPage = () => {
      giftCardPage = 1;
      renderGiftCards();
    };
    document.getElementById(id)?.addEventListener("input", rerenderGiftCardsFirstPage);
    document.getElementById(id)?.addEventListener("change", rerenderGiftCardsFirstPage);
  });
  document.getElementById("giftCardClearBtn")?.addEventListener("click", () => {
    ["giftCardNumberFilter", "giftCardStatusFilter", "giftCardFromFilter", "giftCardToFilter"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.value = id === "giftCardStatusFilter" ? "all" : "";
    });
    syncNativeSelectProxy(document.getElementById("giftCardStatusFilter"));
    giftCardPage = 1;
    renderGiftCards();
  });
  document.getElementById("giftCardImportBtn")?.addEventListener("click", () => {
    showToast("Импортын загвар бэлэн");
  });
  document.getElementById("infoExcelBtn")?.addEventListener("click", () => {
    if (activeView === "performance") return exportPerformanceCsv();
    showToast(activeView === "giftCards" ? "Бэлгийн картын Excel бэлтгэгдлээ" : "Ваучерийн Excel бэлтгэгдлээ");
  });
  document.getElementById("pricePolicyForm")?.addEventListener("submit", savePricePolicy);
  document.getElementById("customerTypeForm")?.addEventListener("submit", saveCustomerType);
  document.getElementById("discountForm")?.addEventListener("submit", saveDiscount);
  document.getElementById("generalSettingsForm")?.addEventListener("submit", saveGeneralSettings);
  document.querySelectorAll("[data-homepage-tab]").forEach(button => {
    button.addEventListener("click", () => setHomepageSettingsTab(button.dataset.homepageTab));
  });
  document.getElementById("homepageCatalogForm")?.addEventListener("submit", saveHomepageCatalog);
  document.getElementById("homepageCatalogCodeReset")?.addEventListener("click", resetHomepageCatalogCodeFields);
  document.getElementById("homepageSalonForm")?.addEventListener("submit", saveHomepageSalons);
  document.getElementById("homepageResultForm")?.addEventListener("submit", saveHomepageResult);
  document.getElementById("homepageResultCancel")?.addEventListener("click", resetHomepageResultForm);
  const resultEditor = document.getElementById("homepageResultDescription");
  ["keyup", "mouseup", "input", "focus"].forEach(name => resultEditor?.addEventListener(name, captureHomepageResultEditorRange));
  document.querySelectorAll("[data-result-editor-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => applyHomepageResultEditorCommand(button.dataset.resultEditorCommand));
  });
  const applyResultColor = document.getElementById("homepageResultApplyColor");
  applyResultColor?.addEventListener("mousedown", event => event.preventDefault());
  applyResultColor?.addEventListener("click", () => {
    applyHomepageResultEditorCommand("foreColor", document.getElementById("homepageResultTextColor")?.value || "#666666");
  });
  [["homepageResultImageOneUpload", "homepageResultImageOne"], ["homepageResultImageTwoUpload", "homepageResultImageTwo"]].forEach(([uploadId, valueId]) => {
    document.getElementById(uploadId)?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        document.getElementById(valueId).value = await uploadBranchImage(file);
        renderHomepageResultImageDraft();
        showToast("Үр дүнгийн зураг нэмэгдлээ");
      } catch (error) {
        showToast(error.message || "Зураг upload хийсэнгүй");
      }
      event.target.value = "";
    });
  });
  document.getElementById("diagnosisCaptureMode")?.addEventListener("change", toggleDiagnosisCaptureSizeSetting);
  document.getElementById("diagnosisTypeForm")?.addEventListener("submit", saveDiagnosisType);
  document.querySelectorAll(".database-section-tab").forEach(button => {
    button.addEventListener("click", () => setDatabaseTab(button.dataset.databaseTab));
  });
  document.getElementById("databaseImportForm")?.addEventListener("submit", importDatabaseFile);
  document.getElementById("databaseImportFile")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    document.getElementById("databaseImportSummary").textContent = file ? `${file.name} • ${Math.max(1, Math.ceil(file.size / 1024))} KB` : "Файл сонгоогүй байна.";
  });
  document.getElementById("databaseCategory")?.addEventListener("change", () => {
    renderDatabaseSettings();
    renderInfoHeader("settingsDatabase");
  });
  document.getElementById("databaseExportCurrent")?.addEventListener("click", () => {
    const category = databaseSelectedCategory();
    downloadDatabaseJson(`khalgai-${category}-${todayText()}.json`, databaseEnvelope(databaseCategoryData(category), "Одоогийн өгөгдлийн экспорт", category));
  });
  document.getElementById("databaseCreateBackup")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await createDatabaseBackup();
      showToast("Server backup үүслээ");
    } catch (error) {
      showToast(error?.message || "Backup үүсгэж чадсангүй");
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("databaseBackupInterval")?.addEventListener("change", async event => {
    const select = event.currentTarget;
    const previousValue = serverBackupIntervalDays;
    const intervalDays = Number(select.value);
    select.disabled = true;
    try {
      const result = await serverApi("backups.php", {
        method: "PATCH",
        body: JSON.stringify({ intervalDays })
      });
      serverBackupIntervalDays = Number(result.settings?.intervalDays ?? intervalDays);
      showToast(intervalDays === 0 ? "Автомат backup унтарлаа" : `Автомат backup ${intervalDays} хоног тутам үүснэ`);
    } catch (error) {
      serverBackupIntervalDays = previousValue;
      select.value = String(previousValue);
      showToast(error?.message || "Backup хугацаа хадгалсангүй");
    } finally {
      select.disabled = false;
    }
  });
  document.getElementById("databaseClearOperationalData")?.addEventListener("click", clearOperationalDatabase);
  ["dashboardViewMode", "dashboardMonth", "dashboardSalon"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      renderDashboard();
      renderInfoHeader("dashboard");
    });
  });
  document.getElementById("dashboardExportExcel")?.addEventListener("click", exportDashboardExcel);
  document.getElementById("dashboardContent")?.addEventListener("click", event => {
    const button = event.target.closest("[data-dashboard-chart]");
    if (!button) return;
    dashboardChartModes[button.dataset.dashboardChart] = button.dataset.dashboardMode;
    localStorage.setItem(DASHBOARD_CHART_MODE_KEY, JSON.stringify(dashboardChartModes));
    renderDashboard();
  });
  document.getElementById("auditActionFilter")?.addEventListener("change", () => {
    auditPage = 1;
    renderAudit();
  });
  document.getElementById("auditFilterClear")?.addEventListener("click", () => {
    document.getElementById("auditActionFilter").value = "";
    auditPage = 1;
    renderAudit();
  });
  ["kassRevenueFrom", "kassRevenueTo", "kassRevenueSalon"].forEach(id => {
    const rerenderRevenue = () => {
      const from = document.getElementById("kassRevenueFrom")?.value || "";
      const to = document.getElementById("kassRevenueTo")?.value || "";
      if (from && to && to < from) return showToast("Огнооны дарааллыг зөв оруулна уу");
      kassRevenuePage = 1;
      renderKassRevenue();
    };
    document.getElementById(id)?.addEventListener("input", rerenderRevenue);
    document.getElementById(id)?.addEventListener("change", rerenderRevenue);
  });
  document.getElementById("kassRevenueClear")?.addEventListener("click", () => {
    document.getElementById("kassRevenueFrom").value = todayText();
    document.getElementById("kassRevenueTo").value = todayText();
    const salon = document.getElementById("kassRevenueSalon");
    if (salon && !isSalonAccount()) salon.value = "";
    syncNativeSelectProxy(salon);
    kassRevenuePage = 1;
    renderKassRevenue();
  });
  document.getElementById("kassScheduleForm")?.addEventListener("submit", saveKassSchedule);
  document.getElementById("kassSalon")?.addEventListener("change", () => {
    populateKassSelects();
  });
  ["kassFromFilter", "kassToFilter", "kassStaffFilter", "kassSalonFilter"].forEach(id => {
    const rerenderKassFirstPage = () => {
      kassPage = 1;
      renderKassSchedule();
    };
    document.getElementById(id)?.addEventListener("input", rerenderKassFirstPage);
    document.getElementById(id)?.addEventListener("change", rerenderKassFirstPage);
  });
  document.getElementById("kassClearBtn")?.addEventListener("click", () => {
    document.getElementById("kassFromFilter").value = "";
    document.getElementById("kassToFilter").value = "";
    document.getElementById("kassStaffFilter").value = "";
    document.getElementById("kassSalonFilter").value = "";
    kassPage = 1;
    renderKassSchedule();
  });
  document.getElementById("hrCancelEdit")?.addEventListener("click", resetHumanResourceForm);
  document.getElementById("hrAssignmentCancel")?.addEventListener("click", () => {
    resetHumanResourceAssignmentForm();
    renderHumanResourceAssignments();
  });
  ["hrAssignmentNameSearch", "hrAssignmentFromSearch", "hrAssignmentToSearch"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => {
      const from = document.getElementById("hrAssignmentFromSearch")?.value || "";
      const to = document.getElementById("hrAssignmentToSearch")?.value || "";
      if (from && to && to < from) return showToast("Огнооны дарааллыг зөв оруулна уу");
      assignmentPage = 1;
      renderHumanResourceAssignments();
    });
  });
  document.getElementById("hrAssignmentSearchClear")?.addEventListener("click", () => {
    ["hrAssignmentNameSearch", "hrAssignmentFromSearch", "hrAssignmentToSearch"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    assignmentPage = 1;
    renderHumanResourceAssignments();
  });
  document.querySelectorAll(".hr-section-tab").forEach(button => {
    button.addEventListener("click", () => setHumanResourceTab(button.dataset.hrTab));
  });
  document.querySelectorAll(".performance-section-tab").forEach(button => {
    button.addEventListener("click", () => setPerformanceTab(button.dataset.performanceTab));
  });
  document.getElementById("hrStaffPhone")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("performanceFilterForm")?.addEventListener("submit", event => {
    event.preventDefault();
  });
  document.getElementById("performanceMonth")?.addEventListener("change", event => {
    const range = performanceRangeForMonth(event.target.value);
    document.getElementById("performanceFrom").value = range.from;
    document.getElementById("performanceTo").value = range.to;
    renderPerformance();
    renderInfoHeader("performance");
  });
  ["performanceFrom", "performanceTo"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      const from = formValue("performanceFrom");
      const to = formValue("performanceTo");
      if (from && to && to < from) return showToast("Огнооны дарааллыг зөв оруулна уу");
      renderPerformance();
      renderInfoHeader("performance");
    });
  });
  document.getElementById("performanceSalon")?.addEventListener("change", () => {
    renderPerformance();
    renderInfoHeader("performance");
  });
  document.getElementById("performanceClear")?.addEventListener("click", () => {
    const latestMonth = performanceDataMonths()[0] || "";
    const range = performanceRangeForMonth(latestMonth);
    document.getElementById("performanceMonth").value = latestMonth;
    document.getElementById("performanceFrom").value = range.from;
    document.getElementById("performanceTo").value = range.to;
    document.getElementById("performanceSalon").value = "all";
    renderPerformance();
    renderInfoHeader("performance");
  });

  document.getElementById("scheduleSave")?.addEventListener("click", saveScheduleSettings);
  document.getElementById("scheduleSalon")?.addEventListener("change", event => {
    renderScheduleSettings(event.target.value);
  });
  ["scheduleWorkStart", "scheduleWorkEnd", "scheduleWeekendStart", "scheduleWeekendEnd", "scheduleDuration", "scheduleCapacity"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderSchedulePreview);
  });

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 820px)").matches) {
      document.getElementById("sidebar").classList.toggle("open");
      return;
    }
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem(SIDEBAR_COMPACT_KEY, collapsed ? "collapsed" : "expanded");
  };
  document.getElementById("menuButton")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebarCollapseBtn")?.addEventListener("click", toggleSidebar);

  ["customerSearch", "customerKhorooFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => {
      customerPage = 1;
      renderCustomers();
    });
  });
  ["customerDistrictFilter", "customerTypeFilter", "customerWorkFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      customerPage = 1;
      renderCustomers();
    });
  });
  document.getElementById("clearCustomerFilters")?.addEventListener("click", clearCustomerFilters);
  document.getElementById("customerSortToggle")?.addEventListener("click", () => {
    customerSortMode = customerSortMode === "date" ? "name" : "date";
    customerPage = 1;
    renderCustomers();
  });
  document.getElementById("bookingSearch").addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
    bookingPage = 1;
    renderBookings();
  });
  document.getElementById("bookingDateFilter").addEventListener("change", () => {
    bookingPage = 1;
    renderBookings();
  });
  document.getElementById("clearBookingFilters").addEventListener("click", clearBookingFilters);
  setupCustomSelect();

  ["serviceItem", "vipRoom", "vipStaff"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", updateServiceTotal);
  });

  document.getElementById("serviceForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const customer = state.customers.find(c => c.id === Number(document.getElementById("serviceCustomer").value));
    const item = state.catalog.find(c => c.id === Number(document.getElementById("serviceItem").value));
    const staff = state.staff.find(s => s.id === Number(document.getElementById("serviceStaff").value));
    const policy = pricePolicy();
    const surcharge = (document.getElementById("vipRoom").checked ? policy.vipRoomFee : 0) + (document.getElementById("vipStaff").checked ? policy.masterStaffFee : 0);
    state.services.unshift({ customer: customer.name, service: item.name, staff: staff.name, total: item.price + surcharge, salon: "Хан-Уул салбар" });
    state.audit.unshift({ title: "service_created", meta: `Менежер • ${customer.name} • ${item.name} • давхар орохоос хамгаалсан` });
    saveState();
    renderServices();
    renderAudit();
    showToast("Үйлчилгээ нэмэгдлээ");
  });

  document.getElementById("assignmentForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const staff = state.staff.find(s => s.id === Number(document.getElementById("assignStaff").value));
    state.assignments.unshift({
      staff: staff.name,
      from: staff.salon,
      to: document.getElementById("assignSalon").value,
      date: document.getElementById("assignDate").value,
      time: "09:00-18:00"
    });
    state.audit.unshift({ title: "staff_assigned", meta: `Менежер • ${staff.name} → ${document.getElementById("assignSalon").value}` });
    saveState();
    renderAssignments();
    renderAudit();
    showToast("Ажилтан томилогдлоо");
  });

  document.getElementById("newCustomerBtn")?.addEventListener("click", () => {
    openCustomerModal();
  });
  document.getElementById("customerInlineForm")?.addEventListener("submit", saveInlineCustomer);
  document.getElementById("inlineCustomerType")?.addEventListener("change", event => {
    syncNativeSelectProxy(event.target);
  });

  document.getElementById("newStaffBtn")?.addEventListener("click", openStaffModal);
  document.getElementById("newCatalogBtn")?.addEventListener("click", openCatalogModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", event => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
}

function initializeSidebarNavigation() {
  const iconPaths = {
    bookings: "M7 2v3M17 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2Z",
    customers: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    kass: "M4 3h16v18H4zM8 7h8M8 11h2m4 0h2M8 15h2m4 0h2",
    performance: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    vouchers: "M4 6h16v12H4zM8 6v12M12 9h5M12 13h5",
    giftCards: "M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7.5A2.5 2.5 0 1 1 12 4.5V7Zm0 0h4.5A2.5 2.5 0 1 0 12 4.5V7Z",
    settingsDiscounts: "M19 5 5 19M7 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    settingsHumanResources: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6",
    settingsSchedule: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h3M8 17h6",
    admin: "M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5l-8-3Zm0 5v5m0 4h.01"
  };
  document.querySelectorAll(".nav-item").forEach(button => {
    if (button.querySelector(".nav-icon")) return;
    const label = button.textContent.trim();
    const key = button.id === "settingsToggle" ? "admin" : button.dataset.view;
    const path = iconPaths[key] || iconPaths.admin;
    button.innerHTML = `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg><span class="nav-label">${label}</span>`;
    button.title = label;
  });
  document.querySelectorAll(".nav-subitem").forEach(button => {
    if (button.querySelector(".nav-label")) return;
    const label = button.textContent.trim();
    button.innerHTML = `<span class="nav-sub-dot" aria-hidden="true"></span><span class="nav-label">${label}</span>`;
    button.title = label;
  });
  const compactViewport = window.matchMedia("(min-width: 821px) and (max-width: 1180px)").matches;
  const desktopViewport = window.matchMedia("(min-width: 821px)").matches;
  const preference = localStorage.getItem(SIDEBAR_COMPACT_KEY);
  document.body.classList.toggle("sidebar-collapsed", desktopViewport && (preference === "collapsed" || (compactViewport && preference !== "expanded")));
  window.addEventListener("resize", () => {
    if (window.matchMedia("(max-width: 820px)").matches) {
      document.body.classList.remove("sidebar-collapsed");
      return;
    }
    const saved = localStorage.getItem(SIDEBAR_COMPACT_KEY);
    const compact = window.matchMedia("(max-width: 1180px)").matches;
    document.body.classList.toggle("sidebar-collapsed", saved === "collapsed" || (compact && saved !== "expanded"));
  });
}

function init() {
  removeRetiredViews();
  applyActiveAccount(activeAccount);
  ensureHumanResourceShell();
  initializeSidebarNavigation();
  loadServiceSettings();
  restoreCoreServiceSettingsIfMissing();
  migrateSalonSchedules();
  refreshBookingTimeOptions();
  renderScheduleSettings();
  renderSalons();
  renderBranches();
  renderHolidaySettings();
  renderAssignments();
  renderCustomers();
  renderProfile();
  renderCatalog();
  renderStaff();
  renderHumanResources();
  renderPricePolicySettings();
  renderDiscountSettings();
  renderGeneralSettings();
  renderKassSchedule();
  renderKassRevenue();
  renderVouchers();
  renderGiftCards();
  renderDashboard();
  renderGroupDirectory();
  renderPerformance();
  renderBookings();
  renderServices();
  renderAudit();
  resetSystemUserForm();
  bindEvents();
  openBookingModal();
  setView("bookings");
}

init();
initializeServerStorage();

window.addEventListener("focus", () => {
  if (AUTO_REFRESH_VIEWS.has(activeView)) void refreshServerStateForView(activeView);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && AUTO_REFRESH_VIEWS.has(activeView)) void refreshServerStateForView(activeView);
});
window.setInterval(() => {
  if (!document.hidden && AUTO_REFRESH_VIEWS.has(activeView)) void refreshServerStateForView(activeView);
}, 10000);
