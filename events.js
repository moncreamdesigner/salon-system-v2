/* Event records use a dedicated endpoint; never save them as generic state. */
window.EventSettings = (() => {
  let rows = [];
  let editing = null;
  let draftId = "";
  let busy = false;
  let loading = null;
  const profileDrafts = new Map();
  let reportKey = "";
  let reportSequence = 0;
  let reportCatalogLoadedAt = 0;
  let reportLoadedAt = 0;
  let reportLoading = false;
  const el = id => document.getElementById(id);
  const html = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const note = (message, error = false) => {
    const target = el("eventMessage");
    if (target) { target.textContent = message; target.classList.toggle("event-error", error); }
  };
  function reset() {
    editing = null;
    draftId = entityId("event");
    el("eventForm")?.reset();
    if (el("eventUnlimited")) {
      el("eventUnlimited").checked = true;
      el("eventEndDate").disabled = true;
    }
    if (el("eventStartDate")) el("eventStartDate").value = todayText();
    if (el("eventSubmit")) el("eventSubmit").textContent = "Нэмэх";
    if (el("eventCancel")) el("eventCancel").hidden = true;
  }
  function draw() {
    const body = el("eventRows");
    if (!body) return;
    body.innerHTML = rows.map(row => `<tr>
      <td><strong>${html(row.name)}</strong></td><td>${html(row.startDate)}</td><td>${html(row.endDate || "Хугацаагүй")}</td>
      <td>${Number(row.registrationCount) || 0}</td>
      <td><div class="table-actions">
        <button type="button" class="secondary-btn icon-action" data-event-edit="${html(row.id)}" aria-label="Засах" ${busy ? "disabled" : ""}>${editIcon()}</button>
        <button type="button" class="danger-btn icon-danger" data-event-delete="${html(row.id)}" aria-label="Устгах" ${busy || row.hasRegistrations || row.registrationCount > 0 ? "disabled" : ""} title="${row.hasRegistrations || row.registrationCount > 0 ? "Хүн бүртгэгдсэн арга хэмжээг устгах боломжгүй" : "Устгах"}">${trashIcon()}</button>
      </div></td></tr>`).join("") || '<tr><td colspan="5">Арга хэмжээ бүртгэгдээгүй байна.</td></tr>';
    if (el("eventFields")) el("eventFields").disabled = busy;
    if (el("eventRefresh")) el("eventRefresh").disabled = busy;
  }
  async function load() {
    if (loading) return loading;
    note("Ачаалж байна…");
    loading = (async () => {
      try {
        const result = await serverApi("events.php");
        rows = result.events;
        draw();
        note("");
        if (activeView === "events") renderInfoHeader("events");
      } catch (error) { note(error.message, true); }
      finally { loading = null; }
    })();
    return loading;
  }
  async function mutate(payload, message) {
    busy = true;
    draw();
    try {
      await serverApi("events.php", { method: "POST", body: JSON.stringify(payload) });
      for (const draft of profileDrafts.values()) draft.fetchedAt = 0;
      reportKey = "";
      reportCatalogLoadedAt = 0;
      reset();
      if (loading) await loading;
      await load();
      showToast(message);
    } catch (error) {
      // Keep the draft and stable ID after a network failure. Retrying cannot
      // create a duplicate; a stale version is rejected by the server.
      note(error.message, true);
      if (error.status === 409) await load().then(() => note(error.message, true));
    } finally { busy = false; draw(); }
  }
  function render() {
    const form = el("eventForm");
    if (!form) return;
    if (!form.dataset.bound) {
      form.dataset.bound = "1";
      reset();
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (busy) return;
        const name = el("eventName").value.trim();
        const startDate = el("eventStartDate").value;
        const endDate = el("eventEndDate").value;
        if (!name || !startDate || (endDate && endDate < startDate)) return note("Нэр, эхлэх огноо болон дуусах огноо оруулсан бол түүнийг зөв оруулна уу.", true);
        void mutate({ action: "save", id: editing?.id || draftId, version: editing?.version || 0, name, startDate, endDate }, editing ? "Арга хэмжээ шинэчлэгдлээ" : "Арга хэмжээ нэмэгдлээ");
      });
      el("eventCancel").addEventListener("click", reset);
      el("eventUnlimited")?.addEventListener("change", event => {
        el("eventEndDate").disabled = event.target.checked;
        if (event.target.checked) el("eventEndDate").value = "";
      });
      el("eventEndDate").addEventListener("change", () => {
        if (el("eventUnlimited")) el("eventUnlimited").checked = !el("eventEndDate").value;
      });
      el("eventRefresh").addEventListener("click", () => { if (!busy) void load(); });
      el("eventRows").addEventListener("click", async event => {
        const button = event.target.closest("[data-event-edit], [data-event-delete]");
        if (!button || busy) return;
        const row = rows.find(item => item.id === (button.dataset.eventEdit || button.dataset.eventDelete));
        if (!row) return;
        if (button.dataset.eventEdit) {
          editing = { ...row };
          el("eventName").value = row.name;
          el("eventStartDate").value = row.startDate;
          el("eventEndDate").value = row.endDate || "";
          if (el("eventUnlimited")) {
            el("eventUnlimited").checked = !row.endDate;
            el("eventEndDate").disabled = !row.endDate;
          }
          el("eventSubmit").textContent = "Хадгалах";
          el("eventCancel").hidden = false;
          form.scrollIntoView({ behavior: "smooth", block: "nearest" });
          el("eventName").focus();
        } else {
          if (row.hasRegistrations || row.registrationCount > 0) return note("Хүн бүртгэгдсэн арга хэмжээг устгах боломжгүй.", true);
          const code = await requestActionCode("delete", true);
          if (!code || busy) return;
          await mutate({ action: "delete", id: row.id, version: row.version, code }, "Арга хэмжээ устлаа");
        }
      });
    }
    draw();
    void load();
  }
  function profileCard(customer) {
    return `<section class="profile-side-card" id="profileEventCard" data-customer-id="${html(customer.id)}">
      <div class="profile-card-title">Арга хэмжээ</div>
      <div class="profile-event-controls"><select class="input" id="profileEventSelect" aria-label="Арга хэмжээ" disabled><option value="">–</option></select><button class="primary-btn" id="profileEventSave" type="button" disabled>Хадгалах</button></div>
      <p class="muted-row" id="profileEventMessage" role="status" aria-live="polite"></p></section>`;
  }
  function bindProfile(customer) {
    const id = String(customer.id);
    const card = el("profileEventCard");
    if (!card) return;
    let draft = profileDrafts.get(id);
    if (!draft) { draft = { selected: "", saved: "", token: "", events: [], loaded: false, dirty: false, busy: false, fetchedAt: 0 }; profileDrafts.set(id, draft); }
    const current = () => el("profileEventCard")?.dataset.customerId === id;
    const message = text => { if (current() && el("profileEventMessage")) el("profileEventMessage").textContent = text; };
    const paint = () => {
      if (!current()) return;
      const select = el("profileEventSelect");
      const selectable = draft.events.filter(event => !event.endDate || event.endDate >= todayText());
      select.innerHTML = '<option value="">–</option>' + selectable.map(event => `<option value="${html(event.id)}">${html(event.name)}</option>`).join("");
      select.value = draft.selected;
      select.disabled = !draft.loaded || draft.busy;
      el("profileEventSave").disabled = !draft.loaded || draft.busy || !draft.dirty;
    };
    const fetchMembership = async (preserveDraft = false) => {
      if (draft.fetching) return;
      draft.fetching = true;
      message("Ачаалж байна…");
      try {
        const result = await serverApi(`events.php?customerId=${encodeURIComponent(id)}`);
        draft.events = result.events;
        draft.saved = result.membership.eventId;
        draft.token = result.membership.token;
        if (!preserveDraft && !draft.dirty) draft.selected = draft.saved;
        draft.dirty = draft.selected !== draft.saved;
        draft.loaded = true;
        draft.fetchedAt = Date.now();
        paint();
        message("");
      } catch (error) { message(error.message); }
      finally { draft.fetching = false; }
    };
    el("profileEventSelect").addEventListener("change", event => {
      draft.selected = event.target.value;
      draft.dirty = draft.selected !== draft.saved;
      el("profileEventSave").disabled = !draft.dirty;
    });
    el("profileEventSave").addEventListener("click", async () => {
      if (!draft.loaded || !draft.dirty || draft.busy) return;
      draft.busy = true; paint(); message("Хадгалж байна…");
      try {
        const result = await serverApi("events.php", { method: "POST", body: JSON.stringify({ action: "assign", customerId: id, eventId: draft.selected, token: draft.token }) });
        draft.saved = draft.selected = result.membership.eventId;
        draft.token = result.membership.token;
        draft.dirty = false;
        reportKey = "";
        reportCatalogLoadedAt = 0;
        message("");
      } catch (error) {
        if (error.status === 409) await fetchMembership(true);
        message(error.message);
      } finally { draft.busy = false; paint(); }
    });
    paint();
    if (!draft.busy && !draft.dirty && (!draft.loaded || Date.now() - draft.fetchedAt > 30000)) void fetchMembership();
  }
  async function renderDashboard(force = false) {
    const panel = el("eventDashboard");
    if (!panel) return;
    const mode = el("eventReportMode");
    const month = el("eventReportMonth");
    const eventSelect = el("eventReportEvent");
    const reportNote = text => { if (panel.isConnected) el("eventReportMessage").textContent = text; };
    if (!panel.dataset.bound) {
      panel.dataset.bound = "1";
      month.value = todayText().slice(0, 7);
      for (const input of [mode, month, eventSelect]) input.addEventListener("change", () => void renderDashboard(true));
      el("eventReportRefresh").addEventListener("click", () => void renderDashboard(true));
    }
    month.parentElement.hidden = mode.value !== "month";
    eventSelect.parentElement.hidden = mode.value !== "single";
    const salon = document.getElementById("dashboardSalon")?.value || "";
    const key = JSON.stringify([mode.value, month.value, eventSelect.value, salon]);
    if (!force && reportKey === key && (reportLoading || Date.now() - reportLoadedAt < 30000)) return;
    reportKey = key;
    const sequence = ++reportSequence;
    reportLoading = true;
    reportNote("Ачаалж байна…");
    try {
      if (force || Date.now() - reportCatalogLoadedAt > 30000) {
        const catalog = await serverApi("events.php");
        if (sequence !== reportSequence || !panel.isConnected) return;
        const selected = eventSelect.value;
        eventSelect.innerHTML = '<option value="">Арга хэмжээ сонгох</option>' + catalog.events.map(event => `<option value="${html(event.id)}">${html(event.name)}</option>`).join("");
        eventSelect.value = selected;
        reportCatalogLoadedAt = Date.now();
      }
      const params = new URLSearchParams({ mode: "dashboard", filter: mode.value, month: month.value, eventId: eventSelect.value, salon });
      const result = await serverApi(`events.php?${params}`);
      if (sequence !== reportSequence || !panel.isConnected) return;
      const summary = result.summary;
      el("eventReportTotals").innerHTML = `<span>Арга хэмжээ: <strong>${summary.eventCount}</strong></span><span>Нийт бүртгэл: <strong>${summary.registrations}</strong></span><span>Давхардаагүй хэрэглэгч: <strong>${summary.customers}</strong></span>`;
      el("eventReportRows").innerHTML = summary.events.map(event => `<tr><td><strong>${html(event.name)}</strong></td><td>${html(event.startDate)} — ${html(event.endDate || "Хугацаагүй")}</td><td>${event.registrationCount}</td></tr>`).join("") || '<tr><td colspan="3">Мэдээлэл алга.</td></tr>';
      el("eventReportSalons").innerHTML = Object.entries(summary.salons).map(([name, count]) => `<span>${html(name)}: <strong>${count}</strong></span>`).join("");
      reportLoadedAt = Date.now();
      reportNote("");
    } catch (error) {
      if (sequence === reportSequence) {
        reportKey = "";
        el("eventReportTotals").textContent = "";
        el("eventReportRows").innerHTML = "";
        el("eventReportSalons").textContent = "";
        reportNote(error.message);
      }
    } finally { if (sequence === reportSequence) reportLoading = false; }
  }
  return {
    render, profileCard, bindProfile, renderDashboard,
    get count() { return rows.length; },
    get hasPending() {
      if (busy || [...profileDrafts.values()].some(draft => draft.busy || draft.dirty)) return true;
      if (!el("eventName")) return false;
      if (!editing) return Boolean(el("eventName").value.trim() || el("eventEndDate").value);
      return el("eventName").value !== editing.name || el("eventStartDate").value !== editing.startDate || el("eventEndDate").value !== editing.endDate;
    }
  };
})();
