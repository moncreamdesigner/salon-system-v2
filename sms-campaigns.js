let smsCampaignRows = [];
let smsCampaignPagination = { page: 1, pageSize: 20, pageCount: 1, total: 0 };
let smsCampaignPage = 1;
let smsCampaignLoading = false;
let smsCampaignPollingTimer = null;
let smsCampaignExpandedId = 0;
let smsCampaignRecipientPage = 1;
let smsCampaignRecipientCache = null;
let smsCampaignAudienceCount = null;
let smsCampaignCharacterLimit = 1000;

const SMS_CAMPAIGN_STATUS_LABELS = {
  draft: "Бэлтгэсэн",
  running: "Илгээж байна",
  paused: "Түр зогсоосон",
  completed: "Дууссан",
  cancelled: "Цуцалсан"
};

function stopSmsCampaignPolling() {
  if (smsCampaignPollingTimer) window.clearTimeout(smsCampaignPollingTimer);
  smsCampaignPollingTimer = null;
}

function scheduleSmsCampaignPolling() {
  stopSmsCampaignPolling();
  if (activeView !== "smsCampaigns" || !isAdminAccount() || !smsCampaignRows.some(item => item.status === "running")) return;
  smsCampaignPollingTimer = window.setTimeout(() => {
    smsCampaignPollingTimer = null;
    if (activeView === "smsCampaigns" && isAdminAccount()) void loadSmsCampaigns({ silent: true });
  }, 20000);
}

function updateSmsCampaignMessageCounter() {
  const field = document.getElementById("smsCampaignMessage");
  const counter = document.getElementById("smsCampaignMessageCounter");
  if (!field || !counter) return;
  const length = Array.from(field.value || "").length;
  const latin = !/[^\x00-\x7F]/.test(field.value || "");
  const size = latin ? (length > 160 ? 153 : 160) : (length > 70 ? 67 : 70);
  const segments = Math.max(1, Math.ceil(length / size));
  counter.textContent = `${length}/${smsCampaignCharacterLimit} тэмдэгт · ${segments} SMS`;
  counter.classList.toggle("is-over", length > smsCampaignCharacterLimit);
}

function smsCampaignStatusClass(status) {
  return ["draft", "running", "paused", "completed", "cancelled"].includes(status) ? status : "draft";
}

function smsCampaignActionButtons(item) {
  const id = Number(item.id || 0);
  if (item.status === "draft") return `<button class="primary-btn sms-campaign-action" type="button" data-action="start" data-id="${id}">Эхлүүлэх</button><button class="secondary-btn sms-campaign-action" type="button" data-action="cancel" data-id="${id}">Цуцлах</button>`;
  if (item.status === "running") return `<button class="secondary-btn sms-campaign-action" type="button" data-action="pause" data-id="${id}">Түр зогсоох</button><button class="secondary-btn sms-campaign-action" type="button" data-action="cancel" data-id="${id}">Цуцлах</button>`;
  if (item.status === "paused") return `<button class="primary-btn sms-campaign-action" type="button" data-action="start" data-id="${id}">Үргэлжлүүлэх</button><button class="secondary-btn sms-campaign-action" type="button" data-action="cancel" data-id="${id}">Цуцлах</button>`;
  return "";
}

