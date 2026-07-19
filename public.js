const PUBLIC_STORAGE_KEY = "khalgai_salon_local_mvp_v1";
const publicDefaultSettings = {
  catalog: {
    flipHtml5Code: window.KhalgaiFlipHtml5.DEFAULT_CODE,
    dragHintEnabled: true,
    dragHintHtml: window.KhalgaiFlipHtml5.DEFAULT_HINT_HTML,
    dragHintCss: window.KhalgaiFlipHtml5.DEFAULT_HINT_CSS
  },
  booking: {
    directoryHeadline: "ТА ӨӨРТ ОЙР САЛБАРТАА ЦАГ ЗАХИАЛААРАЙ"
  },
  salons: {},
  results: {
    categories: ["Бүгд", "Үс уналт", "Хаг", "Тослог үс", "Гэмтэлтэй үс"],
    posts: [
      {
        id: 1,
        title: "Үсний уналт багассан үр дүн",
        category: "Үс уналт",
        visits: "8 удаагийн оролт",
        duration: "3 сарын үр дүн",
        description: "Үсний уналт багасаж, шинэ үсний ургалт нэмэгдсэн бодит үр дүн.",
        products: "Халгай нано шампунь, маск",
        beforeImage: "",
        afterImage: "",
        published: true
      }
    ]
  }
};

const publicFallbackState = {
  salons: [
    { id: 1, name: "Хан-Уул салбар", address: "Хан-Уул дүүрэг, 2-р хороо, АПУ ХХК-ийн замын эсрэг талд, 75-р сургуулийн хойно 35Б байр.", phone: "80024373", active: true, slotCapacity: 4, schedule: { workStart: "09:00", workEnd: "20:00", weekendStart: "10:00", weekendEnd: "20:00", duration: 60 } },
    { id: 2, name: "Төв салбар", address: "Чингэлтэй дүүрэг, 3-р хороо, Peace mall худалдааны төвийн хойно.", phone: "89894373", active: true, slotCapacity: 6, schedule: { workStart: "09:00", workEnd: "20:00", weekendStart: "10:00", weekendEnd: "20:00", duration: 60 } }
  ],
  bookings: [],
  holidays: [],
  homepageSettings: publicDefaultSettings
};

let publicState = structuredClone(publicFallbackState);
let publicSettings = structuredClone(publicDefaultSettings);
let activePublicView = "catalog";
let selectedSalonId = null;
let selectedDate = "";
let selectedTime = "";
let weekOffset = 0;
let bookingSubmissionSucceeded = false;
let publicToastTimer = null;
let activeHeroSlide = 0;
let heroTimer = null;

function mergePublicSettings(settings = {}) {
  const storedCatalog = settings.catalog || {};
  const hasStoredFlipCode = Object.prototype.hasOwnProperty.call(storedCatalog, "flipHtml5Code");
  const hasLegacyFlipCode = Object.prototype.hasOwnProperty.call(storedCatalog, "customViewerHtml");
  const storedFlipCode = hasStoredFlipCode
    ? String(storedCatalog.flipHtml5Code ?? "")
    : hasLegacyFlipCode
      ? String(storedCatalog.customViewerHtml ?? "")
      : window.KhalgaiFlipHtml5.DEFAULT_CODE;
  const storedHintCss = String(storedCatalog.dragHintCss || window.KhalgaiFlipHtml5.DEFAULT_HINT_CSS).replace(/#(?:68bd63|7da64b|789f4a)/gi, "#78a450");
  return {
    ...structuredClone(publicDefaultSettings),
    ...structuredClone(settings || {}),
    catalog: {
      flipHtml5Code: storedFlipCode,
      dragHintEnabled: storedCatalog.dragHintEnabled !== false,
      dragHintHtml: storedCatalog.dragHintHtml || window.KhalgaiFlipHtml5.DEFAULT_HINT_HTML,
      dragHintCss: storedHintCss
    },
    booking: {
      ...structuredClone(publicDefaultSettings.booking),
      ...(settings.booking || {})
    },
    salons: { ...(settings.salons || {}) },
    results: { ...structuredClone(publicDefaultSettings.results), ...(settings.results || {}) }
  };
}

async function loadPublicData() {
  try {
    const response = await fetch("api/public.php", { cache: "no-store", headers: { "X-Requested-With": "KhalgaiSalon" } });
    if (!response.ok) throw new Error("Public API unavailable");
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "Public API unavailable");
    publicState = { ...structuredClone(publicFallbackState), ...(result.data || {}) };
  } catch (error) {
    try {
      const local = JSON.parse(localStorage.getItem(PUBLIC_STORAGE_KEY) || "null");
      publicState = local ? { ...structuredClone(publicFallbackState), ...local } : structuredClone(publicFallbackState);
    } catch (storageError) {
      publicState = structuredClone(publicFallbackState);
    }
  }
  publicSettings = mergePublicSettings(publicState.homepageSettings);
}

