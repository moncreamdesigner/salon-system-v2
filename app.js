const money = value => `${Number(value).toLocaleString("en-US")}₮`;
const formatNumber = value => Number(value).toLocaleString("en-US");
const parseMoneyInput = value => Number(String(value || "").replace(/[^\d]/g, "")) || 0;
const moneyInputValue = value => Number(value || 0) > 0 ? formatNumber(value) : "";

const STORAGE_KEY = "khalgai_salon_local_mvp_v1";
const DELETE_CODE = "1989";
let bookingDropdownCloseBound = false;
let nativeSelectCloseBound = false;

const defaultState = {
  salons: [
    { id: 1, name: "Хан-Уул салбар", address: "Хан-Уул дүүрэг, 2-р хороо, АПУ ХХК-ийн замын эсрэг талд, 75-р сургуулийн хойно 35Б байр.", phone: "80024373", active: true, bookings: 18, revenue: 1820000, staff: "8/9", status: "Ачаалал хэвийн", slotCapacity: 4 },
    { id: 2, name: "Төв салбар", address: "Чингэлтэй дүүрэг, 3-р хороо, Peace mall худалдааны төвийн хойно.", phone: "89894373", active: true, bookings: 22, revenue: 2140000, staff: "6/8", status: "Ажилтан хэрэгтэй", slotCapacity: 6 },
    { id: 3, name: "Вип салбар", address: "Хан-Уул дүүрэг, Вип өрөөтэй салбар.", phone: "80024444", active: true, bookings: 8, revenue: 860000, staff: "5/5", status: "Вип өрөөтэй", slotCapacity: 4 }
  ],
  customers: [
    { id: 1, name: "Бат Хулан", phone: "99137481", type: "Хэрэглэгч", bonus: "5%", activeCourse: true, course: "Курс 3/8", unpaid: true, spent: 8400000, balance: 128000, last: "2026-07-10", age: 34, gender: "Эмэгтэй", district: "Хан-Уул", khoroo: "2-р хороо", registeredAt: "2026-07-10" },
    { id: 2, name: "Энх Номин", phone: "88112233", type: "Тусгай хэрэглэгч", bonus: "10%", activeCourse: true, course: "Курс 6/8", unpaid: false, spent: 12600000, balance: 420000, last: "2026-07-08", age: 41, gender: "Эмэгтэй", district: "Чингэлтэй", khoroo: "3-р хороо", registeredAt: "2026-07-08" },
    { id: 3, name: "Болор", phone: "99001122", type: "Ажилтан", bonus: "-", activeCourse: false, course: "", unpaid: true, spent: 2200000, balance: 0, last: "2026-06-29", age: 29, gender: "Эмэгтэй", district: "Баянгол", khoroo: "6-р хороо", registeredAt: "2026-06-29" },
    { id: 4, name: "Мөнхзул", phone: "80808080", type: "Хэрэглэгч", bonus: "2%", activeCourse: false, course: "", unpaid: false, spent: 680000, balance: 13600, last: "2026-07-01", age: 27, gender: "Эмэгтэй", district: "Хан-Уул", khoroo: "15-р хороо", registeredAt: "2026-07-01" },
    { id: 5, name: "Сарангэрэл", phone: "99110022", type: "Тусгай хэрэглэгч", bonus: "8%", activeCourse: false, course: "", unpaid: false, spent: 6200000, balance: 210000, last: "2026-06-18", age: 45, gender: "Эмэгтэй", district: "Хан-Уул", khoroo: "11-р хороо", registeredAt: "2026-06-18" },
    { id: 6, name: "Алтанцэцэг", phone: "88004455", type: "Хэрэглэгч", bonus: "3%", activeCourse: false, course: "", unpaid: true, spent: 1450000, balance: 29000, last: "2026-07-12", age: 38, gender: "Эмэгтэй", district: "Сүхбаатар", khoroo: "8-р хороо", registeredAt: "2026-07-12", currentTreatment: { id: "tr-6", service: "Тэжээлийн эмчилгээ", salon: "Хан-Уул салбар", stage: "Төлбөр дутуу", progress: "Нэг удаа", staff: "Ариундулам", paymentBalance: 45000, startedAt: "2026-07-12" } }
  ],
  customerGroups: [
    { id: 1, name: "99137481", adminCustomerId: 1, spent2y: 8400000, bonusPool: 420000, usedBonus: 292000, members: [1, 4] },
    { id: 2, name: "88112233", adminCustomerId: 2, spent2y: 12600000, bonusPool: 1260000, usedBonus: 840000, members: [2, 5] }
  ],
  catalog: [
    { id: 1, code: "SRV-001", name: "Үүргийн хурс эмчилгээ", type: "course", price: 81250, salons: "Бүх салбар", rules: "QR, зураг" },
    { id: 2, code: "SRV-002", name: "Арьс оношилгоо", type: "service", price: 45000, salons: "Бүх салбар", rules: "Зураг шаардлагатай" },
    { id: 3, code: "PRD-101", name: "Арчилгааны бүтээгдэхүүн", type: "product", price: 65000, salons: "Сонгосон", rules: "Бүтээгдэхүүн" },
    { id: 4, code: "Вип-001", name: "Вип арчилгаа", type: "service", price: 120000, salons: "Вип салбар", rules: "Вип зөвшөөрсөн" }
  ],
  staff: [
    { id: 1, name: "Хулан", salon: "Хан-Уул салбар", vip: true, commission: "10%", status: "active" },
    { id: 2, name: "Болор", salon: "Төв салбар", vip: false, commission: "8%", status: "active" },
    { id: 3, name: "Номин", salon: "Вип салбар", vip: true, commission: "12%", status: "active" },
    { id: 4, name: "Солонго", salon: "Хан-Уул салбар", vip: false, commission: "9%", status: "active" }
  ],
  bookings: [
    { id: 1, salon: "Хан-Уул салбар", date: "2026-07-11", time: "10:00", phone: "99137481", source: "admin", status: "confirmed" },
    { id: 2, salon: "Төв салбар", date: "2026-07-11", time: "10:30", phone: "88776655", source: "site", status: "pending" },
    { id: 3, salon: "Вип салбар", date: "2026-07-11", time: "11:00", phone: "99001122", source: "admin", status: "confirmed" },
    { id: 4, salon: "Төв салбар", date: "2026-07-12", time: "12:00", phone: "80808080", source: "site", status: "pending" }
  ],
  holidays: [
    { id: 1, salon: "Хан-Уул салбар", date: "2026-07-13", name: "Дотоод сургалт", note: "Бүтэн өдөр хаалттай" },
    { id: 2, salon: "Вип салбар", date: "2026-07-15", name: "Засвар үйлчилгээ", note: "Оношилгооны өрөө засвартай" }
  ],
  assignments: [
    { staff: "Хулан", from: "Хан-Уул салбар", to: "Төв салбар", date: "2026-07-11", time: "12:00-18:00" },
    { staff: "Номин", from: "Вип салбар", to: "Төв салбар", date: "2026-07-12", time: "10:00-14:00" }
  ],
  kassSchedules: [
    { id: 1, date: "2026-07-12", salon: "Хан-Уул салбар", staff: "Ариундулам", createdAt: "2026-07-12" },
    { id: 2, date: "2026-07-11", salon: "Төв салбар", staff: "Оюундарь", createdAt: "2026-07-11" },
    { id: 3, date: "2026-07-10", salon: "Хан-Уул салбар", staff: "Урантогос", createdAt: "2026-07-10" },
    { id: 4, date: "2026-07-09", salon: "Вип салбар", staff: "Энхзул", createdAt: "2026-07-09" }
  ],
  services: [
    { customer: "Бат Хулан", service: "Үүргийн хурс эмчилгээ", staff: "Хулан", total: 96250, salon: "Хан-Уул салбар" },
    { customer: "Энх Номин", service: "Арьс оношилгоо", staff: "Номин", total: 80000, salon: "Вип салбар" }
  ],
  audit: [
    { title: "staff_assigned", meta: "Менежер • Хулан ажилтныг Төв салбар руу 12:00-18:00 томилсон" },
    { title: "payment_created", meta: "Reception • Бат Хулан • 96,250₮" },
    { title: "customer_updated", meta: "Менежер • Утасны мэдээлэл зассан" },
    { title: "excel_exported", meta: "Super Admin • Staff performance report татсан" }
  ],
  voucherRoles: [
    { id: 1, name: "Г.Иш", position: "Маркетинг менежер" },
    { id: 2, name: "Д.Уранчимэг", position: "Дэд захирал" },
    { id: 3, name: "Э.Уранчимэг", position: "Үүсгэн байгуулагч" }
  ],
  voucherLogs: [
    { id: 1, date: "2026-07-09", time: "19:07", customer: "Эрхэмбаяр", phone: "88109040", roleName: "Д.Уранчимэг", rolePosition: "Дэд захирал", amount: 100000, note: "Дизайн менежер" },
    { id: 2, date: "2026-07-08", time: "19:18", customer: "Уранчимэг", phone: "83076666", roleName: "Э.Уранчимэг", rolePosition: "Үүсгэн байгуулагч", amount: 26730, note: "Ажилчдын хөнгөлөлт 10%" },
    { id: 3, date: "2026-07-07", time: "16:42", customer: "Номин", phone: "99112233", roleName: "Г.Иш", rolePosition: "Маркетинг менежер", amount: 50000, note: "Урамшууллын эрх" }
  ],
  giftCards: [
    { id: 1, cardNumber: "GC-0001234", status: "new", amount: 150000, remainingAmount: 150000, createdAt: "2026-07-09", expiryDate: "2026-12-31", usage: [] },
    { id: 2, cardNumber: "GC-0001235", status: "new", amount: 100000, remainingAmount: 40000, createdAt: "2026-07-08", expiryDate: "2026-12-31", usage: [{ date: "2026-07-10", time: "15:20", customer: "Бат Хулан", phone: "99137481", service: "Үүргийн эмчилгээ", amount: 60000 }] },
    { id: 3, cardNumber: "GC-0001236", status: "used", amount: 50000, remainingAmount: 0, createdAt: "2026-07-07", expiryDate: "", usage: [{ date: "2026-07-11", time: "12:10", customer: "Энх Номин", phone: "88112233", service: "Тэжээлийн эмчилгээ", amount: 50000 }] },
    { id: 4, cardNumber: "GC-0001237", status: "inactive", amount: 75000, remainingAmount: 75000, createdAt: "2026-07-06", expiryDate: "2026-11-30", usage: [] }
  ],
  selectedCustomerId: 1,
  scheduleSettings: {
    workStart: "09:00",
    workEnd: "19:00",
    weekendStart: "10:00",
    weekendEnd: "19:00",
    duration: 30
  },
  generalSettings: {
    diagnosisPhotoLimit: 5,
    deleteCode: "1989",
    kassEditDays: 3,
    serviceEditDays: 3,
    customerEditDays: 3
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
    "Ажилтан": { bonusPercent: 0, dynamic: false }
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
state.bookings = state.bookings.filter(booking => booking.status !== "cancelled");
state.holidays = Array.isArray(state.holidays) ? state.holidays : [];
state.kassSchedules = Array.isArray(state.kassSchedules) ? state.kassSchedules : [...defaultState.kassSchedules];
state.customerTypes = Array.isArray(state.customerTypes) && state.customerTypes.length ? state.customerTypes : [...defaultState.customerTypes];
state.customerTypes = state.customerTypes.map(type => type === "Шинэ хэрэглэгч" ? "Хэрэглэгч" : type);
if (!state.customerTypes.includes("Хэрэглэгч")) state.customerTypes.unshift("Хэрэглэгч");
state.customers = state.customers.map(customer => ({
  ...customer,
  type: customer.type === "Шинэ хэрэглэгч" ? "Хэрэглэгч" : customer.type
}));
state.customerGroups = Array.isArray(state.customerGroups) && state.customerGroups.length
  ? state.customerGroups
  : structuredClone(defaultState.customerGroups);
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
    bonusPercent: type === "Тусгай хэрэглэгч" ? 10 : type === "Ажилтан" ? 0 : 2,
    dynamic: type !== "Ажилтан",
    ...(state.customerTypeRules[type] || {})
  };
});
state.pricePolicy = {
  ...structuredClone(defaultState.pricePolicy),
  ...(state.pricePolicy || {})
};
state.discounts = Array.isArray(state.discounts) ? state.discounts : [];
state.voucherRoles = Array.isArray(state.voucherRoles) ? state.voucherRoles : [];
state.voucherLogs = Array.isArray(state.voucherLogs) ? state.voucherLogs : [...defaultState.voucherLogs];
state.giftCards = Array.isArray(state.giftCards) ? state.giftCards : [...defaultState.giftCards];
if (!state.voucherRolesRestoredV1) {
  defaultState.voucherRoles.forEach(role => {
    const exists = state.voucherRoles.some(item => item.name === role.name || Number(item.id) === Number(role.id));
    if (!exists) state.voucherRoles.push({ ...role });
  });
  state.voucherRolesRestoredV1 = true;
}
state.generalSettings = {
  ...structuredClone(defaultState.generalSettings),
  ...(state.generalSettings || {})
};
state.diagnosisTypes = Array.isArray(state.diagnosisTypes) && state.diagnosisTypes.length ? state.diagnosisTypes : [...defaultState.diagnosisTypes];
normalizeStoredNames();
ensureExpiredServiceDemoData();
const humanResourceSeed = [
  { id: 1, name: "Ариундулам", phone: "88093590", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 2, name: "Бадамханд", phone: "99286879", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 3, name: "Батцэцэг", phone: "89247238", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 4, name: "Молор-Эрдэнэ", phone: "88688826", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 5, name: "Мөнхзул", phone: "80858669", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 6, name: "Номинзул", phone: "90401039", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 7, name: "Оюундарь", phone: "80909436", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 8, name: "Урантогос", phone: "89891365", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 9, name: "Уранцэцэг", phone: "89208122", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 10, name: "Энхбилэг", phone: "99185759", position: "Массажист", bonusCommission: 10, kassCommission: 2, status: "active" },
  { id: 11, name: "Энхзул", phone: "80057040", position: "Касс", bonusCommission: 0, kassCommission: 2, status: "active" }
];
ensureHumanResourcesData();
let activeView = "bookings";
let bookingTimeOptions = [];
let branchEditingId = null;
let humanResourceEditingId = null;
let voucherRoleEditingId = null;
const retiredViews = new Set(["services", "payments", "performance", "reports", "catalog"]);
const activeAccount = { role: "admin", salon: "Хан-Уул салбар" };
let activeServiceMainTab = "single";
let activeProductGroup = "gift";
let serviceEditingRef = null;
let customerPage = 1;
let holidayEditingId = null;
let customerTypeEditingName = null;
let kassEditingId = null;
let kassPage = 1;
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
  (next.customers || []).forEach(customer => {
    clearCustomerUiState(customer);
  });
  (next.customerGroups || []).forEach(group => {
    delete group.editingName;
  });
  return next;
}