function renderSmsCampaignRecipientRows(campaignId) {
  const details = smsCampaignRecipientCache;
  if (!details || Number(details.campaign?.id || 0) !== Number(campaignId)) {
    return '<p class="sms-campaign-detail-note">Дэлгэрэнгүй мэдээллийг уншиж байна...</p>';
  }
  const rows = Array.isArray(details.recipients) ? details.recipients : [];
  const pagination = details.pagination || { page: 1, pageCount: 1 };
  const table = rows.length ? `<div class="table-wrap sms-campaign-recipients"><table class="booking-table"><thead><tr><th>Утас</th><th>Төлөв</th><th>Оролдлого</th><th>Илгээсэн</th></tr></thead><tbody>${rows.map(item => `<tr><td>${htmlSafe(item.phone || "—")}</td><td><span class="sms-history-status ${htmlSafe(item.status || "pending")}">${htmlSafe(SMS_STATUS_LABELS[item.status] || item.status || "—")}</span>${item.last_error ? `<span class="sms-message-meta">${htmlSafe(item.last_error)}</span>` : ""}</td><td>${Number(item.attempts || 0)}/${Number(item.max_attempts || 3)}</td><td>${htmlSafe(String(item.sent_at || "—").slice(0, 16))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sms-campaign-detail-note">Илгээлт эхлүүлсний дараа хүлээн авагчид харагдана.</p>';
  const pages = Number(pagination.pageCount || 1) > 1 ? `<div class="pagination-row"><button class="secondary-btn sms-campaign-recipient-page" type="button" data-page="${Number(pagination.page || 1) - 1}" ${Number(pagination.page || 1) <= 1 ? "disabled" : ""}>Өмнөх</button><span>${Number(pagination.page || 1)} / ${Number(pagination.pageCount || 1)}</span><button class="secondary-btn sms-campaign-recipient-page" type="button" data-page="${Number(pagination.page || 1) + 1}" ${Number(pagination.page || 1) >= Number(pagination.pageCount || 1) ? "disabled" : ""}>Дараах</button></div>` : "";
  return table + pages;
}

function renderSmsCampaignRows() {
  const container = document.getElementById("smsCampaignRows");
  const empty = document.getElementById("smsCampaignEmpty");
  const pagination = document.getElementById("smsCampaignPagination");
  const totalLabel = document.getElementById("smsCampaignTotal");
  if (!container) return;

  container.innerHTML = smsCampaignRows.map(item => {
    const id = Number(item.id || 0);
    const total = Number(item.total_count || 0);
    const finished = Number(item.sent_count || 0) + Number(item.failed_count || 0) + Number(item.cancelled_count || 0);
    const progress = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;
    const expanded = smsCampaignExpandedId === id;
    return `<article class="sms-campaign-card"><div class="sms-campaign-card-head"><div><strong>${htmlSafe(item.title || "SMS илгээлт")}</strong><span>${htmlSafe(String(item.created_at || "").slice(0, 16))} · ${htmlSafe(item.created_by || "—")} · ${Number(item.batch_size || 0)} SMS/мин</span></div><span class="sms-campaign-status ${smsCampaignStatusClass(item.status)}">${htmlSafe(SMS_CAMPAIGN_STATUS_LABELS[item.status] || item.status || "—")}</span></div><p class="sms-campaign-message-preview">${htmlSafe(item.message || "")}</p><div class="sms-campaign-metrics"><span>Нийт <strong>${total.toLocaleString("en-US")}</strong></span><span>Илгээсэн <strong class="is-success">${Number(item.sent_count || 0).toLocaleString("en-US")}</strong></span><span>Хүлээгдэж буй <strong>${Number(item.pending_count || 0).toLocaleString("en-US")}</strong></span><span>Амжилтгүй <strong class="${Number(item.failed_count || 0) > 0 ? "is-danger" : ""}">${Number(item.failed_count || 0).toLocaleString("en-US")}</strong></span>${Number(item.cancelled_count || 0) > 0 ? `<span>Цуцалсан <strong>${Number(item.cancelled_count || 0).toLocaleString("en-US")}</strong></span>` : ""}</div>${total > 0 ? `<div class="sms-campaign-progress" aria-label="${progress}%"><span style="width:${progress}%"></span></div>` : ""}${item.last_error && item.status === "running" ? `<p class="sms-campaign-error">${htmlSafe(item.last_error)}</p>` : ""}<div class="sms-campaign-card-actions"><button class="secondary-btn sms-campaign-detail-toggle" type="button" data-id="${id}">${expanded ? "Хураах" : "Дэлгэрэнгүй"}</button><div>${smsCampaignActionButtons(item)}</div></div>${expanded ? `<div class="sms-campaign-detail">${renderSmsCampaignRecipientRows(id)}</div>` : ""}</article>`;
  }).join("");

  empty?.classList.toggle("hidden", smsCampaignRows.length > 0);
  if (totalLabel) totalLabel.textContent = `Нийт ${Number(smsCampaignPagination.total || 0).toLocaleString("en-US")} илгээлт`;
  if (pagination) {
    const page = Number(smsCampaignPagination.page || 1);
    const pageCount = Number(smsCampaignPagination.pageCount || 1);
    pagination.innerHTML = pageCount > 1 ? `<button class="secondary-btn sms-campaign-page" type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Өмнөх</button><span>${page} / ${pageCount}</span><button class="secondary-btn sms-campaign-page" type="button" data-page="${page + 1}" ${page >= pageCount ? "disabled" : ""}>Дараах</button>` : "";
  }

  container.querySelectorAll(".sms-campaign-action").forEach(button => {
    button.addEventListener("click", () => void performSmsCampaignAction(button.dataset.action, Number(button.dataset.id || 0), button));
  });
  container.querySelectorAll(".sms-campaign-detail-toggle").forEach(button => {
    button.addEventListener("click", () => void toggleSmsCampaignDetail(Number(button.dataset.id || 0)));
  });
  container.querySelectorAll(".sms-campaign-recipient-page").forEach(button => {
    button.addEventListener("click", () => void loadSmsCampaignRecipients(smsCampaignExpandedId, Number(button.dataset.page || 1)));
  });
  pagination?.querySelectorAll(".sms-campaign-page").forEach(button => {
    button.addEventListener("click", () => {
      smsCampaignPage = Math.max(1, Number(button.dataset.page || 1));
      void loadSmsCampaigns();
    });
  });

  if (activeView === "smsCampaigns") renderInfoHeader("smsCampaigns");
  scheduleSmsCampaignPolling();
}

async function loadSmsCampaigns({ silent = false } = {}) {
  if (!isAdminAccount() || smsCampaignLoading) return;
  smsCampaignLoading = true;
  try {
    const query = new URLSearchParams({ view: "campaigns", page: String(smsCampaignPage) });
    const result = await serverApi(`sms-campaigns.php?${query.toString()}`);
    smsCampaignRows = Array.isArray(result.campaigns) ? result.campaigns : [];
    smsCampaignPagination = result.pagination || { page: 1, pageSize: 20, pageCount: 1, total: smsCampaignRows.length };
    smsCampaignPage = Number(smsCampaignPagination.page || 1);
    smsCampaignCharacterLimit = Math.max(1, Number(result.characterLimit || 1000));
    const batch = document.getElementById("smsCampaignBatchSize");
    if (batch && !batch.value) batch.value = String(result.defaultBatchSize || 50);
    updateSmsCampaignMessageCounter();
    renderSmsCampaignRows();
  } catch (error) {
    if (!silent) showToast(error.message || "SMS илгээлт ачаалсангүй", "error");
    scheduleSmsCampaignPolling();
  } finally {
    smsCampaignLoading = false;
  }
}

async function previewSmsCampaignAudience() {
  if (!isAdminAccount()) return;
  const button = document.getElementById("smsCampaignAudienceButton");
  if (button) button.disabled = true;
  try {
    const result = await serverApi("sms-campaigns.php?view=audience");
    smsCampaignAudienceCount = Number(result.total || 0);
    const label = document.getElementById("smsCampaignAudienceCount");
    if (label) label.textContent = `${smsCampaignAudienceCount.toLocaleString("en-US")} давхардаагүй дугаар`;
  } catch (error) {
    showToast(error.message || "Хүлээн авагч шалгасангүй", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function createSmsCampaign(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = formValue("smsCampaignTitle");
  const message = formValue("smsCampaignMessage");
  const batchSize = Math.max(10, Math.min(100, Number(formValue("smsCampaignBatchSize")) || 50));
  if (!title) return showToast("Илгээлтийн нэрээ оруулна уу", "error");
  if (!message) return showToast("SMS агуулгаа оруулна уу", "error");
  if (Array.from(message).length > smsCampaignCharacterLimit) return showToast("SMS агуулга тохируулсан хязгаараас урт байна", "error");
  const code = await requireEditCodeValue();
  if (!code) return;
  const button = event.submitter || form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    const result = await serverApi("sms-campaigns.php", { method: "POST", body: JSON.stringify({ action: "create", title, message, batchSize, code }) });
    form.reset();
    const batch = document.getElementById("smsCampaignBatchSize");
    if (batch) batch.value = "50";
    smsCampaignPage = 1;
    updateSmsCampaignMessageCounter();
    showToast(result.message || "SMS илгээлт бэлтгэгдлээ");
    await loadSmsCampaigns({ silent: true });
  } catch (error) {
    showToast(error.message || "SMS илгээлт бэлтгэсэнгүй", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function performSmsCampaignAction(action, id, button = null) {
  if (!["start", "pause", "cancel"].includes(action) || id < 1) return;
  const code = await requireEditCodeValue();
  if (!code) return;
  if (button) button.disabled = true;
  try {
    const result = await serverApi("sms-campaigns.php", { method: "POST", body: JSON.stringify({ action, id, code }) });
    showToast(result.message || "SMS илгээлт шинэчлэгдлээ");
    await loadSmsCampaigns({ silent: true });
  } catch (error) {
    showToast(error.message || "SMS илгээлт шинэчилсэнгүй", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function toggleSmsCampaignDetail(id) {
  if (smsCampaignExpandedId === id) {
    smsCampaignExpandedId = 0;
    smsCampaignRecipientCache = null;
    renderSmsCampaignRows();
    return;
  }
  smsCampaignExpandedId = id;
  smsCampaignRecipientPage = 1;
  smsCampaignRecipientCache = null;
  renderSmsCampaignRows();
  await loadSmsCampaignRecipients(id, 1);
}

async function loadSmsCampaignRecipients(id, page = 1) {
  if (!isAdminAccount() || id < 1) return;
  try {
    const query = new URLSearchParams({ view: "recipients", campaignId: String(id), page: String(Math.max(1, page)) });
    const result = await serverApi(`sms-campaigns.php?${query.toString()}`);
    if (smsCampaignExpandedId !== id) return;
    smsCampaignRecipientCache = result;
    smsCampaignRecipientPage = Number(result.pagination?.page || 1);
    renderSmsCampaignRows();
  } catch (error) {
    showToast(error.message || "SMS дэлгэрэнгүй мэдээлэл ачаалсангүй", "error");
  }
}

function bindSmsCampaignEvents() {
  document.getElementById("smsCampaignForm")?.addEventListener("submit", createSmsCampaign);
  document.getElementById("smsCampaignAudienceButton")?.addEventListener("click", () => void previewSmsCampaignAudience());
  document.getElementById("smsCampaignRefresh")?.addEventListener("click", () => void loadSmsCampaigns());
  document.getElementById("smsCampaignMessage")?.addEventListener("input", updateSmsCampaignMessageCounter);
  document.getElementById("smsCampaignBatchSize")?.addEventListener("input", event => {
    const value = Number(event.target.value);
    if (Number.isFinite(value) && value > 100) event.target.value = "100";
  });
}