function showPublicToast(message, tone = "") {
  const toast = document.getElementById("publicToast");
  if (!toast) return;
  clearTimeout(publicToastTimer);
  toast.textContent = message;
  toast.classList.toggle("success", tone === "success");
  toast.classList.add("show");
  publicToastTimer = setTimeout(() => {
    toast.classList.remove("show", "success");
    publicToastTimer = null;
  }, tone === "success" ? 3600 : 2600);
}

function setPublicView(name) {
  activePublicView = ["catalog", "booking", "results"].includes(name) ? name : "catalog";
  document.getElementById("publicApp")?.classList.toggle("catalog-mode", activePublicView === "catalog");
  document.querySelectorAll("[data-public-view]").forEach(view => view.classList.toggle("active", view.dataset.publicView === activePublicView));
  document.querySelectorAll("[data-public-target]").forEach(button => button.classList.toggle("active", button.dataset.publicTarget === activePublicView));
  if (activePublicView === "booking") renderSalonDirectory();
  if (activePublicView === "results") renderResults();
  void refreshActivePublicView(activePublicView);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let publicRefreshInFlight = false;
async function refreshActivePublicView(viewName = activePublicView) {
  if (publicRefreshInFlight || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  publicRefreshInFlight = true;
  try {
    await loadPublicData();
    if (activePublicView !== viewName) return;
    if (viewName === "catalog") renderCatalog();
    if (viewName === "booking") renderSalonDirectory();
    if (viewName === "results") renderResults();
  } finally {
    publicRefreshInFlight = false;
  }
}

function safeText(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function salonVisual(salon, type = "cover") {
  const config = salonConfig(salon);
  const gallery = Array.isArray(config.gallery) ? config.gallery.filter(Boolean) : [];
  const url = type === "cover" ? (config.coverImage || gallery[0] || "") : (gallery[activeHeroSlide] || config.coverImage || "");
  return url
    ? `<img src="${safeText(url)}" alt="${safeText(salon.name)}">`
    : `<img class="salon-cover-placeholder" src="assets/khalgai-salon-logo.png" alt="${safeText(salon.name)} cover зураг">`;
}

function renderCatalog() {
  window.KhalgaiFlipHtml5.render(document.getElementById("catalogStage"), publicSettings.catalog);
}

function activeSalons() {
  return (publicState.salons || []).filter(salon => salon.active !== false);
}

function bindSalonDirectorySlider() {
  const track = document.getElementById("salonSliderTrack");
  const dots = document.getElementById("salonSliderDots");
  if (!track || !dots) return;
  const slides = Array.from(track.querySelectorAll(".salon-slide-card"));
  const dotButtons = Array.from(dots.querySelectorAll("button"));
  if (!slides.length) return;

  let pendingFrame = 0;
  const updateActiveSlide = () => {
    pendingFrame = 0;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let activeIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - trackCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        activeIndex = index;
      }
    });
    slides.forEach((slide, index) => slide.classList.toggle("active", index === activeIndex));
    dotButtons.forEach((dot, index) => {
      dot.classList.toggle("active", index === activeIndex);
      dot.setAttribute("aria-current", index === activeIndex ? "true" : "false");
    });
  };

  track.addEventListener("scroll", () => {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(updateActiveSlide);
  }, { passive: true });

  dotButtons.forEach((dot, index) => dot.addEventListener("click", () => {
    slides[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }));
  requestAnimationFrame(updateActiveSlide);
}

function renderSalonDirectory() {
  clearInterval(heroTimer);
  const directory = document.getElementById("salonDirectory");
  const detail = document.getElementById("salonDetail");
  directory.classList.remove("hidden");
  detail.classList.add("hidden");
  const salons = activeSalons();
  const headline = publicSettings.booking?.directoryHeadline || "ТА ӨӨРТ ОЙР САЛБАРТАА ЦАГ ЗАХИАЛААРАЙ";
  const cards = salons.map((salon, index) => `<article class="salon-slide-card${index === 0 ? " active" : ""}">
    <button class="salon-slide-media" type="button" data-salon-open="${salon.id}" aria-label="${safeText(salon.name)} дэлгэрэнгүй">${salonVisual(salon)}</button>
    <div class="salon-slide-content">
      <h2 class="salon-slide-headline">${safeText(headline)}</h2>
      <p class="salon-slide-name">${safeText(salon.name)}</p>
      <button class="salon-slide-more" type="button" data-salon-open="${salon.id}">Дэлгэрэнгүй <span aria-hidden="true">→</span></button>
    </div>
  </article>`).join("");
  const dots = salons.map((salon, index) => `<button class="${index === 0 ? "active" : ""}" type="button" aria-label="${safeText(salon.name)}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("");
  directory.innerHTML = `<div class="salon-directory">
    <div class="salon-directory-logo"><img src="assets/khalgai-salon-logo.png" alt="Халгай клиник салон"></div>
    ${cards ? `<div class="salon-slider-shell"><div class="salon-slider-track" id="salonSliderTrack">${cards}</div><div class="salon-slider-dots" id="salonSliderDots">${dots}</div></div>` : '<div class="empty-public">Идэвхтэй салбар алга.</div>'}
  </div>`;
  bindSalonDirectorySlider();
}

function salonConfig(salon) {
  const legacy = publicSettings.salons?.[salon.id] || publicSettings.salons?.[salon.name] || {};
  return {
    ...legacy,
    coverImage: salon.coverImage || legacy.coverImage || "",
    gallery: Array.isArray(salon.gallery) ? salon.gallery : (Array.isArray(legacy.gallery) ? legacy.gallery : []),
    mapUrl: salon.mapUrl || legacy.mapUrl || ""
  };
}

function salonSchedule(salon, date = new Date()) {
  const defaults = { workStart: "09:00", workEnd: "19:00", weekendStart: "10:00", weekendEnd: "19:00", duration: 30 };
  const config = { ...defaults, ...(salon.schedule || {}) };
  const weekend = [0, 6].includes(date.getDay());
  return { start: weekend ? config.weekendStart : config.workStart, end: weekend ? config.weekendEnd : config.workEnd, duration: Number(config.duration) || 30 };
}

function renderSalonDetail(salonId) {
  const salon = activeSalons().find(item => Number(item.id) === Number(salonId));
  if (!salon) return;
  selectedSalonId = salon.id;
  selectedDate = "";
  selectedTime = "";
  weekOffset = 0;
  bookingSubmissionSucceeded = false;
  activeHeroSlide = 0;
  const config = salonConfig(salon);
  const weekdaySchedule = salonSchedule(salon, new Date(2026, 6, 13));
  const weekendSchedule = salonSchedule(salon, new Date(2026, 6, 12));
  document.getElementById("salonDirectory").classList.add("hidden");
  const detail = document.getElementById("salonDetail");
  detail.classList.remove("hidden");
  detail.innerHTML = `<button class="salon-detail-back" type="button" id="salonBack" aria-label="Буцах"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
    <div class="salon-hero"><div class="salon-hero-slide" id="salonHeroSlide">${salonVisual(salon,"hero")}</div><div class="salon-hero-dots" id="salonHeroDots"></div></div>
    <div class="salon-detail-body">
      <img class="salon-detail-logo" src="assets/khalgai-salon-logo.png" alt="Халгай клиник салон">
      <h1 class="salon-detail-title">${safeText(salon.name)}</h1>
      <div class="salon-contact-list">
        <div class="salon-contact-row"><span class="salon-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 1.8"/></svg></span><div><b>ЦАГИЙН ХУВААРЬ:</b><p>Даваа–Баасан: <strong>${safeText(weekdaySchedule.start)}–${safeText(weekdaySchedule.end)}</strong><br>Бямба–Ням: <strong>${safeText(weekendSchedule.start)}–${safeText(weekendSchedule.end)}</strong></p></div></div>
        <div class="salon-contact-row salon-contact-phone"><span class="salon-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.1 3.8 9.6 3l2 4.7-2 1.2a14.2 14.2 0 0 0 5.5 5.5l1.2-2 4.7 2-.8 2.5c-.4 1.2-1.5 2-2.8 2C10.6 18.9 5.1 13.4 5.1 6.6c0-1.3.8-2.4 2-2.8Z"/></svg></span><div><b>УТАС:</b><a href="tel:${safeText(salon.phone)}">${safeText(salon.phone || "—")}</a></div></div>
        <div class="salon-contact-row"><span class="salon-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s6.2-6.3 6.2-12A6.2 6.2 0 1 0 5.8 9c0 5.7 6.2 12 6.2 12Z"/><circle cx="12" cy="9" r="2.2"/></svg></span><div><b>ХАЯГ:</b><p>${safeText(salon.address || "—")}</p></div></div>
        <div class="salon-contact-row"><span class="salon-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m20.5 3.5-8.1 17-2-7-7-2 17.1-8Z"/><path d="m10.4 13.5 4-4"/></svg></span><div><b>GOOGLE MAPS</b><a href="${safeText(config.mapUrl || '#')}" target="_blank" rel="noopener">${safeText(salon.name)}ын байршил харах</a></div></div>
      </div>
      <div id="bookingComposer"></div>
    </div>`;
  renderHero(salon);
  renderBookingComposer(salon);
  const gallery = Array.isArray(config.gallery) ? config.gallery.filter(Boolean) : [];
  if (gallery.length > 1) heroTimer = setInterval(() => { activeHeroSlide = (activeHeroSlide + 1) % gallery.length; renderHero(salon); }, 4300);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHero(salon) {
  const config = salonConfig(salon);
  const gallery = Array.isArray(config.gallery) ? config.gallery.filter(Boolean) : [];
  const slide = document.getElementById("salonHeroSlide");
  if (slide) slide.innerHTML = salonVisual(salon, "hero");
  const dots = document.getElementById("salonHeroDots");
  if (dots) dots.innerHTML = (gallery.length ? gallery : [""]).map((_, index) => `<i class="${index === activeHeroSlide ? "active" : ""}"></i>`).join("");
}

function dateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekDates() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const daysFromMonday = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - daysFromMonday + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(base); date.setDate(base.getDate() + index); return date; });
}

function timeOptions(salon, date) {
  const schedule = salonSchedule(salon, date);
  const [startHour, startMinute] = schedule.start.split(":").map(Number);
  const [endHour, endMinute] = schedule.end.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const slots = [];
  for (let time = start; time <= end; time += Math.max(schedule.duration, 5)) {
    slots.push(`${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`);
  }
  return slots;
}

function slotFull(salon, date, time) {
  const count = (publicState.bookings || []).filter(item => item.salon === salon.name && item.date === date && item.time === time && item.status !== "cancelled").length;
  return count >= Math.max(Number(salon.slotCapacity) || 1, 1);
}

function dateHoliday(salon, date) {
  return (publicState.holidays || []).some(item => item.date === date && (!item.salon || item.salon === salon.name || (item.salons || []).includes(salon.name)));
}

function dateIsPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value < today;
}

function timeIsPast(date, time) {
  const now = new Date();
  if (dateText(date) !== dateText(now)) return false;
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute <= now.getHours() * 60 + now.getMinutes();
}

function dateUnavailable(salon, date) {
  const value = dateText(date);
  if (dateIsPast(date) || dateHoliday(salon, value)) return true;
  const times = timeOptions(salon, date);
  return !times.length || times.every(time => timeIsPast(date, time) || slotFull(salon, value, time));
}

function renderBookingComposer(salon) {
  const composer = document.getElementById("bookingComposer");
  if (!composer) return;
  const dates = weekDates();
  const selectableDates = dates.filter(date => !dateUnavailable(salon, date));
  if (!selectedDate || !selectableDates.some(date => dateText(date) === selectedDate)) selectedDate = selectableDates[0] ? dateText(selectableDates[0]) : "";
  const selectedDateObject = dates.find(date => dateText(date) === selectedDate) || selectableDates[0] || dates[0];
  const weekdays = ["НЯМ", "ДАВ", "МЯГ", "ЛХА", "ПҮР", "БАА", "БЯМ"];
  const mongolianDays = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
  const holiday = selectedDate ? dateHoliday(salon, selectedDate) : false;
  const times = selectedDate && !holiday ? timeOptions(salon, selectedDateObject) : [];
  const timeDisabled = time => timeIsPast(selectedDateObject, time) || slotFull(salon, selectedDate, time);
  if (selectedTime && (!times.includes(selectedTime) || timeDisabled(selectedTime))) selectedTime = "";
  composer.innerHTML = `<section class="booking-card">
      <h3>ӨДӨР СОНГОХ</h3>
      <div class="week-head"><button class="week-nav-button" type="button" data-week="prev" aria-label="Өмнөх долоо хоног" ${weekOffset <= 0 ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button><strong>${selectedDateObject.getMonth() + 1}-Р САР</strong><button class="week-nav-button" type="button" data-week="next" aria-label="Дараагийн долоо хоног"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>
      <div class="date-strip">${dates.map(date => { const value = dateText(date); const disabled = dateUnavailable(salon, date); return `<button class="date-option ${value === selectedDate ? "active" : ""}" type="button" data-booking-date="${value}" ${disabled ? "disabled" : ""}><small>${weekdays[date.getDay()]}</small>${date.getDate()}</button>`; }).join("")}</div>
    </section>
    <section class="booking-card"><h3>ЦАГ СОНГОХ</h3>${!selectedDate ? '<div class="empty-public">Энэ долоо хоногт захиалах боломжтой өдөр алга.</div>' : holiday ? '<div class="empty-public">Энэ өдөр салбар амарна.</div>' : `<div class="time-grid">${times.map(time => `<button class="time-option ${selectedTime === time ? "active" : ""}" type="button" data-booking-time="${time}" ${timeDisabled(time) ? "disabled" : ""}>${time}</button>`).join("")}</div>`}</section>
    <section class="booking-card"><h3>УТАСНЫ ДУГААР</h3><input class="phone-input" id="publicBookingPhone" inputmode="numeric" maxlength="8" placeholder="XXXXXXXX"><p class="booking-help">Захиалга баталгаажуулахад бид тантай холбогдоно.</p></section>
    ${selectedDate ? `<div class="booking-summary">${selectedDateObject.getMonth() + 1}-р сарын ${selectedDateObject.getDate()}, ${mongolianDays[selectedDateObject.getDay()]}${selectedTime ? ` • ${selectedTime}` : ""}</div>` : ""}
    <button class="booking-submit${bookingSubmissionSucceeded ? " success" : ""}" id="publicBookingSubmit" type="button" ${bookingSubmissionSucceeded ? "disabled" : ""}>${bookingSubmissionSucceeded ? "Амжилттай" : "Захиалга илгээх"}</button>`;
}

async function submitPublicBooking() {
  const salon = activeSalons().find(item => Number(item.id) === Number(selectedSalonId));
  const phone = String(document.getElementById("publicBookingPhone")?.value || "").replace(/\D/g, "").slice(0, 8);
  if (!salon || !selectedDate || !selectedTime) return showPublicToast("Өдөр, цагаа сонгоно уу");
  if (phone.length !== 8) return showPublicToast("8 оронтой утасны дугаар оруулна уу");
  if ((publicState.bookings || []).some(item => item.phone === phone && item.date === selectedDate && item.status !== "cancelled")) return showPublicToast("Энэ дугаараас тухайн өдөр цаг захиалсан байна");
  if (slotFull(salon, selectedDate, selectedTime)) return showPublicToast("Сонгосон цаг дүүрсэн байна");
  const booking = { id: Date.now(), salon: salon.name, date: selectedDate, time: selectedTime, phone, source: "customer", status: "pending" };
  try {
    const response = await fetch("api/public.php", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "KhalgaiSalon" }, body: JSON.stringify({ booking }) });
    if (!response.ok) throw new Error("Local mode");
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "Захиалга илгээсэнгүй");
    booking.id = result.booking?.id || booking.id;
  } catch (error) {
    if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return showPublicToast(error.message || "Захиалга илгээсэнгүй");
    publicState.bookings = Array.isArray(publicState.bookings) ? publicState.bookings : [];
    publicState.bookings.unshift(booking);
    try {
      const storedState = JSON.parse(localStorage.getItem(PUBLIC_STORAGE_KEY) || "null") || {};
      const storedBookings = Array.isArray(storedState.bookings) ? storedState.bookings : [];
      storedState.bookings = [booking, ...storedBookings];
      localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(storedState));
    } catch (storageError) {}
  }
  if (!(publicState.bookings || []).some(item => Number(item.id) === Number(booking.id))) publicState.bookings.unshift(booking);
  bookingSubmissionSucceeded = true;
  renderBookingComposer(salon);
}

function resultPosts() {
  return (publicSettings.results.posts || []).filter(post => post.published !== false);
}

function resultImage(url, label) {
  return url ? `<img src="${safeText(url)}" alt="${safeText(label)}">` : `<div class="result-placeholder"><img src="assets/khalgai-salon-logo.png" alt=""><b>${safeText(label)} зураг</b></div>`;
}

function resultImages(post = {}) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean).slice(0, 2) : [];
  if (!images.length) images.push(...[post.beforeImage, post.afterImage].filter(Boolean).slice(0, 2));
  return [images[0] || "", images[1] || ""];
}

function resultWebUrl(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
    const url = new URL(normalized);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (_) {
    return "";
  }
}

function safeResultRichText(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set(["B", "STRONG", "I", "EM", "UL", "OL", "LI", "P", "DIV", "BR", "SPAN"]);
  [...template.content.querySelectorAll("*")].reverse().forEach(element => {
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(tag)) return element.remove();
    const color = String(tag === "FONT" ? element.getAttribute("color") || "" : element.style.color || "").trim();
    const safeColor = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(color) ? color : "";
    if (tag === "FONT") {
      const span = document.createElement("span");
      if (safeColor) span.style.color = safeColor;
      span.append(...element.childNodes);
      return element.replaceWith(span);
    }
    if (!allowed.has(tag)) return element.replaceWith(...element.childNodes);
    [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
    if (tag === "SPAN" && safeColor) element.style.color = safeColor;
  });
  return template.innerHTML.trim();
}

function renderResults() {
  document.getElementById("resultFeed").innerHTML = resultPosts().map(post => {
    const images = resultImages(post);
    const webUrl = resultWebUrl(post.webUrl);
    return `<article class="result-card">
      <div class="result-card-head"><h2>${safeText(post.title)}</h2>${post.duration ? `<span class="result-duration">${safeText(post.duration)}</span>` : ""}</div>
      <div class="result-slider" data-result-slider data-slide-index="0">
        <div class="result-slider-track"><div class="result-slide">${resultImage(images[0],"Үр дүнгийн эхний")}</div><div class="result-slide">${resultImage(images[1],"Үр дүнгийн хоёр дахь")}</div></div>
        <button class="result-slide-arrow previous" type="button" data-result-slide-action="previous" aria-label="Өмнөх зураг"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>
        <button class="result-slide-arrow next" type="button" data-result-slide-action="next" aria-label="Дараагийн зураг"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
      </div>
      <div class="result-card-copy"><div class="result-description">${post.descriptionHtml ? safeResultRichText(post.descriptionHtml) : safeText(post.description || "")}</div>${webUrl ? `<a class="result-web-link" href="${safeText(webUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Бүтээгдэхүүний дэлгэрэнгүй холбоос"><img src="assets/icon-market.svg?v=202607191030" alt=""><span>${safeText(webUrl.replace(/^https?:\/\//i, "").replace(/\/$/, ""))}</span></a>` : ""}</div>
    </article>`;
  }).join("") || '<div class="empty-public">Үр дүн оруулаагүй байна.</div>';
}

function setResultSlide(slider, index) {
  const selected = Math.max(0, Math.min(1, Number(index) || 0));
  slider.dataset.slideIndex = String(selected);
  const track = slider.querySelector(".result-slider-track");
  if (track) track.style.transform = `translateX(-${selected * 50}%)`;
  slider.querySelectorAll("[data-result-slide-to]").forEach(button => button.classList.toggle("active", Number(button.dataset.resultSlideTo) === selected));
}

function finishResultSlideDrag(slider, clientX) {
  const startX = Number(slider.dataset.dragStartX);
  const startIndex = Number(slider.dataset.dragStartIndex) || 0;
  if (!Number.isFinite(startX)) return;
  const distance = clientX - startX;
  delete slider.dataset.dragStartX;
  delete slider.dataset.dragStartIndex;
  slider.classList.remove("dragging");
  if (Math.abs(distance) < Math.min(55, slider.clientWidth * .16)) return setResultSlide(slider, startIndex);
  setResultSlide(slider, distance < 0 ? Math.min(1, startIndex + 1) : Math.max(0, startIndex - 1));
}

function bindPublicEvents() {
  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-public-target]");
    if (nav) return setPublicView(nav.dataset.publicTarget);
    const salon = event.target.closest("[data-salon-open]");
    if (salon) return renderSalonDetail(salon.dataset.salonOpen);
    if (event.target.closest("#salonBack")) return renderSalonDirectory();
    const week = event.target.closest("[data-week]");
    if (week) { weekOffset += week.dataset.week === "next" ? 1 : -1; selectedDate = ""; selectedTime = ""; bookingSubmissionSucceeded = false; return renderBookingComposer(activeSalons().find(item => Number(item.id) === Number(selectedSalonId))); }
    const date = event.target.closest("[data-booking-date]");
    if (date) { selectedDate = date.dataset.bookingDate; selectedTime = ""; bookingSubmissionSucceeded = false; return renderBookingComposer(activeSalons().find(item => Number(item.id) === Number(selectedSalonId))); }
    const time = event.target.closest("[data-booking-time]");
    if (time) { selectedTime = time.dataset.bookingTime; bookingSubmissionSucceeded = false; return renderBookingComposer(activeSalons().find(item => Number(item.id) === Number(selectedSalonId))); }
    if (event.target.closest("#publicBookingSubmit")) return submitPublicBooking();
    const resultSlideControl = event.target.closest("[data-result-slide-action], [data-result-slide-to]");
    if (resultSlideControl) {
      const slider = resultSlideControl.closest("[data-result-slider]");
      if (!slider) return;
      const current = Number(slider.dataset.slideIndex) || 0;
      const next = resultSlideControl.dataset.resultSlideTo !== undefined ? Number(resultSlideControl.dataset.resultSlideTo) : (resultSlideControl.dataset.resultSlideAction === "next" ? current + 1 : current - 1);
      return setResultSlide(slider, next < 0 ? 1 : next > 1 ? 0 : next);
    }
  });
  document.addEventListener("input", event => {
    if (event.target.id === "publicBookingPhone") event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  document.addEventListener("pointerdown", event => {
    const slider = event.target.closest("[data-result-slider]");
    if (!slider || event.target.closest("button, a")) return;
    slider.dataset.dragStartX = String(event.clientX);
    slider.dataset.dragStartIndex = slider.dataset.slideIndex || "0";
    slider.classList.add("dragging");
    slider.setPointerCapture?.(event.pointerId);
  });
  document.addEventListener("pointermove", event => {
    const slider = event.target.closest("[data-result-slider]");
    if (!slider || slider.dataset.dragStartX === undefined) return;
    const distance = event.clientX - Number(slider.dataset.dragStartX);
    const startIndex = Number(slider.dataset.dragStartIndex) || 0;
    const track = slider.querySelector(".result-slider-track");
    if (track) track.style.transform = `translateX(calc(-${startIndex * 50}% + ${distance}px))`;
  });
  document.addEventListener("pointerup", event => {
    const slider = event.target.closest("[data-result-slider]");
    if (slider) finishResultSlideDrag(slider, event.clientX);
  });
  document.addEventListener("pointercancel", event => {
    const slider = event.target.closest("[data-result-slider]");
    if (slider) finishResultSlideDrag(slider, Number(slider.dataset.dragStartX));
  });
}

async function initializePublicApp() {
  await loadPublicData();
  renderCatalog();
  renderSalonDirectory();
  renderResults();
  bindPublicEvents();
  setPublicView("catalog");
}

initializePublicApp();

window.addEventListener("focus", () => void refreshActivePublicView(activePublicView));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refreshActivePublicView(activePublicView);
});