function clearCustomerUiState(customer) {
  if (!customer) return;
  delete customer.profileServiceOpen;
  delete customer.profileServiceKind;
  delete customer.profileServiceEditingIndex;
  delete customer.profileServiceEditMode;
  delete customer.profileInfoEditing;
  delete customer.profileJoinGroupOpen;
  (customer.serviceHistory || []).forEach(item => {
    delete item.expandedVisit;
    delete item.diagnosisOpen;
    delete item.paymentFormOpen;
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clearTransientState(state)));
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
  const selectedSalon = state.salons.some(salon => salon.name === selectedName) ? selectedName : state.salons[0]?.name || "";
  scheduleSalon.innerHTML = state.salons.map(salon => `<option value="${salon.name}">${salon.name}</option>`).join("");
  scheduleSalon.value = selectedSalon;
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

function saveScheduleSettings() {
  const scheduleSalon = document.getElementById("scheduleSalon");
  if (!scheduleSalon) return;
  const salon = state.salons.find(item => item.name === scheduleSalon.value);
  if (!salon) return;
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
  dashboard: ["Хяналт", "Бүх салбарын өдөр тутмын ажиллагааны товч хяналт"],
  customers: ["Хэрэглэгчид", "Нэгдсэн хэрэглэгчийн сан, курсийн явц, төлбөрийн тэмдэглэгээ"],
  kass: ["Касс хуваарь", "Өдрийн касс, ээлж, хаалтын хяналт"],
  services: ["Үйлчилгээ", "Үйлчилгээний бүртгэл, нэмэгдэл үнэ, төлбөрийн урсгал"],
  payments: ["Касс орлого", "Төлбөр, bonus, voucher орлогын бүртгэл"],
  performance: ["Гүйцэтгэл", "Ажилтны борлуулалт ба урамшууллын хяналт"],
  reports: ["Тайлан", "Салбар, хэрэглэгч, ажилтны Excel тайлан"],
  bookings: ["Цаг захиалга", "Хэрэглэгчийн хүсэлт болон ресепшний хяналт"],
  staff: ["Ажилтан", "Үндсэн салбар, Вип ажилтан, томилгоо"],
  catalog: ["Бараа, үйлчилгээ", "Админаас удирдах үйлчилгээ, бүтээгдэхүүний сан"],
  loyalty: ["Бонус / Ваучер", "Бонус хувь, ваучер, ажилтны хөнгөлөлт"],
  settings: ["Тохиргоо", "Зургийн тоо, нэмэгдэл үнэ, цаг захиалгын ерөнхий тохиргоо"],
  settingsServices: ["Үйлчилгээ", "Нэг удаа, курс, кассын үйлчилгээний master тохиргоо"],
  audit: ["Үйлдлийн түүх", "Sensitive action бүрийн мөр"],
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
  const hasHumanResourceRows = state.staff.some(item => item.phone && item.bonusCommission !== undefined);
  if (!hasHumanResourceRows && state.staff.length <= 4) {
    state.staff = humanResourceSeed.map(item => ({ ...item, salon: "Хан-Уул салбар", position: normalizePositionName(item.position), vip: item.position === "Мастер массажист", commission: `${item.bonusCommission}%` }));
    saveState();
    return;
  }
  state.staff = state.staff.map((item, index) => ({
    ...item,
    phone: item.phone || humanResourceSeed[index]?.phone || "",
    position: normalizePositionName(item.position || (item.vip ? "Мастер массажист" : "Массажист")),
    bonusCommission: Number(item.bonusCommission ?? parseFloat(item.commission) ?? 10),
    kassCommission: Number(item.kassCommission ?? 2),
    status: item.status || "active"
  }));
  humanResourceSeed.forEach(seed => {
    if (!state.staff.some(item => item.name === seed.name || item.phone === seed.phone)) {
      state.staff.push({ ...seed, salon: "Хан-Уул салбар", position: normalizePositionName(seed.position), vip: seed.position === "Мастер массажист", commission: `${seed.bonusCommission}%` });
    }
  });
  saveState();
}

function ensureHumanResourceShell() {
  const submenu = document.getElementById("settingsSubmenu");
  if (submenu && !submenu.querySelector('[data-view="settingsHumanResources"]')) {
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
        <label>Массажист %
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
              <th>Урамшуулал</th>
              <th>Касс %</th>
              <th>Статус</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody id="hrStaffRows"></tbody>
        </table>
      </div>
    </section>
  `;
  const anchor = document.getElementById("settingsBonusView") || document.getElementById("staffView");
  anchor?.parentNode?.insertBefore(section, anchor.nextSibling);
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
  defaultState.customers.forEach(customer => {
    if (!state.customers.some(item => Number(item.id) === Number(customer.id))) {
      state.customers.push(structuredClone(customer));
    }
  });
  const defaultGroups = structuredClone(defaultState.customerGroups);
  defaultGroups.forEach(group => {
    if (!state.customerGroups.some(item => Number(item.id) === Number(group.id))) {
      state.customerGroups.push(group);
    }
  });
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
      registeredAt: customer.registeredAt || customer.last || todayText()
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

function applyGroupPayment(group, paidAmount, bonusAmount, paidDate) {
  if (!group) return null;
  const spentAmount = Math.max(0, Number(paidAmount || 0));
  const usedAmount = Math.max(0, Number(bonusAmount || 0));
  const nextSpent = Math.max(0, Number(group.spent2y || 0) + spentAmount);
  const bonusPercent = bonusPercentForSpent(nextSpent);
  const bonusEarned = Math.round(spentAmount * bonusPercent / 100);

  group.spent2y = nextSpent;
  group.bonusPool = Math.max(0, Number(group.bonusPool || 0) + bonusEarned);
  group.usedBonus = Math.max(0, Number(group.usedBonus || 0) + usedAmount);

  return {
    groupId: group.id,
    groupSpentAmount: spentAmount,
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
  select.innerHTML = state.salons.map(salon => `<option value="${salon.name}">${salon.name}</option>`).join("");
  select.value = state.salons.some(salon => salon.name === selected) ? selected : state.salons[0]?.name || "";
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
      bonusPercent: type === "Тусгай хэрэглэгч" ? 10 : type === "Ажилтан" ? 0 : 2,
      dynamic: type !== "Ажилтан"
    };
  }
  return state.customerTypeRules[type];
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
  return state.generalSettings;
}

function renderGeneralSettings() {
  const settings = generalSettings();
  const photoLimit = document.getElementById("diagnosisPhotoLimit");
  const deleteCode = document.getElementById("deleteActionCode");
  const kassDays = document.getElementById("kassEditDays");
  if (photoLimit) photoLimit.value = settings.diagnosisPhotoLimit;
  if (deleteCode) deleteCode.value = settings.deleteCode;
  if (kassDays) kassDays.value = settings.kassEditDays;
  renderDiagnosisTypes();
}

function saveGeneralSettings(event) {
  event.preventDefault();
  state.generalSettings = {
    ...generalSettings(),
    diagnosisPhotoLimit: Number(formValue("diagnosisPhotoLimit")) || 1,
    deleteCode: formValue("deleteActionCode") || "1989",
    kassEditDays: Number(formValue("kassEditDays")) || generalSettings().kassEditDays
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
  const salons = isSalonAccount() ? state.salons.filter(salon => salon.name === activeAccount.salon) : state.salons;
  const salon = document.getElementById("kassSalon");
  const staff = document.getElementById("kassStaff");
  const filter = document.getElementById("kassSalonFilter");
  const currentSalonValue = isSalonAccount() ? activeAccount.salon : (salon?.value || salons[0]?.name || "");
  const staffList = isSalonAccount()
    ? state.staff.filter(staffItem => staffItem.salon === activeAccount.salon)
    : state.staff.filter(staffItem => !currentSalonValue || staffItem.salon === currentSalonValue);
  const formSalonOptions = salons.map(salonItem => `<option value="${salonItem.name}">${salonItem.name}</option>`).join("");
  const filterSalonOptions = `${isSalonAccount() ? "" : `<option value="">Бүх салбар</option>`}${formSalonOptions}`;
  const staffOptions = staffList.map(staff => `<option value="${staff.name}">${staff.name}</option>`).join("");
  const salonValue = currentSalonValue;
  const staffValue = staff?.value || staffList[0]?.name || "";
  const filterValue = isSalonAccount() ? activeAccount.salon : (filter?.value || "");
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
  enhanceNativeSelects(["kassSalon", "kassStaff", "kassSalonFilter"]);
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
  const allowedStaff = isSalonAccount() ? state.staff.filter(item => item.salon === activeAccount.salon) : state.staff;
  if (!allowedStaff.some(item => item.name === staff)) {
    showToast("Энэ ажилтан тухайн салбарт харагдахгүй");
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
  return "Хүлээгдэж буй";
}

function bookingStatusTone(status) {
  if (status === "confirmed") return "green";
  return "pink";
}

function bookingStatusLabel(status) {
  return `<span class="status-text ${bookingStatusTone(status)}">${bookingStatusText(status)}</span>`;
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
    performance: ["АЖИЛТНЫ ГҮЙЦЭТГЭЛ", [
      ["Ажилтан", staff.length],
      ["Вип ажилтан", staff.filter(item => item.vip).length],
      ["Томилгоо", state.assignments.length],
      ["Нийт хувь", "171,200₮"]
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
      ["Зургийн тоо", generalSettings().diagnosisPhotoLimit],
      ["Касс хоног", generalSettings().kassEditDays],
      ["Оношилгоо", state.diagnosisTypes.length]
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
      ["Дундаж хувь", `${Math.round(staff.reduce((sum, item) => sum + Number(item.bonusCommission ?? parseFloat(item.commission) ?? 0), 0) / Math.max(staff.length, 1))}%`]
    ]],
    audit: ["ҮЙЛДЛИЙН ТҮҮХ", [
      ["Нийт", state.audit.length],
      ["Өнөөдөр", state.audit.length],
      ["Чухал үйлдэл", 4],
      ["Excel таталт", 1]
    ]],
    dashboard: ["ХЯНАЛТ", [
      ["Салбар", state.salons.length],
      ["Өнөөдрийн захиалга", bookings.filter(item => item.date === today).length],
      ["Идэвхтэй курс", customers.filter(item => item.activeCourse).length],
      ["QR хүлээгдэж буй", 9]
    ]],
    profile: (() => {
      const customer = state.customers.find(item => Number(item.id) === Number(state.selectedCustomerId)) || customers[0];
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
  document.getElementById("infoExcelBtn")?.classList.toggle("hidden", !["vouchers", "giftCards"].includes(name));
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
  renderAudit();
}

function setView(name) {
  if (retiredViews.has(name)) name = "bookings";
  const previousView = activeView;
  if (previousView === "profile" && name !== "profile") {
    state.customers.forEach(customer => clearCustomerUiState(customer));
    state.customerGroups.forEach(group => {
      group.editingName = false;
    });
  }
  activeView = name;
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === name));
  document.querySelectorAll(".nav-subitem").forEach(item => item.classList.toggle("active", item.dataset.view === name));
  const isSettingsView = name.startsWith("settings") || name === "branches";
  document.getElementById("settingsToggle")?.classList.toggle("active", isSettingsView);
  document.getElementById("settingsSubmenu")?.classList.toggle("open", isSettingsView);
  document.getElementById("settingsToggle")?.setAttribute("aria-expanded", String(isSettingsView));

  const view = document.getElementById(`${name}View`);
  if (view) view.classList.add("active");

  if (name === "settingsServices") renderSettingsServices();
  if (name === "settingsHumanResources") renderHumanResources();
  if (name === "settingsPricing") renderPricePolicySettings();
  if (name === "settingsDiscounts") renderDiscountSettings();
  if (name === "settingsGeneral") renderGeneralSettings();
  if (name === "kass") renderKassSchedule();
  if (name === "vouchers") renderVouchers();
  if (name === "giftCards") renderGiftCards();
  if (name === "profile") renderProfile();
  renderInfoHeader(name);
  document.getElementById("sidebar").classList.remove("open");
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
    bookingSalonMenu.innerHTML = `
      <button type="button" data-value="all" class="active">Бүх салбар</button>
      ${state.salons.map(s => `<button type="button" data-value="${s.name}">${s.name}</button>`).join("")}
    `;
  }
}

function salonAddress(salon) {
  return salon.address || "Хаяг оруулаагүй";
}

function salonPhone(salon) {
  return salon.phone || "--------";
}

function renderBranches() {
  ensureBranchStatusField();
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
  branchEditingId = branch ? branch.id : null;
  ensureBranchStatusField();
  document.getElementById("branchSubmit").textContent = branch ? "Хадгалах" : "Хадгалах";
  document.getElementById("branchName").value = branch?.name || "";
  document.getElementById("branchPhone").value = branch?.phone || "";
  document.getElementById("branchAddress").value = branch?.address || "";
  document.querySelector(".branch-status-field")?.classList.toggle("hidden", !branch);
  const status = document.getElementById("branchStatus");
  if (status) status.value = branch?.active === false ? "inactive" : "active";
  document.getElementById("branchForm")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeBranchForm() {
  branchEditingId = null;
  document.getElementById("branchForm")?.reset();
  document.querySelector(".branch-status-field")?.classList.add("hidden");
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
  const holidays = [...state.holidays].sort((a, b) => `${a.date}${a.salon}`.localeCompare(`${b.date}${b.salon}`));
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
  if (!holiday) return;
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
  const group = customerGroup(customer);
  if (group) return `${groupBonusInfo(group).percent}%`;
  return customer.bonus || `${customerTypeRule(customer.type || "Хэрэглэгч").bonusPercent}%`;
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
  if (item.deleted || item.kind === "course" || title.includes("курс")) return false;
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
  document.querySelectorAll(".customer-sort-actions .sort-text-btn").forEach(button => {
    const active = button.dataset.sort === sortMode;
    button.classList.toggle("active", active);
    const icon = button.querySelector("span");
    if (icon) icon.textContent = active ? "↓" : "↕";
  });
  const activeTreatments = state.customers
    .filter(customer => !customer.deleted)
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
    const courseA = customerCourseEntryStatus(a);
    const courseB = customerCourseEntryStatus(b);
    const activeCourseA = courseA && !courseA.complete ? 1 : 0;
    const activeCourseB = courseB && !courseB.complete ? 1 : 0;
    if (activeCourseA !== activeCourseB) return activeCourseB - activeCourseA;
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
        <td>${customerBalance(customer) ? money(customerBalance(customer)) : "—"}</td>
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
  document.getElementById("profileCreateGroupBtn")?.addEventListener("click", () => createCustomerGroup(customer.id));
  document.getElementById("profileJoinGroupBtn")?.addEventListener("click", () => {
    customer.profileJoinGroupOpen = !customer.profileJoinGroupOpen;
    renderProfile();
  });
  bindInlineJoinGroup(customer);
  panel.querySelectorAll(".course-slot-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.filled === "true") {
        showToast("Бүртгэлтэй оролтыг засах товчоор засна");
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

function renderCustomerServiceHistory(customer) {
  const history = Array.isArray(customer.serviceHistory) ? customer.serviceHistory : [];
  if (!history.length) return `<div class="empty-state">Үйлчилгээний түүх алга</div>`;
  return history.map((item, index) => {
    const isCourse = item.kind === "course";
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
        ${isCourse ? renderCourseSlots(item, index) : ""}
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
        const bonusText = payment.bonusAmount ? ` + бонус ${money(payment.bonusAmount)}` : "";
        const reference = payment.referenceLabel ? ` · ${payment.referenceLabel}` : "";
        return `<span class="payment-history-chip">${money(payment.paidAmount || payment.amount || 0)} ${label}${reference}${bonusText}${time ? ` · ${time}` : ""}</span>`;
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
  return `<span>Үлдэгдэл: <strong>${money(card.remainingAmount)}</strong></span>`;
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
      <div class="inline-payment-extra-note">${method === "gift_card" ? giftCardPaymentMessage(giftCardNumber) : ""}</div>
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

function collapseCustomerServicePanels(customer) {
  if (!customer) return;
  customer.profileServiceOpen = false;
  delete customer.profileServiceEditingIndex;
  delete customer.profileServiceEditMode;
  (customer.serviceHistory || []).forEach(item => {
    item.expandedVisit = null;
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
}function renderProfileServiceInlineForm(customer) {
  const showSalon = ["admin", "manager"].includes(activeAccount.role);
  const editingIndex = Number.isInteger(customer.profileServiceEditingIndex) ? customer.profileServiceEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const kind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
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
        <button class="service-modal-tab disabled" type="button" disabled>Касс</button>
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
            <select class="input" id="profileServiceStaff" required>${showSalon ? staffOptionHtmlForSalon(selectedSalon, selectedStaff) : staffOptionHtmlForSalon(activeAccount.salon, selectedStaff)}</select>
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
  const salon = item.salon || activeAccount.salon;
  const prefix = `courseVisit${historyIndex}_${visitNumber}`;
  const room = existing?.room || "standard";
  return `
    <form class="course-visit-inline-form" data-history-index="${historyIndex}" data-visit="${visitNumber}" data-prefix="${prefix}" data-mode="${existing ? "edit" : "create"}">
      <div class="customer-service-grid course-visit-row">
        <label>Огноо<input class="input course-visit-date" type="date" value="${existing?.date || todayText()}" required></label>
        <label>Ажилтан<select class="input course-visit-staff" id="${prefix}Staff" required>${staffOptionHtmlForSalon(salon, previousStaff)}</select></label>
        <label>Өрөө<select class="input course-visit-room" id="${prefix}Room"><option value="standard" ${room === "standard" ? "selected" : ""}>Энгийн</option><option value="vip" ${room === "vip" ? "selected" : ""}>Вип</option></select></label>
        <button class="primary-btn" type="submit">${existing ? "Оролт шинэчлэх" : "Оролт бүртгэх"}</button>
      </div>
      <button class="secondary-btn diagnosis-expand-btn" id="${prefix}DiagnosisToggle" type="button"><span>Оношилгоо</span><i></i></button>
      ${diagnosisFormHtml(prefix)}
    </form>
  `;
}

function renderCourseSlots(item, historyIndex) {
  const total = Number(item.visitsTotal || parseInt(item.visits, 10) || 4);
  const visits = Array.isArray(item.visits) ? item.visits : [];
  const expandedVisit = Number(item.expandedVisit || 0);
  const columns = 4;
  const rows = [];
  for (let start = 1; start <= total; start += columns) {
    const numbers = Array.from({ length: Math.min(columns, total - start + 1) }, (_, i) => start + i);
    const expandedInRow = numbers.includes(expandedVisit) ? expandedVisit : 0;
    rows.push(`
      <div class="course-slot-row">
        <div class="course-slot-grid">
          ${numbers.map(number => {
            const visit = visits.find(v => Number(v.number) === number);
            const expanded = expandedVisit === number;
            const locked = visit && !isServiceEditable(visit);
            return `
              <div class="course-slot-card ${visit ? "done" : ""} ${expanded ? "active" : ""} ${locked ? "locked" : ""}">
                <button class="course-slot-btn" type="button" data-history-index="${historyIndex}" data-visit="${number}" data-filled="${visit ? "true" : "false"}" ${visit ? "aria-disabled=\"true\"" : ""}>
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
    enhanceNativeSelects(Array.from(form.querySelectorAll(".course-visit-staff, .course-visit-room")).map(select => select.id).filter(Boolean));
    bindDiagnosisControls(prefix);
    const historyIndex = Number(form.dataset.historyIndex);
    const visitNumber = Number(form.dataset.visit);
    const course = customer.serviceHistory?.[historyIndex];
    const existingVisit = (course?.visits || []).find(item => Number(item.number) === Number(visitNumber));
    hydrateDiagnosisForm(prefix, existingVisit?.diagnosis);
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
      const policy = pricePolicy();
      const vipRoomFee = room === "vip" ? Number(policy.vipRoomFee || 0) : 0;
      const staff = form.querySelector(".course-visit-staff")?.value || "";
      const masterStaffFee = isMasterStaffName(staff) ? Number(policy.masterStaffFee || 0) : 0;
      const oldExtra = Number(existingVisit?.vipRoomFee || 0) + Number(existingVisit?.masterStaffFee || 0);
      const newExtra = vipRoomFee + masterStaffFee;
      const visit = {
        number: visitNumber,
        date: form.querySelector(".course-visit-date")?.value || todayText(),
        staff,
        room,
        vipRoom: room === "vip",
        vipRoomFee,
        masterStaffFee,
        extraTotal: newExtra,
        createdAt: existingVisit?.createdAt || todayText(),
        diagnosis: readDiagnosisPayload(prefix)
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
      customer.currentTreatment = currentTreatmentFromHistory(customer, { ...course, staff: visit.staff, date: visit.date, diagnosis: visit.diagnosis }, `Курс ${visitNumber}/${course.visitsTotal}`);
      customer.last = visit.date;
      saveAndRefreshCustomerProfile("Курсийн оролт бүртгэгдлээ");
    });
  });
}function renderDiagnosisSummary(diagnosis) {
  const types = diagnosis.types || [];
  const note = String(diagnosis.note || "").trim();
  const noteParts = note.split(",").map(item => item.trim()).filter(Boolean);
  const noteOnlyRepeatsTypes = noteParts.length > 0 && noteParts.every(item => types.includes(item));
  const chips = types.length
    ? types.map(type => `<span class="payment-history-chip">${type}</span>`).join("")
    : (note ? `<span class="payment-history-chip">${note}</span>` : `<span class="payment-history-chip">Онош сонгоогүй</span>`);
  return `
    <div class="diagnosis-summary-box">
      <div class="diagnosis-summary-title">Онош</div>
      <div class="payment-history-chips diagnosis-history-chips">
        ${chips}
        ${note && types.length && !noteOnlyRepeatsTypes ? `<span class="payment-history-chip">${note}</span>` : ""}
      </div>
      <div class="photo-summary-grid">
        <div><strong>Үсний байрлал</strong><span>${(diagnosis.generalPhotos || []).filter(Boolean).length}/5 зураг</span></div>
        <div><strong>Хуйх, уг</strong><span>${(diagnosis.scopePhotos || []).filter(Boolean).length}/5 зураг</span></div>
      </div>
    </div>
  `;
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
            <div><span>Хэрэглээ дахин тооцох хугацаа</span><strong>${period.used}/730 өдөр</strong></div>
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
  document.getElementById("profileAddServiceTop")?.addEventListener("click", () => {
    const wasOpen = Boolean(customer.profileServiceOpen && !Number.isInteger(customer.profileServiceEditingIndex));
    collapseCustomerServicePanels(customer);
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
  document.getElementById("historyList")?.querySelectorAll(".course-slot-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.filled === "true") {
        showToast("Бүртгэлтэй оролтыг засах товчоор засна");
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
        const message = item.kind === "course" && Array.isArray(item.visits) && item.visits.length
          ? "Эхний оролт бүртгэгдсэн курсийн үндсэн үйлчилгээг засах боломжгүй"
          : serviceHasPayment(item)
            ? "Төлбөр орсон үйлчилгээний зөвхөн оношилгоог засах боломжтой"
            : "Үйлчилгээ засах хугацаа дууссан байна";
        showToast(message);
        return;
      }
      collapseCustomerServicePanels(customer);
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
    customer.name = formValue("profileInfoName");
    customer.phone = formValue("profileInfoPhone");
    setCustomerAgeFromInput(customer, formValue("profileInfoAge"));
    customer.gender = formValue("profileInfoGender");
    customer.district = formValue("profileInfoDistrict");
    customer.khoroo = formValue("profileInfoKhoroo");
    customer.type = formValue("profileInfoType") || "Хэрэглэгч";
    customer.bonus = `${customerTypeRule(customer.type).bonusPercent}%`;
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
  customer.deleted = true;
  customer.profileInfoEditing = false;
  state.selectedCustomerId = state.customers.find(item => !item.deleted)?.id || null;
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

function bindProfileServiceInlineForm(customer) {
  const form = document.getElementById("profileServiceForm");
  if (!form) return;
  const showSalon = ["admin", "manager"].includes(activeAccount.role);
  const editingIndex = Number.isInteger(customer.profileServiceEditingIndex) ? customer.profileServiceEditingIndex : null;
  const editingItem = editingIndex !== null ? customer.serviceHistory?.[editingIndex] : null;
  const formKind = editingItem ? (editingItem.kind === "course" ? "course" : "single") : (customer.profileServiceKind || "single");
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
    staffSelect.innerHTML = staffOptionHtmlForSalon(event.target.value);
    enhanceNativeSelects(["profileServiceStaff"]);
    staffSelect.addEventListener("change", () => updateProfileServicePrice(customer));
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
    const salon = formValue("profileServiceSalon") || customer.salon || activeAccount.salon;
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
        amountInput.readOnly = bonusApplied;
        amountInput.value = bonusApplied ? moneyInputValue(Math.max(0, balance - bonusAmount)) : moneyInputValue(balance);
      }
    };
    amountInput?.addEventListener("input", () => {
      const raw = amountInput.value;
      if (raw === "") {
        updateBonusLimit();
        return;
      }
      amountInput.value = moneyInputValue(Math.max(1, Math.min(parseMoneyInput(raw), balance)));
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
      if (giftCardNote) giftCardNote.innerHTML = value === "gift_card" ? giftCardPaymentMessage(giftCardInput?.value) : "";
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
        card.remainingAmount = Math.max(0, Number(card.remainingAmount || 0) - amount);
        card.status = card.remainingAmount <= 0 ? "used" : "new";
        card.usage = Array.isArray(card.usage) ? card.usage : [];
        card.usage.unshift({
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
      const groupPayment = applyGroupPayment(group, amount, bonusAmount, paidDate);
      historyItem.payments.unshift({
        amount: appliedAmount,
        bonusAmount,
        paidAmount: amount,
        date: paidDate,
        createdAt: dateTimeText(paidDate),
        method: methodSelect?.value || "",
        methodLabel,
        referenceLabel,
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
  (historyItem.payments || []).forEach(payment => reverseGroupPayment(payment, group));
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

function staffOptionHtmlForSalon(salon = "", selected = "") {
  if (!salon) return `<option value="">Эхлээд салбар сонгоно уу</option>`;
  const staff = state.staff.filter(item => item.status !== "inactive" && item.salon === salon);
  return staff.length
    ? staff.map(item => `<option value="${item.name}" ${item.name === selected ? "selected" : ""}>${item.name}</option>`).join("")
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
                <div class="camera-preview-mini">Камер нээгдээгүй</div>
                <button class="secondary-btn photo-capture" type="button" data-target="general" data-index="${index}">Зураг авах</button>
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
                <div class="camera-preview-mini">Камер нээгдээгүй</div>
                <button class="secondary-btn photo-capture" type="button" data-target="scope" data-index="${index}">Зураг авах</button>
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
  if (!panel || (panel.classList.contains("hidden") && panel.dataset.open !== "true")) return null;
  const types = Array.from(panel.querySelectorAll(".diagnosis-pick.active")).map(button => button.dataset.type);
  const generalPhotos = Array.from(panel.querySelectorAll('.photo-capture[data-target="general"]')).map(button => button.classList.contains("active"));
  const scopePhotos = Array.from(panel.querySelectorAll('.photo-capture[data-target="scope"]')).map(button => button.classList.contains("active"));
  const note = document.getElementById(`${prefix}DiagnosisNote`)?.value.trim() || "";
  if (!types.length && !note && !generalPhotos.some(Boolean) && !scopePhotos.some(Boolean)) return null;
  return { types, note, generalPhotos, scopePhotos };
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
      button.textContent = active ? "Дахин авах" : "Зураг авах";
      const card = button.closest(".camera-shot-card");
      const preview = card?.querySelector(".camera-preview-mini");
      if (card) card.classList.toggle("captured", active);
      if (preview && active) preview.textContent = "Зураг хадгалагдсан";
    });
  });
}

async function startDiagnosisCamera(card) {
  const video = card?.querySelector(".camera-video");
  const label = card?.querySelector(".camera-preview-mini em");
  if (!card || !video) return false;
  if (video.srcObject) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    if (label) label.textContent = "Камер дэмжихгүй байна";
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    card.classList.add("camera-live");
    if (label) label.textContent = "";
    return true;
  } catch (error) {
    if (label) label.textContent = "Камер зөвшөөрөл хэрэгтэй";
    return false;
  }
}

function captureDiagnosisCamera(card, button) {
  const video = card?.querySelector(".camera-video");
  const canvas = card?.querySelector(".camera-canvas");
  const label = card?.querySelector(".camera-preview-mini em");
  if (!card || !video || !canvas || !video.srcObject) return false;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  card.classList.add("captured");
  button.classList.add("active");
  button.textContent = "Дахин авах";
  if (label) label.textContent = "";
  return true;
}
function bindDiagnosisControls(prefix = "service") {
  document.getElementById(`${prefix}DiagnosisToggle`)?.addEventListener("click", () => {
    const panel = document.getElementById(`${prefix}DiagnosisPanel`);
    panel?.classList.toggle("hidden");
    const open = !panel?.classList.contains("hidden");
    if (panel) panel.dataset.open = open ? "true" : "false";
    document.getElementById(`${prefix}DiagnosisToggle`)?.classList.toggle("active", open);
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
      const preview = card?.querySelector(".camera-preview-mini");
      button.classList.add("active");
      if (card) card.classList.add("captured");
      if (preview) preview.textContent = "Зураг хадгалагдсан";
      button.textContent = "Дахин авах";
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
            <select class="input" id="customerServiceStaff" required>${staffOptionHtml()}</select>
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
      bindDiagnosisControls("service");
      hydrateKind(selectedKind);
      form.addEventListener("submit", event => {
        event.preventDefault();
        const kind = form.dataset.kind;
        const item = serviceOptionsForKind(kind, customer)[Number(select.value || 0)];
        if (!item) return;
        const date = formValue("customerServiceDate") || todayText();
        const staff = formValue("customerServiceStaff");
        const salon = showSalon ? formValue("customerServiceSalon") : (customer.salon || activeAccount.salon);
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
  const candidates = state.customers.filter(item => !item.groupId && Number(item.id) !== Number(customer.id));
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
  rows.innerHTML = state.staff.map(staff => `
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
  renderInfoHeader(activeView);
}

function saveHumanResourceStaff(event) {
  event.preventDefault();
  const name = formValue("hrStaffName");
  if (!name) return;
  const phone = formValue("hrStaffPhone").replace(/\D/g, "").slice(0, 8);
  const payload = {
    name,
    phone,
    salon: formValue("hrStaffSalon") || state.salons[0]?.name || "",
    position: formValue("hrStaffPosition") || "Массажист",
    bonusCommission: Number(formValue("hrStaffBonus")) || 0,
    kassCommission: Number(formValue("hrStaffKass")) || 0,
    status: formValue("hrStaffStatus") || "active",
    commission: `${Number(formValue("hrStaffBonus")) || 0}%`,
    vip: formValue("hrStaffPosition") === "Мастер массажист"
  };
  if (humanResourceEditingId) {
    const staff = state.staff.find(item => item.id === humanResourceEditingId);
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
  if (!staff) return;
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
  if (!staff) return;
  staff.status = staff.status === "inactive" ? "active" : "inactive";
  state.audit.unshift({ title: "staff_status_updated", meta: `Менежер • ${staff.name} • ${humanResourceStatusText(staff.status)}` });
  saveState();
  renderHumanResources();
  renderKassSchedule();
  renderStaff();
  renderAudit();
}

function deleteHumanResourceStaff(id) {
  if (!requireDeleteCode()) return;
  const staff = state.staff.find(item => item.id === id);
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
  document.getElementById("staffRows").innerHTML = state.staff.map(staff => `
    <tr>
      <td><strong>${staff.name}</strong></td>
      <td>${staff.salon}</td>
      <td>${staff.vip ? badge("Вип", "green") : badge("Энгийн", "gray")}</td>
      <td>${staff.commission}</td>
      <td>${badge(staff.status === "active" ? "Идэвхтэй" : staff.status, "green")}</td>
    </tr>
  `).join("");

  const staffOptions = state.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  const serviceStaff = document.getElementById("serviceStaff");
  if (serviceStaff) serviceStaff.innerHTML = staffOptions;
  const assignStaff = document.getElementById("assignStaff");
  if (assignStaff) assignStaff.innerHTML = staffOptions;
}

function renderBookings() {
  const q = document.getElementById("bookingSearch")?.value || "";
  const status = document.getElementById("bookingStatusFilter")?.value || "all";
  const salon = document.getElementById("bookingSalonFilter")?.value || "all";
  const date = document.getElementById("bookingDateFilter")?.value || "";
  const pagination = document.getElementById("bookingPagination");
  const bookingNumbers = new Map(
    [...state.bookings]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((booking, index) => [Number(booking.id), index + 1])
  );
  const bookings = state.bookings
    .filter(b => !q || b.phone.includes(q))
    .filter(b => salon === "all" || b.salon === salon)
    .filter(b => !date || b.date === date)
    .filter(b => status === "all" || b.status === status);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(bookings.length / pageSize));
  bookingPage = Math.min(Math.max(bookingPage, 1), pageCount);
  const pageRows = bookings.slice((bookingPage - 1) * pageSize, bookingPage * pageSize);
  document.getElementById("bookingRows").innerHTML = pageRows.map(booking => `
    <tr>
      <td>${bookingNumbers.get(Number(booking.id)) || ""}</td>
      <td>${booking.salon}</td>
      <td>${dateWithWeekday(booking.date)}</td>
      <td>${booking.time}</td>
      <td>${booking.phone}</td>
      <td>${bookingSourceText(booking.source, booking.status)}</td>
      <td>${bookingStatusLabel(booking.status)}</td>
      <td>
        <div class="table-actions">
          ${booking.status === "pending" ? `<button class="secondary-btn booking-confirm" data-id="${booking.id}">Батлах</button>` : ""}
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

function renderVouchers() {
  const roleRows = document.getElementById("voucherRoleRows");
  const logRows = document.getElementById("voucherLogRows");
  const pagination = document.getElementById("voucherPagination");
  if (!roleRows || !logRows) return;
  const roleSubmit = document.getElementById("voucherRoleSubmit");
  if (roleSubmit) roleSubmit.textContent = voucherRoleEditingId ? "Шинэчлэх" : "Нэмэх";
  const roleFilterSelect = document.getElementById("voucherRoleFilter");
  const selectedRoleFilter = roleFilterSelect?.value || "";
  if (roleFilterSelect) {
    roleFilterSelect.innerHTML = `
      <option value="">Бүх роль</option>
      ${state.voucherRoles.map(role => {
        const label = `${role.name}${role.position ? ` · ${role.position}` : ""}`;
        return `<option value="${role.id}" ${String(role.id) === String(selectedRoleFilter) ? "selected" : ""}>${label}</option>`;
      }).join("")}
    `;
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
  const roleFilterData = state.voucherRoles.find(role => String(role.id) === String(roleFilter));
  const roleFilterName = roleFilterData?.name?.toLowerCase() || "";
  const roleFilterPosition = roleFilterData?.position?.toLowerCase() || "";
  const logs = state.voucherLogs
    .filter(item => !dateFilter || item.date === dateFilter)
    .filter(item => !customerFilter || item.customer.toLowerCase().includes(customerFilter))
    .filter(item => !phoneFilter || item.phone.includes(phoneFilter))
    .filter(item => !roleFilter || item.roleName.toLowerCase() === roleFilterName || item.rolePosition.toLowerCase() === roleFilterPosition)
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
            <button class="secondary-btn icon-action gift-card-edit" type="button" data-id="${card.id}" aria-label="Засах" ${editable ? "" : "disabled"}>${editIcon()}</button>
            <button class="secondary-btn gift-card-toggle" type="button" data-id="${card.id}" ${status === "used" ? "disabled" : ""}>${status === "inactive" ? "Идэвхжүүлэх" : "Идэвхгүй"}</button>
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

function renderAudit() {
  document.getElementById("auditList").innerHTML = state.audit.map(item => `
    <div class="history-item">
      <strong>${item.title}</strong>
      <span>${item.meta}</span>
    </div>
  `).join("");
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
  if (!booking) return;
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
  if (!requireDeleteCode()) return;
  const booking = state.bookings.find(item => Number(item.id) === Number(id));
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
    const options = dropdown.querySelectorAll(".custom-select-menu button");

    trigger.addEventListener("click", () => {
      document.querySelectorAll(".panel-head-actions .custom-select.open").forEach(item => {
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
        bookingPage = 1;
        renderBookings();
      });
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
  wrapper.className = "custom-select native-select-proxy";
  wrapper.innerHTML = `
    <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span>${selectedOption?.textContent || ""}</span>
    </button>
    <div class="custom-select-menu" role="listbox"></div>
  `;
  const menu = wrapper.querySelector(".custom-select-menu");
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
  wrapper.querySelector(".custom-select-trigger").addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach(item => {
      if (item !== wrapper) item.classList.remove("open");
    });
    const isOpen = wrapper.classList.toggle("open");
    wrapper.querySelector(".custom-select-trigger").setAttribute("aria-expanded", String(isOpen));
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
  const selectedSalon = values.salon || state.salons[0]?.name || "";
  const selectedDate = values.date || todayText();
  const selectedTime = values.time || bookingOptionsForSalon(selectedSalon)[0] || "";
  return `
    <div class="booking-slot-row${index > 0 ? " extra-slot-row" : ""}" data-slot-index="${index}">
      <label>Салон
        <input type="hidden" class="booking-salon" id="bookingSalon${index}" value="${selectedSalon}">
        <div class="custom-select" data-input="bookingSalon${index}">
          <button class="custom-select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span>${selectedSalon}</span>
          </button>
          <div class="custom-select-menu" role="listbox">
            ${state.salons.map(s => `<button type="button" data-value="${s.name}" class="${s.name === selectedSalon ? "active" : ""}">${s.name}</button>`).join("")}
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
  const minDate = todayText();
  const selectedDate = editing && !isPastDate(editing.date) ? editing.date : minDate;
  const selectedSalon = editing?.salon || state.salons[0]?.name || "";
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
          <button class="primary-btn" type="submit">${editing ? "Хадгалах" : "Баталгаажуулах"}</button>
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
    const submenu = document.getElementById("settingsSubmenu");
    const isOpen = submenu.classList.toggle("open");
    document.getElementById("settingsToggle").setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll("[data-view-target]").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.viewTarget));
  });

  document.getElementById("branchForm")?.addEventListener("submit", saveBranch);
  document.getElementById("branchPhone")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.getElementById("holidayForm")?.addEventListener("submit", saveHoliday);
  document.getElementById("hrStaffForm")?.addEventListener("submit", saveHumanResourceStaff);
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
      state.voucherRoles.unshift({ id: nextId(state.voucherRoles), name, position });
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
    showToast(activeView === "giftCards" ? "Бэлгийн картын Excel бэлтгэгдлээ" : "Ваучерийн Excel бэлтгэгдлээ");
  });
  document.getElementById("pricePolicyForm")?.addEventListener("submit", savePricePolicy);
  document.getElementById("customerTypeForm")?.addEventListener("submit", saveCustomerType);
  document.getElementById("discountForm")?.addEventListener("submit", saveDiscount);
  document.getElementById("generalSettingsForm")?.addEventListener("submit", saveGeneralSettings);
  document.getElementById("diagnosisTypeForm")?.addEventListener("submit", saveDiagnosisType);
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
  document.getElementById("hrStaffPhone")?.addEventListener("input", event => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });

  document.getElementById("scheduleSave")?.addEventListener("click", saveScheduleSettings);
  document.getElementById("scheduleSalon")?.addEventListener("change", event => {
    renderScheduleSettings(event.target.value);
  });
  ["scheduleWorkStart", "scheduleWorkEnd", "scheduleWeekendStart", "scheduleWeekendEnd", "scheduleDuration", "scheduleCapacity"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderSchedulePreview);
  });

  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

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
  document.querySelectorAll(".customer-sort-actions .sort-text-btn").forEach(button => {
    button.addEventListener("click", () => {
      customerSortMode = button.dataset.sort || "date";
      customerPage = 1;
      renderCustomers();
    });
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

  document.getElementById("assignmentForm").addEventListener("submit", event => {
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

  document.getElementById("newStaffBtn").addEventListener("click", openStaffModal);
  document.getElementById("newCatalogBtn")?.addEventListener("click", openCatalogModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", event => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
}

function init() {
  removeRetiredViews();
  ensureHumanResourceShell();
  loadServiceSettings();
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
  renderVouchers();
  renderGiftCards();
  renderBookings();
  renderServices();
  renderAudit();
  bindEvents();
  openBookingModal();
  setView("bookings");
}

init();
