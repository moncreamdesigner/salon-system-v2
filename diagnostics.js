(() => {
  "use strict";

  const TEST_DURATION_MS = 10 * 60 * 1000;
  const MAX_EVENTS = 20000;
  const state = {
    active: false,
    finished: false,
    startedAt: 0,
    stoppedAt: 0,
    events: [],
    observers: [],
    timers: [],
    animationFrame: 0,
    panel: null,
    timerText: null,
    statusText: null,
    lastView: "",
    lastTick: 0
  };

  function nowMs() {
    return Math.round(performance.now() * 10) / 10;
  }

  function safePath(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return `${url.origin === window.location.origin ? "" : url.origin}${url.pathname}`;
    } catch {
      return String(value || "").split("?")[0].slice(0, 180);
    }
  }

  function record(type, detail = {}) {
    if (!state.active || state.events.length >= MAX_EVENTS) return;
    state.events.push({
      at: nowMs(),
      type,
      ...detail
    });
  }

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0) * 10) / 10;
  }

  function deviceSnapshot() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const memory = performance.memory;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "",
      language: navigator.language || "",
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      screen: { width: window.screen?.width || 0, height: window.screen?.height || 0 },
      cpuThreads: navigator.hardwareConcurrency || null,
      deviceMemoryGb: navigator.deviceMemory || null,
      connection: connection ? {
        effectiveType: connection.effectiveType || "",
        downlinkMbps: connection.downlink ?? null,
        rttMs: connection.rtt ?? null,
        saveData: Boolean(connection.saveData)
      } : null,
      heapLimit: memory?.jsHeapSizeLimit || null,
      build: document.querySelector('meta[name="app-build"]')?.content || ""
    };
  }

  function storageSnapshot() {
    const sizes = {};
    let totalChars = 0;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        const size = String(localStorage.getItem(key) || "").length;
        sizes[key.slice(0, 80)] = size;
        totalChars += size;
      }
    } catch {
      return { available: false };
    }
    return { available: true, totalChars, keys: sizes };
  }

  function actionDescriptor(target) {
    const element = target?.closest?.("button, a, input, select, [data-view], [data-view-target], [data-action]");
    if (!element) return null;
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || "",
      view: element.dataset.view || element.dataset.viewTarget || "",
      action: element.dataset.action || "",
      aria: String(element.getAttribute("aria-label") || "").slice(0, 80),
      inputType: element instanceof HTMLInputElement ? element.type : ""
    };
  }

  function startObservers() {
    if ("PerformanceObserver" in window) {
      try {
        const longTaskObserver = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            record("long-task", {
              start: Math.round(entry.startTime * 10) / 10,
              duration: Math.round(entry.duration * 10) / 10
            });
          });
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
        state.observers.push(longTaskObserver);
      } catch {}

      try {
        const resourceObserver = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            if (!["fetch", "xmlhttprequest", "script", "css"].includes(entry.initiatorType)) return;
            record("resource", {
              initiator: entry.initiatorType,
              path: safePath(entry.name),
              duration: Math.round(entry.duration * 10) / 10,
              transferBytes: entry.transferSize || 0,
              bodyBytes: entry.encodedBodySize || 0
            });
          });
        });
        resourceObserver.observe({ type: "resource", buffered: true });
        state.observers.push(resourceObserver);
      } catch {}
    }

    const viewObserver = new MutationObserver(() => {
      const activeView = document.querySelector(".view.active")?.id || "";
      if (!activeView || activeView === state.lastView) return;
      state.lastView = activeView;
      record("view-active", { view: activeView });
    });
    viewObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    state.observers.push(viewObserver);
  }

  function startSampling() {
    state.lastTick = performance.now();
    const lagTimer = window.setInterval(() => {
      const current = performance.now();
      const lag = Math.max(0, current - state.lastTick - 500);
      state.lastTick = current;
      const memory = performance.memory;
      record("sample", {
        eventLoopLag: Math.round(lag * 10) / 10,
        heapUsed: memory?.usedJSHeapSize || null,
        domNodes: document.getElementsByTagName("*").length,
        hidden: document.hidden
      });
    }, 500);
    state.timers.push(lagTimer);

    let frames = 0;
    let frameWindow = performance.now();
    const countFrame = timestamp => {
      if (!state.active) return;
      frames += 1;
      if (timestamp - frameWindow >= 1000) {
        record("fps", {
          frames,
          windowMs: Math.round((timestamp - frameWindow) * 10) / 10
        });
        frames = 0;
        frameWindow = timestamp;
      }
      state.animationFrame = requestAnimationFrame(countFrame);
    };
    state.animationFrame = requestAnimationFrame(countFrame);

    const uiTimer = window.setInterval(updatePanel, 250);
    const stopTimer = window.setTimeout(() => stopTest("10-minute-complete"), TEST_DURATION_MS);
    state.timers.push(uiTimer, stopTimer);
  }

  function stopRuntime() {
    state.observers.forEach(observer => observer.disconnect());
    state.observers = [];
    state.timers.forEach(timer => {
      clearInterval(timer);
      clearTimeout(timer);
    });
    state.timers = [];
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
  }

  function startTest() {
    if (state.active) return;
    state.active = true;
    state.finished = false;
    state.startedAt = Date.now();
    state.stoppedAt = 0;
    state.events = [];
    state.lastView = document.querySelector(".view.active")?.id || "";
    ensurePanel();
    record("session-start", {
      page: safePath(window.location.href),
      device: deviceSnapshot(),
      storage: storageSnapshot(),
      initialView: state.lastView
    });
    startObservers();
    startSampling();
    updatePanel();
  }

  function stopTest(reason = "manual") {
    if (!state.active) return;
    record("session-stop", { reason });
    state.active = false;
    state.finished = true;
    state.stoppedAt = Date.now();
    stopRuntime();
    updatePanel();
  }

  function report() {
    const lagValues = state.events.filter(item => item.type === "sample").map(item => Number(item.eventLoopLag) || 0);
    const longTasks = state.events.filter(item => item.type === "long-task").map(item => Number(item.duration) || 0);
    const fetches = state.events.filter(item => item.type === "fetch").map(item => Number(item.duration) || 0);
    return {
      schema: "khalgai-performance-v1",
      generatedAt: new Date().toISOString(),
      startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
      stoppedAt: state.stoppedAt ? new Date(state.stoppedAt).toISOString() : null,
      durationMs: state.startedAt ? (state.stoppedAt || Date.now()) - state.startedAt : 0,
      summary: {
        eventCount: state.events.length,
        longTaskCount: longTasks.length,
        longestTaskMs: Math.max(0, ...longTasks),
        eventLoopLagP95Ms: percentile(lagValues, 0.95),
        eventLoopLagMaxMs: Math.max(0, ...lagValues),
        fetchCount: fetches.length,
        fetchP95Ms: percentile(fetches, 0.95),
        fetchMaxMs: Math.max(0, ...fetches)
      },
      events: state.events
    };
  }

  function downloadReport() {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `khalgai-performance-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function remainingText() {
    if (!state.active) return state.finished ? "Тест дууссан" : "Тест эхлээгүй";
    const remaining = Math.max(0, TEST_DURATION_MS - (Date.now() - state.startedAt));
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function updatePanel() {
    if (!state.panel) return;
    state.timerText.textContent = remainingText();
    state.statusText.textContent = state.active
      ? `${state.events.length} хэмжилт`
      : state.finished
        ? "JSON файлаа татна уу"
        : "Бэлэн";
    state.panel.querySelector("[data-diag-start]").disabled = state.active;
    state.panel.querySelector("[data-diag-stop]").disabled = !state.active;
    state.panel.querySelector("[data-diag-download]").disabled = !state.events.length;
  }

  function ensurePanel() {
    if (state.panel) {
      state.panel.hidden = false;
      return;
    }
    const panel = document.createElement("aside");
    panel.id = "performanceDiagnosticPanel";
    panel.innerHTML = `
      <strong>Гүйцэтгэлийн тест</strong>
      <span data-diag-timer>Тест эхлээгүй</span>
      <small data-diag-status>Бэлэн</small>
      <div>
        <button type="button" data-diag-start>10 минут эхлүүлэх</button>
        <button type="button" data-diag-stop>Зогсоох</button>
        <button type="button" data-diag-download>JSON татах</button>
        <button type="button" data-diag-close aria-label="Хаах">×</button>
      </div>
    `;
    document.body.appendChild(panel);
    state.panel = panel;
    state.timerText = panel.querySelector("[data-diag-timer]");
    state.statusText = panel.querySelector("[data-diag-status]");
    panel.querySelector("[data-diag-start]").addEventListener("click", startTest);
    panel.querySelector("[data-diag-stop]").addEventListener("click", () => stopTest("manual"));
    panel.querySelector("[data-diag-download]").addEventListener("click", downloadReport);
    panel.querySelector("[data-diag-close]").addEventListener("click", () => {
      panel.hidden = true;
    });
    updatePanel();
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    if (!state.active) return originalFetch(...args);
    const input = args[0];
    const options = args[1] || {};
    const started = performance.now();
    try {
      const response = await originalFetch(...args);
      record("fetch", {
        method: String(options.method || input?.method || "GET").toUpperCase(),
        path: safePath(input?.url || input),
        status: response.status,
        duration: Math.round((performance.now() - started) * 10) / 10,
        responseBytes: Number(response.headers.get("content-length")) || 0
      });
      return response;
    } catch (error) {
      record("fetch", {
        method: String(options.method || input?.method || "GET").toUpperCase(),
        path: safePath(input?.url || input),
        status: 0,
        duration: Math.round((performance.now() - started) * 10) / 10,
        failed: true
      });
      throw error;
    }
  };

  document.addEventListener("click", event => {
    const action = actionDescriptor(event.target);
    if (action) record("click", action);
  }, true);

  document.addEventListener("change", event => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;
    record("change", {
      id: element.id || "",
      tag: element.tagName.toLowerCase(),
      inputType: element instanceof HTMLInputElement ? element.type : ""
    });
  }, true);

  document.addEventListener("visibilitychange", () => record("visibility", { hidden: document.hidden }));
  window.addEventListener("error", event => record("error", {
    file: safePath(event.filename || ""),
    line: event.lineno || 0,
    column: event.colno || 0
  }));
  window.addEventListener("unhandledrejection", () => record("unhandled-rejection"));

  document.addEventListener("keydown", event => {
    if (!(event.ctrlKey && event.altKey && event.code === "KeyP")) return;
    event.preventDefault();
    ensurePanel();
  });

  window.KhalgaiDiagnostics = {
    start: startTest,
    stop: stopTest,
    download: downloadReport,
    report,
    record,
    show: ensurePanel
  };

  if (new URLSearchParams(window.location.search).get("diagnostic") === "1") {
    window.addEventListener("DOMContentLoaded", () => {
      ensurePanel();
      startTest();
    }, { once: true });
  }
})();
